'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * EHRContract — Chaincode for Electronic Health Records
 *
 * Stored on ledger:
 *   EHR:{ehrId}          → EHR metadata (no raw data — only IPFS hash)
 *   PATIENT:{patientId}  → Patient's list of EHR IDs
 *   ACCESS:{ehrId}:{requesterId} → Access grant record
 *   LOG:{ehrId}:{txId}   → Immutable access log entry
 */
class EHRContract extends Contract {

  // ─── Helper: read / write state ───────────────────────────────────────────

  async _getState(ctx, key) {
    const bytes = await ctx.stub.getState(key);
    if (!bytes || bytes.length === 0) return null;
    return JSON.parse(bytes.toString());
  }

  async _putState(ctx, key, obj) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
  }

  _caller(ctx) {
    // Returns { mspId, id, role } from the client identity
    const cid = ctx.clientIdentity;
    let role = cid.getAttributeValue('role');
    
    // Fallback: If wallet bypassed CA and imported static MSP certs, role will be undefined/unknown.
    // In that case, map the mspId directly to the expected role.
    if (!role || role === 'unknown') {
      const mspId = cid.getMSPID();
      if (mspId === 'HospitalMSP') role = 'hospital';
      else if (mspId === 'DoctorMSP') role = 'doctor';
      else if (mspId === 'PatientMSP') role = 'patient';
      else role = 'unknown';
    }

    return {
      mspId: cid.getMSPID(),
      id:    cid.getID(),
      role:  role,
    };
  }

  _getTxDate(ctx) {
    const ts = ctx.stub.getTxTimestamp();
    const seconds = ts.seconds.low !== undefined ? ts.seconds.low : ts.seconds;
    return new Date(seconds * 1000).toISOString();
  }

  // ─── 1. Upload EHR ────────────────────────────────────────────────────────

  /**
   * uploadEHR — Store EHR metadata on-chain; actual file lives on IPFS.
   *
   * @param {string} ehrId        Unique identifier for this record
   * @param {string} patientId    Patient's identifier
   * @param {string} ipfsHash     Content-addressed hash from IPFS
   * @param {string} recordType   e.g. "lab_result", "prescription", "imaging"
   * @param {string} encKey       Encrypted symmetric key (AES key encrypted with patient pubkey)
   * @param {string} metadata     JSON string with non-sensitive metadata (date, doctor, etc.)
   */
  async uploadEHR(ctx, ehrId, patientId, ipfsHash, recordType, encKey, metadata) {
    const caller = this._caller(ctx);

    // Only hospitals and doctors may upload records
    if (!['hospital', 'doctor'].includes(caller.role)) {
      throw new Error(`Access denied: role '${caller.role}' cannot upload EHR`);
    }

    // Prevent duplicate uploads
    const existing = await this._getState(ctx, `EHR:${ehrId}`);
    if (existing) {
      throw new Error(`EHR ${ehrId} already exists`);
    }

    const now = this._getTxDate(ctx);
    const ehr = {
      ehrId,
      patientId,
      ipfsHash,
      recordType,
      encKey,       // Symmetric key encrypted with patient's public key
      metadata: JSON.parse(metadata),
      uploadedBy:   caller.id,
      uploaderOrg:  caller.mspId,
      uploaderRole: caller.role,
      createdAt:    now,
      updatedAt:    now,
      status:       'active',
      // Content hash of IPFS hash for integrity verification
      hashChecksum: crypto.createHash('sha256').update(ipfsHash).digest('hex'),
    };

    await this._putState(ctx, `EHR:${ehrId}`, ehr);

    // Append to patient's index
    const patientKey = `PATIENT:${patientId}`;
    const patientIndex = (await this._getState(ctx, patientKey)) || { ehrIds: [] };
    if (!patientIndex.ehrIds.includes(ehrId)) {
      patientIndex.ehrIds.push(ehrId);
    }
    await this._putState(ctx, patientKey, patientIndex);

    // Auto-grant access to the uploader
    await this._putState(ctx, `ACCESS:${ehrId}:${caller.id}`, {
      ehrId,
      grantedTo:   caller.id,
      grantedToOrg: caller.mspId,
      grantedBy:   caller.id,
      role:        caller.role,
      grantedAt:   now,
      expiresAt:   null,
      active:      true,
    });

    // Log the upload event
    await this._appendLog(ctx, ehrId, caller, 'UPLOAD', `Uploaded EHR of type ${recordType}`);

    return JSON.stringify({ success: true, ehrId, ipfsHash });
  }

  // ─── 2. Grant Access ──────────────────────────────────────────────────────

  /**
   * grantAccess — Allow a specific identity to view an EHR.
   *
   * @param {string} ehrId        Record to share
   * @param {string} requesterId  Identity being granted access
   * @param {string} requesterOrg Their MSP ID
   * @param {string} expiresAt    ISO date string, or "null" for indefinite
   */
  async grantAccess(ctx, ehrId, requesterId, requesterOrg, expiresAt) {
    const caller = this._caller(ctx);

    const ehr = await this._getState(ctx, `EHR:${ehrId}`);
    if (!ehr) throw new Error(`EHR ${ehrId} not found`);

    // Only the patient or the uploading org can grant access
    const canGrant =
      caller.role === 'patient' ||
      caller.mspId === ehr.uploaderOrg ||
      caller.id === ehr.uploadedBy;

    if (!canGrant) {
      throw new Error(`Access denied: only the patient or uploading org may grant access`);
    }

    const accessKey = `ACCESS:${ehrId}:${requesterId}`;
    const now = this._getTxDate(ctx);

    const grant = {
      ehrId,
      grantedTo:    requesterId,
      grantedToOrg: requesterOrg,
      grantedBy:    caller.id,
      role:         caller.role,
      grantedAt:    now,
      expiresAt:    expiresAt === 'null' ? null : expiresAt,
      active:       true,
    };

    await this._putState(ctx, accessKey, grant);
    await this._appendLog(ctx, ehrId, caller, 'GRANT_ACCESS', `Granted access to ${requesterId}`);

    return JSON.stringify({ success: true, grantedTo: requesterId, ehrId });
  }

  // ─── 3. Revoke Access ─────────────────────────────────────────────────────

  async revokeAccess(ctx, ehrId, requesterId) {
    const caller = this._caller(ctx);

    const ehr = await this._getState(ctx, `EHR:${ehrId}`);
    if (!ehr) throw new Error(`EHR ${ehrId} not found`);

    const canRevoke =
      caller.role === 'patient' ||
      caller.mspId === ehr.uploaderOrg;

    if (!canRevoke) throw new Error(`Access denied: cannot revoke access`);

    const accessKey = `ACCESS:${ehrId}:${requesterId}`;
    const grant = await this._getState(ctx, accessKey);
    if (!grant) throw new Error(`No active grant found for ${requesterId} on ${ehrId}`);

    grant.active = false;
    grant.revokedAt = this._getTxDate(ctx);
    grant.revokedBy = caller.id;

    await this._putState(ctx, accessKey, grant);
    await this._appendLog(ctx, ehrId, caller, 'REVOKE_ACCESS', `Revoked access from ${requesterId}`);

    return JSON.stringify({ success: true, revokedFrom: requesterId, ehrId });
  }

  // ─── 4. View Record ───────────────────────────────────────────────────────

  /**
   * viewRecord — Return EHR metadata (including IPFS hash) if caller has access.
   * The frontend then fetches the encrypted file from IPFS and decrypts locally.
   */
  async viewRecord(ctx, ehrId) {
    const caller = this._caller(ctx);

    const ehr = await this._getState(ctx, `EHR:${ehrId}`);
    if (!ehr) throw new Error(`EHR ${ehrId} not found`);
    if (ehr.status === 'deleted') throw new Error(`EHR ${ehrId} has been deleted`);

    // Check access
    const accessKey = `ACCESS:${ehrId}:${caller.id}`;
    const grant = await this._getState(ctx, accessKey);
    const hasAccess = grant && grant.active && (
      !grant.expiresAt || new Date(grant.expiresAt) > new Date()
    );

    if (!hasAccess) {
      throw new Error(`Access denied: ${caller.id} does not have permission to view EHR ${ehrId}`);
    }

    // Log the view
    await this._appendLog(ctx, ehrId, caller, 'VIEW', `Record viewed`);

    return JSON.stringify(ehr);
  }

  // ─── 5. Get Patient Records ───────────────────────────────────────────────

  async getPatientRecords(ctx, patientId) {
    const caller = this._caller(ctx);

    // Patient can only view their own records
    if (caller.role === 'patient' && !caller.id.includes(patientId)) {
      throw new Error(`Access denied: patients may only view their own records`);
    }

    const patientIndex = await this._getState(ctx, `PATIENT:${patientId}`);
    if (!patientIndex) return JSON.stringify([]);

    const records = [];
    for (const ehrId of patientIndex.ehrIds) {
      const ehr = await this._getState(ctx, `EHR:${ehrId}`);
      if (ehr && ehr.status === 'active') {
        records.push(ehr);
      }
    }

    await this._appendLog(ctx, patientId, caller, 'LIST_RECORDS', `Listed records for patient`);
    return JSON.stringify(records);
  }

  // ─── 6. Check Access ──────────────────────────────────────────────────────

  async checkAccess(ctx, ehrId, requesterId) {
    const accessKey = `ACCESS:${ehrId}:${requesterId}`;
    const grant = await this._getState(ctx, accessKey);
    if (!grant || !grant.active) return JSON.stringify({ hasAccess: false });
    if (grant.expiresAt && new Date(grant.expiresAt) <= new Date(this._getTxDate(ctx))) {
      return JSON.stringify({ hasAccess: false, reason: 'expired' });
    }
    return JSON.stringify({ hasAccess: true, grant });
  }

  // ─── 7. Get Access History (Audit Trail) ──────────────────────────────────

  async getAccessHistory(ctx, ehrId) {
    const caller = this._caller(ctx);

    const ehr = await this._getState(ctx, `EHR:${ehrId}`);
    if (!ehr) throw new Error(`EHR ${ehrId} not found`);

    // Only uploader org or the patient can see full audit trail
    const canAudit =
      caller.mspId === ehr.uploaderOrg ||
      caller.role === 'patient';

    if (!canAudit) throw new Error(`Access denied: cannot view audit trail`);

    // Use GetHistoryForKey for full blockchain history of this EHR
    const iterator = await ctx.stub.getHistoryForKey(`EHR:${ehrId}`);
    const history = [];

    let result = await iterator.next();
    while (!result.done) {
      const h = result.value;
      history.push({
        txId:      h.txId,
        timestamp: new Date((h.timestamp.seconds.low !== undefined ? h.timestamp.seconds.low : h.timestamp.seconds) * 1000).toISOString(),
        isDelete:  h.isDelete,
        value:     h.value ? JSON.parse(h.value.toString()) : null,
      });
      result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(history);
  }

  // ─── 8. Soft-delete EHR ───────────────────────────────────────────────────

  async deleteEHR(ctx, ehrId) {
    const caller = this._caller(ctx);

    const ehr = await this._getState(ctx, `EHR:${ehrId}`);
    if (!ehr) throw new Error(`EHR ${ehrId} not found`);

    if (caller.mspId !== ehr.uploaderOrg) {
      throw new Error(`Only the uploading organization can delete this record`);
    }

    ehr.status = 'deleted';
    ehr.deletedAt = this._getTxDate(ctx);
    ehr.deletedBy = caller.id;
    ehr.updatedAt = this._getTxDate(ctx);

    await this._putState(ctx, `EHR:${ehrId}`, ehr);
    await this._appendLog(ctx, ehrId, caller, 'DELETE', `Record soft-deleted`);

    return JSON.stringify({ success: true, ehrId, status: 'deleted' });
  }

  // ─── Private: Append Audit Log ────────────────────────────────────────────

  async _appendLog(ctx, subjectId, caller, action, details) {
    const txId = ctx.stub.getTxID();
    const logKey = `LOG:${subjectId}:${txId}`;
    const log = {
      subjectId,
      action,
      details,
      actorId:   caller.id,
      actorOrg:  caller.mspId,
      actorRole: caller.role,
      txId,
      timestamp: this._getTxDate(ctx),
    };
    await this._putState(ctx, logKey, log);
  }
}

module.exports.EHRContract = EHRContract;
module.exports.contracts = [EHRContract];
