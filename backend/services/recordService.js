import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import { evaluateTransaction, submitTransaction } from "../fabric/index.js";
import { getFileFromIPFS, uploadFileToIPFS } from "../ipfs/index.js";
import Record from "../models/Record.js";
import TransferRequest from "../models/TransferRequest.js";
import User from "../models/User.js";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function removeFileIfExists(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function validateObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createHttpError(400, `${fieldName} must be a valid MongoDB ObjectId.`);
  }
}

export async function uploadPatientRecord({ file, body, user }) {
  if (!file) {
    throw createHttpError(400, "PDF file is required.");
  }

  const { patientId, hospitalId } = body;

  if (!patientId || !hospitalId) {
    throw createHttpError(400, "patientId and hospitalId are required.");
  }

  validateObjectId(patientId, "patientId");
  validateObjectId(hospitalId, "hospitalId");

  const record = new Record({
    patientId,
    cid: "PENDING", // placeholder until IPFS is done
    fileHash: "PENDING",
    filename: file.originalname,
    hospitalId,
    permissions: []
  });
  const recordId = record._id.toString();

  let ipfsResult;

  try {
    // compute SHA-256 hash of the plaintext PDF for integrity verification
    const fileBuffer = await fs.readFile(file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    ipfsResult = await uploadFileToIPFS(file.path, {
      filename: file.originalname,
      encryptedOutputPath: `${file.path}.enc`
    });

    let fabricResult;
    try {
      fabricResult = await submitTransaction(
        "uploadRecord",
        recordId,
        patientId,
        ipfsResult.cid,
        file.originalname,
        fileHash,
        hospitalId,
        user._id.toString()
      );
    } catch (error) {
      // If patient doesn't exist on ledger, auto-register them and retry
      if (error.message.includes("Patient") && error.message.includes("does not exist")) {
        console.log(`Auto-registering patient ${patientId} on Fabric...`);
        
        // We need the patient's name and email. Since the current user might be the patient 
        // (or a doctor uploading for them), we'll fetch the patient from DB if needed.
        const User = mongoose.model("User");
        const patientUser = await User.findById(patientId);
        
        if (!patientUser) {
          throw createHttpError(404, "Patient user not found in database.");
        }

        await submitTransaction(
          "registerPatient",
          patientId,
          patientUser.name || "Unknown",
          patientUser.email || "unknown@example.com",
          patientUser.gender || "Not Specified",
          patientUser.dateOfBirth ? new Date(patientUser.dateOfBirth).toISOString() : "Not Specified"
        );

        // Retry the original upload
        fabricResult = await submitTransaction(
          "uploadRecord",
          recordId,
          patientId,
          ipfsResult.cid,
          file.originalname,
          fileHash,
          hospitalId,
          user._id.toString()
        );
      } else {
        throw error;
      }
    }

    record.cid = ipfsResult.cid;
    record.fileHash = fileHash;
    await record.save();

    return {
      recordId,
      cid: ipfsResult.cid,
      filename: file.originalname,
      size: file.size,
      encrypted: true,
      fabric: fabricResult,
      record
    };
  } finally {
    await removeFileIfExists(file.path);
    await removeFileIfExists(ipfsResult?.encryptedPath);
  }
}

function canDoctorAccessRecord(record, doctorId, doctorHospitalId) {
  // 1. Explicit permission access (Manual Grant)
  if (Array.isArray(record.permissions)) {
    const now = Date.now();
    const hasGrant = record.permissions.some((p) => {
      if (!p) return false;
      const id = p.doctorId || p.doctor || "";
      if (String(id) !== String(doctorId)) return false;
      if (p.canView === false) return false;
      if (!p.expires) return true;
      const exp = new Date(p.expires).getTime();
      return !isNaN(exp) && exp > now;
    });
    if (hasGrant) return true;
  }

  // 2. Transfer Access
  if (record.activeTransferId === "COMPLETED" || record.status === "transferred") {
     if (doctorHospitalId && String(record.currentHospitalId) === String(doctorHospitalId)) {
       return true;
     }
  }

  return false;
}

function normalizeFabricRecord(result) {
  return result?.record || result;
}

export async function getAuthorizedPatientRecords({ patientId, user }) {
  if (!patientId) {
    throw createHttpError(400, "patientId is required.");
  }

  validateObjectId(patientId, "patientId");

  const doctorId = user._id.toString();
  const doctorHospitalId = user.hospitalId?.toString();
  
  let fabricRecords = [];
  try {
    fabricRecords = await evaluateTransaction("getPatientRecords", patientId);
    console.log(`[FABRIC] Successfully fetched ${fabricRecords?.length || 0} records from ledger.`);
  } catch (err) {
    console.warn(`[FABRIC WARNING] Ledger query failed: ${err.message}. Falling back to MongoDB sync.`);
    
    // Fallback: Fetch what we know from Mongo and try to verify each against the ledger individually
    const mongoRecords = await Record.find({ patientId });
    for (const mongoRec of mongoRecords) {
      try {
        const fabricRec = normalizeFabricRecord(await evaluateTransaction("getRecord", mongoRec._id.toString()));
        if (fabricRec) fabricRecords.push(fabricRec);
      } catch (innerErr) {
        // If even individual read fails, use the mongo data as a last resort (unverified)
        fabricRecords.push({
          ...mongoRec.toObject(),
          recordId: mongoRec._id.toString(),
          unverified: true
        });
      }
    }
  }

  const authorizedRecords = (Array.isArray(fabricRecords) ? fabricRecords : [])
    .map(normalizeFabricRecord)
    .filter((record) => canDoctorAccessRecord(record, doctorId, doctorHospitalId))
    .map((record) => ({
      recordId: record.recordId || record._id?.toString(),
      patientId: record.patientId,
      filename: record.filename,
      hospitalId: record.hospitalId,
      currentHospitalId: record.currentHospitalId || record.hospitalId,
      uploadedBy: record.uploadedBy || "Unknown",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      permissions: record.permissions || [],
      unverified: record.unverified || false
    }));

  return authorizedRecords;
}

export async function getAuthorizedRecordPdf({ recordId, user }) {
  if (!recordId) {
    throw createHttpError(400, "recordId is required.");
  }

  const doctorId = user._id.toString();
  const doctorHospitalId = user.hospitalId?.toString();
  const record = normalizeFabricRecord(await evaluateTransaction("readRecord", recordId));

  if (!record || record.docType !== "record") {
    throw createHttpError(404, "Medical record not found.");
  }

  const isPatientOwner = String(record.patientId) === String(user._id);
  const isAuthorizedDoctor = canDoctorAccessRecord(record, doctorId, doctorHospitalId);

  if (!isPatientOwner && !isAuthorizedDoctor) {
    throw createHttpError(403, "You are not authorized to view this medical record.");
  }

  const pdfBuffer = await getFileFromIPFS(record.cid);

  // verify SHA-256 of decrypted PDF matches on-chain fileHash (if present)
  if (record.fileHash) {
    const downloadedHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    if (String(downloadedHash) !== String(record.fileHash)) {
      throw createHttpError(500, "File integrity check failed: downloaded file hash does not match chain record.");
    }
  }

  return {
    recordId: record.recordId,
    patientId: record.patientId,
    filename: record.filename,
    cid: record.cid,
    fileHash: record.fileHash,
    pdfBuffer
  };
}

export async function grantDoctorAccess({ recordId, doctorId, user, canView = true, expires = "" }) {
  if (!recordId || !doctorId) {
    throw createHttpError(400, "recordId and doctorId are required.");
  }

  validateObjectId(doctorId, "doctorId");

  // Primary check using MongoDB since Fabric Query is currently unstable
  let record = await Record.findById(recordId);
  
  if (!record) {
    // Fallback: try to find by ID in case recordId is a CID or something else
    record = await Record.findOne({ recordId });
  }

  if (!record) {
    // If still not found, try Fabric one last time
    try {
      record = normalizeFabricRecord(await evaluateTransaction("readRecord", recordId));
    } catch (err) {
      console.error("Fabric read failed in grantDoctorAccess:", err.message);
      throw createHttpError(404, "Medical record not found in DB or Blockchain.");
    }
  }

  if (!record) {
    throw createHttpError(404, "Medical record not found.");
  }

  const patientOwnerId = String(record.patientId);
  const requesterId = String(user._id);

  if (patientOwnerId !== requesterId) {
    throw createHttpError(403, "Only the patient may grant access to this record.");
  }

  // Validate that the doctor belongs to the same hospital as the patient
  const User = mongoose.model("User");
  const doctorUser = await User.findById(doctorId);

  if (!doctorUser || doctorUser.role !== "doctor") {
    throw createHttpError(404, "Selected doctor not found.");
  }

  const patientHospitalId = user.hospitalId?.toString();
  const doctorHospitalId = doctorUser.hospitalId?.toString();

  if (!patientHospitalId || patientHospitalId !== doctorHospitalId) {
    throw createHttpError(403, "You can only grant access to doctors belonging to your associated hospital.");
  }

  // Retry loop for self-healing
  let fabricResult;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Grant access attempt ${attempt}...`);
      fabricResult = await submitTransaction(
        "grantAccess",
        recordId,
        doctorId,
        canView ? "true" : "false",
        expires || ""
      );
      // If we reach here, it worked!
      break; 
    } catch (error) {
      const mainMessage = (error.message || "").toLowerCase();
      const peerMessages = (error.responses || []).map(r => (r.response?.message || "").toLowerCase()).join(" ");
      const fullErrorText = `${mainMessage} ${peerMessages}`;
      
      console.log(`Checking for self-healing opportunities (Attempt ${attempt})...`);

      // 1. Fix Patient
      if (fullErrorText.includes("patient") && fullErrorText.includes("does not exist")) {
        console.log(`>>> SELF-HEALING: Missing Patient ${record.patientId} detected. Registering...`);
        const patientUser = await User.findById(record.patientId);
        if (patientUser) {
          await submitTransaction(
            "registerPatient",
            patientUser._id.toString(),
            patientUser.name || "Unknown",
            patientUser.email || "unknown@example.com",
            "N/A"
          );
          console.log(">>> SELF-HEALING: Patient registered. Retrying...");
          continue; // Try the loop again
        }
      }

      // 2. Fix Doctor
      if (fullErrorText.includes("doctor") && fullErrorText.includes("does not exist")) {
        console.log(`>>> SELF-HEALING: Missing Doctor ${doctorId} detected. Registering...`);
        const doctorUser = await User.findById(doctorId);
        if (doctorUser) {
          await submitTransaction(
            "registerDoctor",
            doctorUser._id.toString(),
            doctorUser.name || "Unknown Doctor",
            doctorUser.email || "doctor@example.com",
            doctorUser.hospitalId ? doctorUser.hospitalId.toString() : "N/A",
            doctorUser.licenseNumber || "N/A"
          );
          console.log(">>> SELF-HEALING: Doctor registered. Retrying...");
          continue;
        }
      }
      
      // 3. Fix Record
      if (fullErrorText.includes("record") && fullErrorText.includes("does not exist")) {
        console.log(`>>> SELF-HEALING: Missing Record ${recordId} detected. Re-syncing...`);
        try {
          await submitTransaction(
            "uploadRecord",
            recordId,
            record.patientId.toString(),
            record.cid,
            record.filename,
            record.fileHash,
            record.hospitalId.toString(),
            user._id.toString()
          );
        } catch (uploadError) {
          const uploadErrorText = (uploadError.message || "").toLowerCase() + 
            (uploadError.responses || []).map(r => (r.response?.message || "").toLowerCase()).join(" ");
          
          if (uploadErrorText.includes("patient") && uploadErrorText.includes("does not exist")) {
            console.log(`>>> SELF-HEALING: Record re-sync failed because Patient is also missing. Fixing Patient first...`);
            const patientUser = await User.findById(record.patientId);
            if (patientUser) {
              await submitTransaction(
                "registerPatient",
                patientUser._id.toString(),
                patientUser.name || "Unknown",
                patientUser.email || "unknown@example.com",
                patientUser.gender || "Not Specified",
                patientUser.dateOfBirth ? new Date(patientUser.dateOfBirth).toISOString() : "Not Specified"
              );
              console.log(">>> SELF-HEALING: Patient fixed. Retrying Record re-sync...");
              // Now try the record upload again
              await submitTransaction(
                "uploadRecord",
                recordId,
                record.patientId.toString(),
                record.cid,
                record.filename,
                record.fileHash,
                record.hospitalId.toString(),
                user._id.toString()
              );
            }
          } else {
            throw uploadError;
          }
        }
        console.log(">>> SELF-HEALING: Record re-synced. Retrying operation...");
        continue; // Try the loop again
      }

      // If we can't fix it or it's the last attempt, throw
      if (attempt === 3) {
        console.error(">>> SELF-HEALING: Exhausted retries or unfixable error.");
        throw error;
      }
      throw error; // Or throw immediately if not a missing data error
    }
  }

  // Update Mongo permissions if record exists locally (match by cid)
  const perm = {
    doctorId,
    canView: Boolean(canView),
    expires: expires ? new Date(expires) : null
  };

  // remove any existing permission for doctorId then add the new one
  await Record.findOneAndUpdate({ cid: record.cid }, { $pull: { permissions: { doctorId } } });

  const updatedRecord = await Record.findOneAndUpdate(
    { cid: record.cid },
    { $addToSet: { permissions: perm } },
    { new: true }
  );

  return { fabric: fabricResult, record: updatedRecord || null };
}

export async function revokeDoctorAccess({ recordId, doctorId, user }) {
  if (!recordId || !doctorId) {
    throw createHttpError(400, "recordId and doctorId are required.");
  }

  validateObjectId(doctorId, "doctorId");

  const record = normalizeFabricRecord(await evaluateTransaction("getRecord", recordId));

  if (!record || record.docType !== "record") {
    throw createHttpError(404, "Medical record not found.");
  }

  const patientOwnerId = String(record.patientId);
  const requesterId = String(user._id);

  if (patientOwnerId !== requesterId) {
    throw createHttpError(403, "Only the patient may revoke access to this record.");
  }


  const fabricResult = await submitTransaction("revokeAccess", recordId, doctorId);

  const updatedRecord = await Record.findOneAndUpdate(
    { cid: record.cid },
    { $pull: { permissions: { doctorId } } },
    { new: true }
  );

  return { fabric: fabricResult, record: updatedRecord || null };
}

export async function requestRecordTransfer({ recordId, patientId, fromHospital, toHospital, toDoctorId, user }) {
  if (!recordId || !patientId || !fromHospital || !toHospital) {
    throw createHttpError(400, "recordId, patientId, fromHospital and toHospital are required.");
  }

  validateObjectId(patientId, "patientId");
  validateObjectId(fromHospital, "fromHospital");
  validateObjectId(toHospital, "toHospital");

  const record = normalizeFabricRecord(await evaluateTransaction("getRecord", recordId));

  if (!record || record.docType !== "record") {
    throw createHttpError(404, "Medical record not found.");
  }

  const patientOwnerId = String(record.patientId);
  const requesterId = String(user._id);

  console.log(`[TRANSFER DEBUG] Owner: ${patientOwnerId}, Requester: ${requesterId}`);

  if (patientOwnerId !== requesterId) {
    console.error(`[TRANSFER ERROR] ID Mismatch! Owner: ${patientOwnerId}, Requester: ${requesterId}`);
    throw createHttpError(403, "Only the patient may request a transfer for this record.");
  }

  const transferId = new mongoose.Types.ObjectId().toString();

  const fabricResult = await submitTransaction(
    "requestTransfer",
    transferId,
    patientId,
    recordId,
    fromHospital,
    toHospital,
    requesterId
  );

  const tr = await TransferRequest.create({
    _id: transferId,
    patientId,
    recordId,
    fromHospital,
    toHospital,
    toDoctorId,
    status: "pending"
  });

  return { fabric: fabricResult, transferRequest: tr };
}

export async function approveRecordTransfer({ transferId, user }) {
  if (!transferId) throw createHttpError(400, "transferId is required.");

  const tr = await TransferRequest.findById(transferId);
  if (!tr) throw createHttpError(404, "Transfer request not found.");

  const isTarget = String(tr.toHospital) === String(user.hospitalId);
  const isAdmin = user.role === "admin";

  if (!isTarget && !isAdmin) {
    throw createHttpError(403, "Only the destination hospital (or a network admin) can approve this transfer.");
  }

  let fabricResult;
  try {
    fabricResult = await submitTransaction("approveTransfer", transferId, user._id.toString());
  } catch (err) {
    // Resilience: If blockchain says it's not pending, it might already be approved or completed
    if (err.message.includes("is not pending")) {
      const logs = await evaluateTransaction("getAuditLogs", transferId);
      const isApproved = (logs || []).some(l => l.record?.action === "APPROVE_TRANSFER" || l.action === "APPROVE_TRANSFER");
      const isCompleted = (logs || []).some(l => l.record?.action === "TRANSFER_RECORD" || l.action === "TRANSFER_RECORD");

      if (isCompleted) {
        console.log(`Transfer ${transferId} already completed. Syncing Mongo.`);
        await Record.findByIdAndUpdate(tr.recordId, { hospitalId: tr.toHospital });
        tr.status = "completed";
        await tr.save();
        return { fabric: logs, transferRequest: tr, synced: true };
      }

      if (isApproved) {
        console.log(`Transfer ${transferId} already approved. Syncing Mongo.`);
        tr.status = "approved";
        await tr.save();
        return { fabric: logs, transferRequest: tr, synced: true };
      }
    }
    throw err;
  }

  tr.status = "approved";
  await tr.save();

  return { fabric: fabricResult, transferRequest: tr };
}

export async function executeRecordTransfer({ transferId, user }) {
  if (!transferId) throw createHttpError(400, "transferId is required.");

  const tr = await TransferRequest.findById(transferId);
  if (!tr) throw createHttpError(404, "Transfer request not found.");

  if (tr.status !== "approved") {
    throw createHttpError(400, "Transfer must be approved before execution.");
  }

  // Either hospital involved, the patient, or a network admin can trigger the final move
  const isTarget = String(tr.toHospital) === String(user.hospitalId);
  const isSource = String(tr.fromHospital) === String(user.hospitalId);
  const isPatient = String(tr.patientId) === String(user._id);
  const isAdmin = user.role === "admin";

  if (!isTarget && !isSource && !isPatient && !isAdmin) {
    throw createHttpError(403, "Not authorized to execute this transfer.");
  }

  let fabricResult;
  try {
    fabricResult = await submitTransaction("transferRecord", transferId);
  } catch (err) {
    // Resilience: If blockchain says it's not approved, it might be a propagation delay or already completed
    if (err.message.includes("must be approved before transfer") || err.message.includes("does not exist")) {
      const ledgerState = await evaluateTransaction("readTransferRequest", transferId);
      console.log("RESILIENCE DEBUG - LedgerState:", JSON.stringify(ledgerState, null, 2));

      if (ledgerState && ledgerState.status === "completed") {
        console.log(`Transfer ${transferId} already completed on ledger. Syncing Mongo.`);
        await Record.findByIdAndUpdate(tr.recordId, { hospitalId: tr.toHospital });
        tr.status = "completed";
        await tr.save();
        return { fabric: ledgerState, transferRequest: tr, synced: true };
      }

      if (ledgerState && ledgerState.status === "approved") {
        console.log(`Transfer ${transferId} approved on ledger. Syncing and retrying...`);
        if (tr.status === "pending") {
          tr.status = "approved";
          await tr.save();
        }
        // Wait 1s for ledger to settle then retry execution once
        console.log("Waiting 1s for blockchain to settle...");
        await new Promise(r => setTimeout(r, 1000));
        return await executeRecordTransfer({ transferId, user });
      }
    }
    throw err;
  }

  // Update MongoDB Record state
  await Record.findByIdAndUpdate(tr.recordId, {
    hospitalId: tr.toHospital
  });

  // Update MongoDB User (Patient) affiliation
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(tr.patientId, {
    hospitalId: tr.toHospital
  });

  tr.status = "completed";
  await tr.save();

  return { fabric: fabricResult, transferRequest: tr };
}

export async function listPendingTransfers({ hospitalId, patientId }) {
  let queryIncoming = { status: { $in: ["pending", "approved"] } };
  let queryOutgoing = { status: { $in: ["pending", "approved"] } };

  if (patientId) {
    // For patients, show all their requests regardless of status so they can track progress
    queryIncoming = { patientId };
    queryOutgoing = { patientId };
  } else if (hospitalId) {
    queryIncoming.toHospital = hospitalId;
    queryOutgoing.fromHospital = hospitalId;
  }

  const incoming = await TransferRequest.find(queryIncoming)
    .populate("patientId", "name email")
    .populate("fromHospital", "name")
    .populate("toHospital", "name")
    .populate("toDoctorId", "name")
    .sort({ createdAt: -1 })
    .lean();
  
  const outgoing = await TransferRequest.find(queryOutgoing)
    .populate("patientId", "name email")
    .populate("fromHospital", "name")
    .populate("toHospital", "name")
    .sort({ createdAt: -1 })
    .lean();

  return { incoming, outgoing };
}

export async function getPatientRecords({ patientId }) {
  if (!patientId) {
    throw createHttpError(400, "patientId is required.");
  }

  validateObjectId(patientId, "patientId");

  // Bypassing CouchDB selector query by using MongoDB IDs to fetch records individually from Fabric
  const mongoRecords = await Record.find({ patientId });
  console.log(`FETCH DEBUG - Found ${mongoRecords.length} records in MongoDB for patient ${patientId}`);
  const results = [];

  for (const mongoRec of mongoRecords) {
    try {
      // Fetch the actual ledger state for each record ID we know about
      const fabricRecord = normalizeFabricRecord(await evaluateTransaction("readRecord", mongoRec._id.toString()));
      if (fabricRecord) {
        results.push({
          recordId: fabricRecord.recordId || mongoRec._id.toString(),
          patientId: fabricRecord.patientId,
          filename: fabricRecord.filename,
          cid: fabricRecord.cid,
          hospitalId: fabricRecord.hospitalId,
          currentHospitalId: fabricRecord.currentHospitalId,
          uploadedBy: fabricRecord.uploadedBy,
          createdAt: fabricRecord.createdAt,
          updatedAt: fabricRecord.updatedAt,
          permissions: fabricRecord.permissions || []
        });
      } else {
        console.log(`FETCH DEBUG - Fabric returned null for record ${mongoRec._id}. Using fallback.`);
        throw new Error("Fabric record empty");
      }
    } catch (err) {
      console.warn(`FETCH DEBUG - Could not fetch record ${mongoRec._id} from Fabric:`, err.message);
      // Fallback to Mongo data if Fabric fetch fails
      results.push({
        recordId: mongoRec._id.toString(),
        patientId: mongoRec.patientId,
        filename: mongoRec.filename,
        cid: mongoRec.cid,
        hospitalId: mongoRec.hospitalId,
        currentHospitalId: mongoRec.hospitalId,
        uploadedBy: "Unknown (Ledger Syncing)",
        createdAt: mongoRec.createdAt,
        updatedAt: mongoRec.updatedAt,
        permissions: mongoRec.permissions || []
      });
    }
  }

  return results;
}

export async function getAuditLogs(entityId = "") {
  try {
    // Fetch audit logs from Fabric. If entityId is provided, it filters for that specific record/user.
    const logs = await evaluateTransaction("getAuditLogs", entityId || "");
    
    // Fabric returns an array of objects: { key: ..., record: { docType: 'auditLog', ... } }
    return (Array.isArray(logs) ? logs : []).map(l => l.record || l);
  } catch (error) {
    console.warn(`[FABRIC WARNING] Audit logs unavailable: ${error.message}`);
    return [];
  }
}
