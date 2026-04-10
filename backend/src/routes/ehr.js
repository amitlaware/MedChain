// backend/src/routes/ehr.js
// EHR upload and retrieval endpoints

const express  = require('express');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');

const { authenticate, requireRole } = require('../middleware/auth');
const { withFabric }    = require('../services/fabricService');
const { StorageService } = require('../services/storageService');

const router  = express.Router();
const storage = new StorageService();

// Multer — store file in memory for IPFS upload (max 50 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom', 'text/plain'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed`));
  },
});

// ── POST /api/ehr/upload ───────────────────────────────────────────────────────
// Hospitals and doctors can upload EHRs

router.post('/upload',
  authenticate,
  requireRole('hospital', 'doctor'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { patientId, recordType, metadata = '{}' } = req.body;
      if (!patientId || !recordType) {
        return res.status(400).json({ error: 'patientId and recordType are required' });
      }

      // 1. Encrypt and upload file to IPFS
      const { ipfsHash, encryptionMeta } = await storage.uploadToIPFS(req.file.buffer);

      // 2. Also back up to S3 (optional but recommended)
      const s3Key = `ehr/${patientId}/${uuidv4()}-encrypted`;
      // await storage.uploadToS3(encryptedBuffer, s3Key, req.file.mimetype);

      // 3. The encryption key should be encrypted with the patient's public key.
      //    For simplicity here we store it as-is; in production use RSA/ECIES.
      const encKeyForChain = JSON.stringify(encryptionMeta);

      // 4. Write EHR record to blockchain
      const ehrId = uuidv4();
      const result = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
        return fabric.invoke(
          'uploadEHR',
          ehrId,
          patientId,
          ipfsHash,
          recordType,
          encKeyForChain,
          metadata,
        );
      });

      res.status(201).json({
        message: 'EHR uploaded successfully',
        ehrId,
        ipfsHash,
        result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/ehr/:ehrId ────────────────────────────────────────────────────────
// View a single EHR (returns metadata + IPFS hash; file fetched separately)

router.get('/:ehrId', authenticate, async (req, res, next) => {
  try {
    const { ehrId } = req.params;

    const ehr = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('viewRecord', ehrId);
    });

    res.json(ehr);
  } catch (err) {
    // Fabric throws if access denied — pass to error handler
    next(err);
  }
});

// ── GET /api/ehr/:ehrId/download ──────────────────────────────────────────────
// Download the actual file from IPFS

router.get('/:ehrId/download', authenticate, async (req, res, next) => {
  try {
    const { ehrId } = req.params;

    // First verify on-chain access
    const ehr = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('viewRecord', ehrId);
    });

    const encryptionMeta = JSON.parse(ehr.encKey);
    const fileBuffer = await storage.downloadFromIPFS(ehr.ipfsHash, encryptionMeta);

    const filename = ehr.metadata?.fileName || `${ehrId}.file`;
    const mimeType = ehr.metadata?.mimeType || 'application/octet-stream';

    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Content-Type', mimeType);
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ehr/patient/:patientId ───────────────────────────────────────────
// List all EHRs for a patient

router.get('/patient/:patientId', authenticate, async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // Patients can only view their own records
    if (req.user.role === 'patient' && req.user.userId !== patientId) {
      return res.status(403).json({ error: 'Patients may only view their own records' });
    }

    const records = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('getPatientRecords', patientId);
    });

    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/ehr/:ehrId ────────────────────────────────────────────────────
// Soft-delete (hospitals/doctors who uploaded it)

router.delete('/:ehrId',
  authenticate,
  requireRole('hospital', 'doctor'),
  async (req, res, next) => {
    try {
      const result = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
        return fabric.invoke('deleteEHR', req.params.ehrId);
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
