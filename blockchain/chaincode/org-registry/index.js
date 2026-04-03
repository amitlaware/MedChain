'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * OrgRegistryContract
 *
 * Ledger keys:
 *   ORG:{orgId}           → registered organization record
 *   ORG_INDEX             → sorted list of all orgIds
 *   SHARE_REQUEST:{reqId} → cross-org EHR share request
 *   SHARE_INDEX:{ehrId}   → list of reqIds for an EHR
 *
 * This chaincode is deployed to ehr-channel alongside ehr-chaincode.
 * It does NOT touch EHR data — it only governs which orgs exist
 * on the network and tracks cross-org sharing requests/approvals.
 */
class OrgRegistryContract extends Contract {

  // ── helpers ────────────────────────────────────────────────────────────────

  async _get(ctx, key) {
    const b = await ctx.stub.getState(key);
    return b && b.length ? JSON.parse(b.toString()) : null;
  }

  async _put(ctx, key, obj) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
  }

  _caller(ctx) {
    const cid = ctx.clientIdentity;
    return {
      mspId: cid.getMSPID(),
      id:    cid.getID(),
      role:  cid.getAttributeValue('role') || 'unknown',
    };
  }

  // ── 1. Register a new organisation ────────────────────────────────────────

  /**
   * registerOrg
   *
   * Called after the new org's peer has been added to the channel via
   * configtxlator / channel update. This records the org's metadata on-chain
   * so every other participant can discover and query it.
   *
   * @param {string} orgId       e.g. "Hospital2MSP"
   * @param {string} orgName     e.g. "City General Hospital"
   * @param {string} orgType     "hospital" | "doctor" | "patient" | "lab"
   * @param {string} contactJson JSON string {email, phone, address}
   * @param {string} tlsCert     PEM of the org's TLS CA cert (for mTLS)
   * @param {string} peerEndpoint  e.g. "peer0.hospital2.ehr.com:10051"
   */
  async registerOrg(ctx, orgId, orgName, orgType, contactJson, tlsCert, peerEndpoint) {
    const caller = this._caller(ctx);

    // Only existing peer orgs (any hospital admin) may register new orgs
    if (!['hospital', 'admin'].includes(caller.role)) {
      throw new Error(`Access denied: only hospital admins may register new organizations`);
    }

    const existing = await this._get(ctx, `ORG:${orgId}`);
    if (existing) throw new Error(`Organization ${orgId} is already registered`);

    const now = new Date().toISOString();
    const org = {
      orgId,
      orgName,
      orgType,
      contact:      JSON.parse(contactJson),
      tlsCert,
      peerEndpoint,
      status:       'active',        // active | suspended | removed
      registeredBy: caller.id,
      registeredAt: now,
      updatedAt:    now,
      approvedBy:   [],              // MSP IDs that have approved this org
      channelJoined: false,          // true once their peer is confirmed joined
    };

    await this._put(ctx, `ORG:${orgId}`, org);

    // Append to global index
    const idx = (await this._get(ctx, 'ORG_INDEX')) || { orgIds: [] };
    if (!idx.orgIds.includes(orgId)) idx.orgIds.push(orgId);
    await this._put(ctx, 'ORG_INDEX', idx);

    // Emit event so backend can react
    ctx.stub.setEvent('OrgRegistered', Buffer.from(JSON.stringify({ orgId, orgName, orgType })));

    return JSON.stringify({ success: true, orgId });
  }

  // ── 2. Get all registered orgs ────────────────────────────────────────────

  async getAllOrgs(ctx) {
    const idx = (await this._get(ctx, 'ORG_INDEX')) || { orgIds: [] };
    const orgs = [];
    for (const id of idx.orgIds) {
      const org = await this._get(ctx, `ORG:${id}`);
      if (org) orgs.push(org);
    }
    return JSON.stringify(orgs);
  }

  // ── 3. Get a single org ───────────────────────────────────────────────────

  async getOrg(ctx, orgId) {
    const org = await this._get(ctx, `ORG:${orgId}`);
    if (!org) throw new Error(`Organization ${orgId} not found`);
    return JSON.stringify(org);
  }

  // ── 4. Approve an org (multi-sig style) ──────────────────────────────────

  /**
   * approveOrg — existing org signs off on a new org.
   * Once approvalThreshold orgs approve, channelJoined is set true.
   */
  async approveOrg(ctx, orgId, approvalThreshold) {
    const caller = this._caller(ctx);
    const threshold = parseInt(approvalThreshold) || 2;

    const org = await this._get(ctx, `ORG:${orgId}`);
    if (!org) throw new Error(`Organization ${orgId} not found`);

    if (!org.approvedBy.includes(caller.mspId)) {
      org.approvedBy.push(caller.mspId);
    }

    if (org.approvedBy.length >= threshold) {
      org.channelJoined = true;
      org.status = 'active';
      ctx.stub.setEvent('OrgApproved', Buffer.from(JSON.stringify({ orgId, approvedBy: org.approvedBy })));
    }

    org.updatedAt = new Date().toISOString();
    await this._put(ctx, `ORG:${orgId}`, org);

    return JSON.stringify({ success: true, orgId, approvedBy: org.approvedBy, channelJoined: org.channelJoined });
  }

  // ── 5. Update org status ──────────────────────────────────────────────────

  async updateOrgStatus(ctx, orgId, newStatus) {
    const caller = this._caller(ctx);
    if (caller.role !== 'hospital') throw new Error('Access denied');

    const validStatuses = ['active', 'suspended', 'removed'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const org = await this._get(ctx, `ORG:${orgId}`);
    if (!org) throw new Error(`Organization ${orgId} not found`);

    org.status    = newStatus;
    org.updatedAt = new Date().toISOString();
    org.updatedBy = caller.id;

    await this._put(ctx, `ORG:${orgId}`, org);
    return JSON.stringify({ success: true, orgId, status: newStatus });
  }

  // ── 6. Create a cross-org EHR share request ───────────────────────────────

  /**
   * createShareRequest
   *
   * Hospital A wants to share patientX's EHR with Hospital B.
   * This records the intent on-chain. Hospital B's admin then
   * calls approveShareRequest to accept.
   *
   * @param {string} requestId   UUID
   * @param {string} ehrId       The EHR to share
   * @param {string} fromOrgId   Requester's MSP ID
   * @param {string} toOrgId     Target org MSP ID
   * @param {string} toUserId    Specific user at target org (or "any")
   * @param {string} reason      Clinical reason for share
   * @param {string} expiresAt   ISO date or "null"
   */
  async createShareRequest(ctx, requestId, ehrId, fromOrgId, toOrgId, toUserId, reason, expiresAt) {
    const caller = this._caller(ctx);

    // Verify target org is registered and active
    const targetOrg = await this._get(ctx, `ORG:${toOrgId}`);
    if (!targetOrg) throw new Error(`Target organization ${toOrgId} is not registered on this network`);
    if (targetOrg.status !== 'active') throw new Error(`Target organization ${toOrgId} is not active`);

    const now = new Date().toISOString();
    const req = {
      requestId,
      ehrId,
      fromOrgId,
      toOrgId,
      toUserId,
      reason,
      expiresAt:   expiresAt === 'null' ? null : expiresAt,
      status:      'pending',        // pending | approved | rejected | revoked
      requestedBy: caller.id,
      requestedAt: now,
      respondedAt: null,
      respondedBy: null,
    };

    await this._put(ctx, `SHARE_REQUEST:${requestId}`, req);

    // Index by EHR
    const shareIdx = (await this._get(ctx, `SHARE_INDEX:${ehrId}`)) || { requestIds: [] };
    if (!shareIdx.requestIds.includes(requestId)) shareIdx.requestIds.push(requestId);
    await this._put(ctx, `SHARE_INDEX:${ehrId}`, shareIdx);

    ctx.stub.setEvent('ShareRequested', Buffer.from(JSON.stringify({ requestId, ehrId, fromOrgId, toOrgId })));

    return JSON.stringify({ success: true, requestId });
  }

  // ── 7. Approve a share request ────────────────────────────────────────────

  async approveShareRequest(ctx, requestId) {
    const caller  = this._caller(ctx);
    const request = await this._get(ctx, `SHARE_REQUEST:${requestId}`);
    if (!request) throw new Error(`Share request ${requestId} not found`);

    // Only the target org can approve
    if (caller.mspId !== request.toOrgId) {
      throw new Error(`Access denied: only ${request.toOrgId} can approve this request`);
    }
    if (request.status !== 'pending') {
      throw new Error(`Request is already ${request.status}`);
    }

    request.status      = 'approved';
    request.respondedAt = new Date().toISOString();
    request.respondedBy = caller.id;

    await this._put(ctx, `SHARE_REQUEST:${requestId}`, request);

    ctx.stub.setEvent('ShareApproved', Buffer.from(JSON.stringify({
      requestId,
      ehrId:     request.ehrId,
      toOrgId:   request.toOrgId,
      toUserId:  request.toUserId,
    })));

    return JSON.stringify({ success: true, requestId, status: 'approved' });
  }

  // ── 8. Reject a share request ─────────────────────────────────────────────

  async rejectShareRequest(ctx, requestId, rejectReason) {
    const caller  = this._caller(ctx);
    const request = await this._get(ctx, `SHARE_REQUEST:${requestId}`);
    if (!request) throw new Error(`Share request ${requestId} not found`);

    if (caller.mspId !== request.toOrgId) {
      throw new Error(`Access denied: only ${request.toOrgId} can reject this request`);
    }

    request.status       = 'rejected';
    request.rejectReason = rejectReason;
    request.respondedAt  = new Date().toISOString();
    request.respondedBy  = caller.id;

    await this._put(ctx, `SHARE_REQUEST:${requestId}`, request);
    return JSON.stringify({ success: true, requestId, status: 'rejected' });
  }

  // ── 9. Revoke a previously approved share ─────────────────────────────────

  async revokeShareRequest(ctx, requestId) {
    const caller  = this._caller(ctx);
    const request = await this._get(ctx, `SHARE_REQUEST:${requestId}`);
    if (!request) throw new Error(`Share request ${requestId} not found`);

    // Either org can revoke
    if (caller.mspId !== request.fromOrgId && caller.mspId !== request.toOrgId) {
      throw new Error('Access denied: only the requesting or target org can revoke');
    }

    request.status     = 'revoked';
    request.revokedAt  = new Date().toISOString();
    request.revokedBy  = caller.id;

    await this._put(ctx, `SHARE_REQUEST:${requestId}`, request);

    ctx.stub.setEvent('ShareRevoked', Buffer.from(JSON.stringify({ requestId, ehrId: request.ehrId })));
    return JSON.stringify({ success: true, requestId, status: 'revoked' });
  }

  // ── 10. Get share requests for an EHR ────────────────────────────────────

  async getShareRequestsForEHR(ctx, ehrId) {
    const shareIdx = (await this._get(ctx, `SHARE_INDEX:${ehrId}`)) || { requestIds: [] };
    const requests = [];
    for (const id of shareIdx.requestIds) {
      const r = await this._get(ctx, `SHARE_REQUEST:${id}`);
      if (r) requests.push(r);
    }
    return JSON.stringify(requests);
  }

  // ── 11. Get pending share requests for an org ─────────────────────────────

  async getPendingRequestsForOrg(ctx, orgId) {
    // Range query over all SHARE_REQUEST keys
    const iterator = await ctx.stub.getStateByRange('SHARE_REQUEST:', 'SHARE_REQUEST;');
    const pending  = [];
    let result = await iterator.next();
    while (!result.done) {
      const req = JSON.parse(result.value.value.toString());
      if ((req.toOrgId === orgId || req.fromOrgId === orgId) && req.status === 'pending') {
        pending.push(req);
      }
      result = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(pending);
  }

  // ── 12. Query orgs by type ────────────────────────────────────────────────

  async getOrgsByType(ctx, orgType) {
    const idx  = (await this._get(ctx, 'ORG_INDEX')) || { orgIds: [] };
    const orgs = [];
    for (const id of idx.orgIds) {
      const org = await this._get(ctx, `ORG:${id}`);
      if (org && org.orgType === orgType && org.status === 'active') orgs.push(org);
    }
    return JSON.stringify(orgs);
  }
}

module.exports = OrgRegistryContract;
