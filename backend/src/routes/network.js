// backend/src/routes/network.js
// All org-registry + cross-org sharing endpoints

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticate, requireRole } = require('../middleware/auth');
const networkService = require('../services/networkService');

const router = express.Router();

// ── Helper: build caller context from JWT ─────────────────────────────────
const caller = (req) => ({ fabricId: req.user.fabricId, orgMsp: req.user.orgMsp });

// ─────────────────────────────────────────────────────────────────────────────
// ORG MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/network/orgs
 * Register a new organisation on the blockchain.
 * Only hospital admins can do this.
 *
 * Body: { orgId, orgName, orgType, contact:{email,phone,address}, tlsCert?, peerEndpoint? }
 */
router.post('/orgs',
  authenticate,
  requireRole('hospital'),
  [
    body('orgId').notEmpty().trim(),
    body('orgName').notEmpty().trim(),
    body('orgType').isIn(['hospital', 'doctor', 'patient', 'lab', 'insurance', 'pharmacy']),
    body('contact').isObject(),
    body('contact.email').isEmail(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { orgId, orgName, orgType, contact, tlsCert, peerEndpoint } = req.body;

      const result = await networkService.registerOrg(caller(req), {
        orgId, orgName, orgType, contact,
        tlsCert:      tlsCert      || '',
        peerEndpoint: peerEndpoint || '',
      });

      res.status(201).json({ message: 'Organization registered on blockchain', ...result });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/network/orgs
 * List all registered organisations.
 * Optional: ?type=hospital|doctor|patient|lab
 */
router.get('/orgs', authenticate, async (req, res, next) => {
  try {
    const { type } = req.query;
    const orgs = type
      ? await networkService.getOrgsByType(caller(req), type)
      : await networkService.getAllOrgs(caller(req));
    res.json({ orgs });
  } catch (err) { next(err); }
});

/**
 * GET /api/network/orgs/:orgId
 * Get a single org's full profile.
 */
router.get('/orgs/:orgId', authenticate, async (req, res, next) => {
  try {
    const org = await networkService.getOrg(caller(req), req.params.orgId);
    res.json(org);
  } catch (err) { next(err); }
});

/**
 * POST /api/network/orgs/:orgId/approve
 * Sign off on a newly registered org (multi-org approval).
 */
router.post('/orgs/:orgId/approve',
  authenticate,
  requireRole('hospital'),
  async (req, res, next) => {
    try {
      const { threshold = 2 } = req.body;
      const result = await networkService.approveOrg(caller(req), req.params.orgId, threshold);
      res.json(result);
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /api/network/orgs/:orgId/status
 * Suspend or re-activate an org.
 */
router.patch('/orgs/:orgId/status',
  authenticate,
  requireRole('hospital'),
  body('status').isIn(['active', 'suspended', 'removed']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const result = await networkService.updateOrgStatus(caller(req), req.params.orgId, req.body.status);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-ORG EHR SHARE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/network/share-requests
 * Hospital A initiates a share of an EHR to Hospital B.
 *
 * Body: { ehrId, toOrgId, toUserId?, reason, expiresAt? }
 */
router.post('/share-requests',
  authenticate,
  requireRole('hospital', 'doctor'),
  [
    body('ehrId').notEmpty(),
    body('toOrgId').notEmpty(),
    body('reason').notEmpty().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { ehrId, toOrgId, toUserId, reason, expiresAt } = req.body;
      const requestId = uuidv4();

      const result = await networkService.createShareRequest(caller(req), {
        requestId,
        ehrId,
        fromOrgId: req.user.orgMsp,
        toOrgId,
        toUserId:  toUserId  || 'any',
        reason,
        expiresAt: expiresAt || null,
      });

      res.status(201).json({ requestId, ...result });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/network/share-requests/pending
 * Get all pending share requests for my org.
 */
router.get('/share-requests/pending', authenticate, requireRole('hospital', 'doctor'), async (req, res, next) => {
  try {
    const requests = await networkService.getPendingRequestsForOrg(caller(req), req.user.orgMsp);
    res.json({ requests });
  } catch (err) { next(err); }
});

/**
 * GET /api/network/share-requests/ehr/:ehrId
 * All share requests for a specific EHR.
 */
router.get('/share-requests/ehr/:ehrId', authenticate, async (req, res, next) => {
  try {
    const requests = await networkService.getShareRequestsForEHR(caller(req), req.params.ehrId);
    res.json({ requests });
  } catch (err) { next(err); }
});

/**
 * POST /api/network/share-requests/:requestId/approve
 * Target org admin approves an incoming share request.
 */
router.post('/share-requests/:requestId/approve',
  authenticate,
  requireRole('hospital', 'doctor'),
  async (req, res, next) => {
    try {
      const result = await networkService.approveShareRequest(caller(req), req.params.requestId);
      res.json(result);
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/network/share-requests/:requestId/reject
 */
router.post('/share-requests/:requestId/reject',
  authenticate,
  requireRole('hospital', 'doctor'),
  async (req, res, next) => {
    try {
      const result = await networkService.rejectShareRequest(
        caller(req), req.params.requestId, req.body.reason || ''
      );
      res.json(result);
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/network/share-requests/:requestId/revoke
 */
router.post('/share-requests/:requestId/revoke',
  authenticate,
  requireRole('hospital', 'doctor'),
  async (req, res, next) => {
    try {
      const result = await networkService.revokeShareRequest(caller(req), req.params.requestId);
      res.json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;
