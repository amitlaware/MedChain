// backend/src/routes/access.js — Grant/revoke access permissions
const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { withFabric } = require('../services/fabricService');
const router = express.Router();

// POST /api/access/grant
router.post('/grant', authenticate, async (req, res, next) => {
  try {
    const { ehrId, requesterId, requesterOrg, expiresAt } = req.body;
    if (!ehrId || !requesterId) return res.status(400).json({ error: 'ehrId and requesterId required' });

    const result = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.invoke('grantAccess', ehrId, requesterId, requesterOrg || '', expiresAt || 'null');
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/access/revoke
router.post('/revoke', authenticate, async (req, res, next) => {
  try {
    const { ehrId, requesterId } = req.body;
    if (!ehrId || !requesterId) return res.status(400).json({ error: 'ehrId and requesterId required' });

    const result = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.invoke('revokeAccess', ehrId, requesterId);
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/access/check?ehrId=&requesterId=
router.get('/check', authenticate, async (req, res, next) => {
  try {
    const { ehrId, requesterId } = req.query;
    const result = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('checkAccess', ehrId, requesterId);
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
