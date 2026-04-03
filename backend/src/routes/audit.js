// backend/src/routes/audit.js — Audit trail
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { withFabric } = require('../services/fabricService');
const router = express.Router();

// GET /api/audit/:ehrId
router.get('/:ehrId', authenticate, async (req, res, next) => {
  try {
    const history = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('getAccessHistory', req.params.ehrId);
    });
    res.json({ ehrId: req.params.ehrId, history });
  } catch (err) { next(err); }
});

module.exports = router;
