// backend/src/routes/auth.js
// User registration & login — enrolls identities into Fabric wallet

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const FabricCAServices = require('fabric-ca-client');
const { Wallets }      = require('fabric-network');
const path = require('path');
const fs   = require('fs');

const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// ── In-memory user store (replace with MongoDB/PostgreSQL in production) ──────
// Schema: { id, email, passwordHash, role, orgMsp, fabricId, createdAt }
const users = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCAClient(org) {
  const orgMap = {
    hospital: { caHost: '127.0.0.1', port: 7054, msp: 'HospitalMSP' },
    doctor:   { caHost: '127.0.0.1', port: 8054, msp: 'DoctorMSP'   },
    patient:  { caHost: '127.0.0.1', port: 9054, msp: 'PatientMSP'  },
  };
  const cfg = orgMap[org];
  if (!cfg) throw new Error(`Unknown org: ${org}`);

  const tlsCertPath = path.resolve(
    __dirname, '../../../blockchain/crypto-config/peerOrganizations',
    `${org}.ehr.com/ca/ca.${org}.ehr.com-cert.pem`
  );
  const tlsCert = fs.readFileSync(tlsCertPath);

  const caInfo = new FabricCAServices(
    `https://${cfg.caHost}:${cfg.port}`,
    { trustedRoots: tlsCert, verify: false },
    `ca-${org}`
  );
  return { caInfo, msp: cfg.msp };
}

async function getAdminWallet(org) {
  const walletPath = path.join(__dirname, '../../wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  // Check if admin already enrolled; if not, enroll them
  const adminId = `admin-${org}`;
  const existing = await wallet.get(adminId);
  if (!existing) {
    const { caInfo, msp } = await getCAClient(org);
    const enrollment = await caInfo.enroll({
      enrollmentID: 'admin',
      enrollmentSecret: 'adminpw',
    });
    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey:  enrollment.key.toBytes(),
      },
      mspId: msp,
      type:  'X.509',
    };
    await wallet.put(adminId, x509Identity);
  }

  return { wallet, adminId };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty().trim(),
  body('role').isIn(['hospital', 'doctor', 'patient']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role } = req.body;

      if (users.has(email)) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId  = `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fabricId = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${role}`;

      // Enroll user in Fabric CA
      const { wallet, adminId } = await getAdminWallet(role);
      const { caInfo, msp } = await getCAClient(role);

      const adminIdentity = await wallet.get(adminId);
      const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
      const adminUser = await provider.getUserContext(adminIdentity, adminId);

      const secret = await caInfo.register(
        {
          affiliation: 'org1.department1',
          enrollmentID: fabricId,
          role: 'client',
          attrs: [
            { name: 'role',  value: role,  ecert: true },
            { name: 'email', value: email, ecert: true },
            { name: 'name',  value: name,  ecert: true },
          ],
        },
        adminUser
      );

      const enrollment = await caInfo.enroll({
        enrollmentID: fabricId,
        enrollmentSecret: secret,
        attr_reqs: [
          { name: 'role',  optional: false },
          { name: 'email', optional: false },
        ],
      });

      const x509Identity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey:  enrollment.key.toBytes(),
        },
        mspId: msp,
        type:  'X.509',
      };
      await wallet.put(fabricId, x509Identity);

      // Store user record
      const user = { id: userId, email, passwordHash, name, role, orgMsp: msp, fabricId, createdAt: new Date().toISOString() };
      users.set(email, user);

      const token = jwt.sign({ userId, email, role, orgMsp: msp, fabricId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: userId, email, name, role, orgMsp: msp },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const user = users.get(email);

      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { userId: user.id, email, role: user.role, orgMsp: user.orgMsp, fabricId: user.fabricId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      res.json({
        token,
        user: { id: user.id, email, name: user.name, role: user.role, orgMsp: user.orgMsp },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get('/me', authenticate, (req, res) => {
  const { userId, email, role, orgMsp } = req.user;
  res.json({ userId, email, role, orgMsp });
});

// ── GET /api/auth/patients ──────────────────────────────────────────────────────

router.get('/patients', authenticate, (req, res) => {
  const patientsList = [];
  for (const [email, user] of users.entries()) {
    if (user.role === 'patient') {
      patientsList.push({ id: user.id, name: user.name, email: email });
    }
  }
  res.json({ patients: patientsList });
});

module.exports = router;
