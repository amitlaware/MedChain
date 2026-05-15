"use strict";

const { Contract } = require("fabric-contract-api");

class EhrContract extends Contract {
  async registerPatient(ctx, patientId, name, email, gender, dob) {
    this._requireArgs({ patientId, name, email, gender, dob });

    const key = this._patientKey(patientId);
    await this._assertDoesNotExist(ctx, key, `Patient ${patientId} already exists`);

    const patient = {
      docType: "patient",
      patientId,
      name,
      email,
      gender,
      dob,
      createdAt: this._txTimestamp(ctx),
      updatedAt: this._txTimestamp(ctx)
    };

    await this._putJSON(ctx, key, patient);
    await this._addAuditLog(ctx, "REGISTER_PATIENT", "patient", patientId, { name });

    return JSON.stringify(patient);
  }

  async registerDoctor(ctx, doctorId, name, email, hospitalId, licenseNumber) {
    this._requireArgs({ doctorId, name, email, hospitalId });

    const key = this._doctorKey(doctorId);
    await this._assertDoesNotExist(ctx, key, `Doctor ${doctorId} already exists`);

    const doctor = {
      docType: "doctor",
      doctorId,
      name,
      email,
      hospitalId,
      licenseNumber,
      createdAt: this._txTimestamp(ctx),
      updatedAt: this._txTimestamp(ctx)
    };

    await this._putJSON(ctx, key, doctor);
    await this._addAuditLog(ctx, "REGISTER_DOCTOR", "doctor", doctorId, { hospitalId });

    return JSON.stringify(doctor);
  }

  async uploadRecord(ctx, recordId, patientId, cid, filename, fileHash, hospitalId, uploadedBy) {
    // Signature: uploadRecord(ctx, recordId, patientId, cid, filename, fileHash, hospitalId, uploadedBy)
    this._requireArgs({ recordId, patientId, cid, filename, fileHash, hospitalId, uploadedBy });

    const key = this._recordKey(recordId);
    await this._assertDoesNotExist(ctx, key, `Record ${recordId} already exists`);
    await this._assertExists(ctx, this._patientKey(patientId), `Patient ${patientId} does not exist`);

    const record = {
      docType: "record",
      recordId,
      patientId,
      cid,
      filename,
      fileHash,
      hospitalId,
      currentHospitalId: hospitalId,
      uploadedBy,
      permissions: [],
      accessLogs: [],
      activeTransferId: "",
      createdAt: this._txTimestamp(ctx),
      updatedAt: this._txTimestamp(ctx)
    };

    await this._putJSON(ctx, key, record);
    await this._addAuditLog(ctx, "UPLOAD_RECORD", "record", recordId, { patientId, hospitalId, cid, fileHash });

    return JSON.stringify(record);
  }

  async readRecord(ctx, recordId) {
    this._requireArgs({ recordId });

    const record = await this._getRequiredJSON(ctx, this._recordKey(recordId), `Record ${recordId} does not exist`);

    // append access log entry (who accessed and when)
    try {
      const actor = this._clientId(ctx);
      const timestamp = this._txTimestamp(ctx);

      record.accessLogs = record.accessLogs || [];
      record.accessLogs.push({ actor, timestamp });

      // persist updated record with access log
      record.updatedAt = timestamp;
      await this._putJSON(ctx, this._recordKey(recordId), record);

      // also add an audit log entry for read
      await this._addAuditLog(ctx, "READ_RECORD", "record", recordId, { actor, timestamp });
    } catch (err) {
      // non-fatal: do not block returning the record if logging fails
    }

    return JSON.stringify(record);
  }

  async getRecord(ctx, recordId) {
    this._requireArgs({ recordId });
    const record = await this._getRequiredJSON(ctx, this._recordKey(recordId), `Record ${recordId} does not exist`);
    return JSON.stringify(record);
  }

  async grantAccess(ctx, recordId, doctorId, canViewArg, expiresArg) {
    this._requireArgs({ recordId, doctorId });

    const canView = String(canViewArg) === "true";
    const expires = expiresArg || "";

    const record = await this._getRequiredJSON(ctx, this._recordKey(recordId), `Record ${recordId} does not exist`);
    await this._assertExists(ctx, this._doctorKey(doctorId), `Doctor ${doctorId} does not exist`);

    // ensure permissions is an array of objects
    record.permissions = record.permissions || [];

    const existing = record.permissions.find((p) => p.doctorId === doctorId || p.doctorId === String(doctorId));

    const permissionObj = {
      doctorId,
      canView,
      expires: expires || ""
    };

    if (existing) {
      // update existing permission
      existing.canView = permissionObj.canView;
      existing.expires = permissionObj.expires;
    } else {
      record.permissions.push(permissionObj);
    }

    record.updatedAt = this._txTimestamp(ctx);

    await this._putJSON(ctx, this._recordKey(recordId), record);
    await this._addAuditLog(ctx, "GRANT_ACCESS", "record", recordId, { doctorId, canView, expires: expires });

    return JSON.stringify(record);
  }

  async revokeAccess(ctx, recordId, doctorId) {
    this._requireArgs({ recordId, doctorId });

    const record = await this._getRequiredJSON(ctx, this._recordKey(recordId), `Record ${recordId} does not exist`);

    // support permission objects and legacy string IDs
    record.permissions = (record.permissions || []).filter((p) => {
      if (!p) return false;
      if (typeof p === "string") return p !== doctorId;
      return String(p.doctorId) !== String(doctorId);
    });

    record.updatedAt = this._txTimestamp(ctx);

    await this._putJSON(ctx, this._recordKey(recordId), record);
    await this._addAuditLog(ctx, "REVOKE_ACCESS", "record", recordId, { doctorId });

    return JSON.stringify(record);
  }

  async requestTransfer(ctx, transferId, patientId, recordId, fromHospital, toHospital, requestedBy) {
    this._requireArgs({ transferId, patientId, recordId, fromHospital, toHospital, requestedBy });

    if (fromHospital === toHospital) {
      throw new Error("fromHospital and toHospital must be different");
    }

    const key = this._transferKey(transferId);
    await this._assertDoesNotExist(ctx, key, `Transfer request ${transferId} already exists`);

    const record = await this._getRequiredJSON(ctx, this._recordKey(recordId), `Record ${recordId} does not exist`);

    if (record.patientId !== patientId) {
      throw new Error(`Record ${recordId} does not belong to patient ${patientId}`);
    }

    if (record.currentHospitalId !== fromHospital) {
      throw new Error(`Record ${recordId} is not currently assigned to hospital ${fromHospital}`);
    }

    const transferRequest = {
      docType: "transferRequest",
      transferId,
      patientId,
      recordId,
      fromHospital,
      toHospital,
      requestedBy,
      approvedBy: "",
      status: "pending",
      createdAt: this._txTimestamp(ctx),
      updatedAt: this._txTimestamp(ctx)
    };

    record.activeTransferId = transferId;
    record.updatedAt = this._txTimestamp(ctx);

    await this._putJSON(ctx, key, transferRequest);
    await this._putJSON(ctx, this._recordKey(recordId), record);
    await this._addAuditLog(ctx, "REQUEST_TRANSFER", "transferRequest", transferId, {
      patientId,
      recordId,
      fromHospital,
      toHospital
    });

    return JSON.stringify(transferRequest);
  }

  async readTransferRequest(ctx, transferId) {
    this._requireArgs({ transferId });
    const transferRequest = await this._getRequiredJSON(
      ctx,
      this._transferKey(transferId),
      `Transfer request ${transferId} does not exist`
    );
    return JSON.stringify(transferRequest);
  }

  async approveTransfer(ctx, transferId, approvedBy) {
    this._requireArgs({ transferId, approvedBy });

    const transferRequest = await this._getRequiredJSON(
      ctx,
      this._transferKey(transferId),
      `Transfer request ${transferId} does not exist`
    );

    if (transferRequest.status !== "pending") {
      throw new Error(`Transfer request ${transferId} is not pending`);
    }

    transferRequest.status = "approved";
    transferRequest.approvedBy = approvedBy;
    transferRequest.updatedAt = this._txTimestamp(ctx);

    await this._putJSON(ctx, this._transferKey(transferId), transferRequest);
    await this._addAuditLog(ctx, "APPROVE_TRANSFER", "transferRequest", transferId, { approvedBy });

    return JSON.stringify(transferRequest);
  }

  async transferRecord(ctx, transferId) {
    this._requireArgs({ transferId });

    const transferRequest = await this._getRequiredJSON(
      ctx,
      this._transferKey(transferId),
      `Transfer request ${transferId} does not exist`
    );

    if (transferRequest.status !== "approved") {
      throw new Error(`Transfer request ${transferId} must be approved before transfer`);
    }

    const record = await this._getRequiredJSON(
      ctx,
      this._recordKey(transferRequest.recordId),
      `Record ${transferRequest.recordId} does not exist`
    );

    record.currentHospitalId = transferRequest.toHospital;
    record.hospitalId = transferRequest.toHospital;
    record.activeTransferId = "COMPLETED";
    record.updatedAt = this._txTimestamp(ctx);

    transferRequest.status = "completed";
    transferRequest.updatedAt = this._txTimestamp(ctx);

    await this._putJSON(ctx, this._recordKey(record.recordId), record);
    await this._putJSON(ctx, this._transferKey(transferId), transferRequest);
    await this._addAuditLog(ctx, "TRANSFER_RECORD", "record", record.recordId, {
      transferId,
      fromHospital: transferRequest.fromHospital,
      toHospital: transferRequest.toHospital
    });

    return JSON.stringify({ transferRequest, record });
  }

  async getPatientRecords(ctx, patientId) {
    this._requireArgs({ patientId });

    const query = {
      selector: {
        docType: "record",
        patientId
      }
    };

    try {
      return JSON.stringify(await this._query(ctx, query));
    } catch (err) {
      // Fallback: If selector query fails (e.g. index not ready), manually filter
      const results = [];
      const iterator = await ctx.stub.getStateByRange("", "");
      
      try {
        while (true) {
          const result = await iterator.next();
          if (result.value) {
            const strValue = result.value.value.toString("utf8");
            let record;
            try {
              record = JSON.parse(strValue);
            } catch (e) { continue; }

            if (record.docType === "record" && record.patientId === patientId) {
              results.push({
                key: result.value.key,
                record
              });
            }
          }
          if (result.done) break;
        }
      } finally {
        await iterator.close();
      }
      return JSON.stringify(results);
    }
  }

  async getAuditLogs(ctx, entityId = "") {
    const selector = {
      docType: "auditLog"
    };

    if (entityId) {
      selector.entityId = entityId;
    }

    return JSON.stringify(await this._query(ctx, { selector }));
  }

  async _query(ctx, query) {
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results = [];

    try {
      while (true) {
        const result = await iterator.next();

        if (result.value) {
          results.push({
            key: result.value.key,
            record: JSON.parse(result.value.value.toString("utf8"))
          });
        }

        if (result.done) {
          return results;
        }
      }
    } finally {
      await iterator.close();
    }
  }

  async _addAuditLog(ctx, action, entityType, entityId, details = {}) {
    const txId = ctx.stub.getTxID();
    const key = this._auditKey(txId, action);
    const auditLog = {
      docType: "auditLog",
      txId,
      action,
      entityType,
      entityId,
      actor: this._clientId(ctx),
      details,
      timestamp: this._txTimestamp(ctx)
    };

    await this._putJSON(ctx, key, auditLog);
  }

  async _assertExists(ctx, key, message) {
    const buffer = await ctx.stub.getState(key);

    if (!buffer || buffer.length === 0) {
      throw new Error(message);
    }
  }

  async _assertDoesNotExist(ctx, key, message) {
    const buffer = await ctx.stub.getState(key);

    if (buffer && buffer.length > 0) {
      throw new Error(message);
    }
  }

  async _getRequiredJSON(ctx, key, message) {
    const buffer = await ctx.stub.getState(key);

    if (!buffer || buffer.length === 0) {
      throw new Error(message);
    }

    return JSON.parse(buffer.toString("utf8"));
  }

  async _putJSON(ctx, key, value) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(value)));
  }

  _requireArgs(args) {
    for (const [name, value] of Object.entries(args)) {
      if (value === undefined || value === null || String(value).trim() === "") {
        throw new Error(`${name} is required`);
      }
    }
  }

  _txTimestamp(ctx) {
    const timestamp = ctx.stub.getTxTimestamp();
    const milliseconds = timestamp.seconds.low * 1000 + Math.floor(timestamp.nanos / 1000000);
    return new Date(milliseconds).toISOString();
  }

  _clientId(ctx) {
    return ctx.clientIdentity.getID();
  }

  _patientKey(patientId) {
    return `PATIENT_${patientId}`;
  }

  _doctorKey(doctorId) {
    return `DOCTOR_${doctorId}`;
  }

  _recordKey(recordId) {
    return `RECORD_${recordId}`;
  }

  _transferKey(transferId) {
    return `TRANSFER_${transferId}`;
  }

  _auditKey(txId, action) {
    return `AUDIT_${txId}_${action}`;
  }
}

module.exports = EhrContract;
