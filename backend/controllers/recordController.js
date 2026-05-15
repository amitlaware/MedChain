import {
  getAuthorizedPatientRecords,
  getAuthorizedRecordPdf,
  uploadPatientRecord,
  grantDoctorAccess,
  revokeDoctorAccess,
  requestRecordTransfer,
  approveRecordTransfer,
  executeRecordTransfer,
  listPendingTransfers,
  getAuditLogs
} from "../services/recordService.js";

import Record from "../models/Record.js";
import { getPatientRecords } from "../services/recordService.js";

export async function uploadRecord(req, res, next) {
  try {
    const result = await uploadPatientRecord({
      file: req.file,
      body: req.body,
      user: req.user
    });

    res.status(201).json({
      message: "Medical record uploaded successfully.",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function listAuthorizedPatientRecords(req, res, next) {
  try {
    const records = await getAuthorizedPatientRecords({
      patientId: req.params.patientId,
      user: req.user
    });

    res.json({
      message: "Authorized patient records retrieved successfully.",
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function viewRecordPdf(req, res, next) {
  try {
    const result = await getAuthorizedRecordPdf({
      recordId: req.params.recordId,
      user: req.user
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(result.filename)}"`
    );
    res.send(result.pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function grantAccess(req, res, next) {
  try {
    const { doctorId, canView = true, expires = "" } = req.body;
    const result = await grantDoctorAccess({ recordId: req.params.recordId, doctorId, canView, expires, user: req.user });

    res.json({ message: "Access granted.", data: result });
  } catch (error) {
    next(error);
  }
}

export async function revokeAccess(req, res, next) {
  try {
    const { doctorId } = req.body;
    const result = await revokeDoctorAccess({ recordId: req.params.recordId, doctorId, user: req.user });

    res.json({ message: "Access revoked.", data: result });
  } catch (error) {
    next(error);
  }
}

export async function approveTransfer(req, res, next) {
  try {
    const result = await approveRecordTransfer({ transferId: req.params.transferId, user: req.user });
    res.json({ message: "Transfer request approved.", data: result });
  } catch (error) {
    next(error);
  }
}

export async function executeTransfer(req, res, next) {
  try {
    const result = await executeRecordTransfer({ transferId: req.params.transferId, user: req.user });
    res.json({ message: "Record transferred successfully.", data: result });
  } catch (error) {
    next(error);
  }
}

export async function listTransfers(req, res, next) {
  try {
    const filter = req.user.role === "patient" 
      ? { patientId: req.user._id.toString() } 
      : { hospitalId: req.user.hospitalId };

    const result = await listPendingTransfers(filter);
    res.json({ message: "Transfers retrieved.", data: result });
  } catch (error) {
    next(error);
  }
}

export async function fetchAuditLogs(req, res, next) {
  try {
    const { entityId } = req.query;
    const logs = await getAuditLogs(entityId);
    res.json({ message: "Audit logs retrieved.", data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getMyRecords(req, res, next) {
  try {
    const records = await getPatientRecords({ patientId: req.user._id.toString() });

    res.json({ message: "My records retrieved from Fabric.", data: records });
  } catch (error) {
    next(error);
  }
}

export async function requestTransfer(req, res, next) {
  try {
    const { fromHospital, toHospital, patientId, toDoctorId } = req.body;

    const result = await requestRecordTransfer({
      recordId: req.params.recordId,
      patientId,
      fromHospital,
      toHospital,
      toDoctorId,
      user: req.user
    });

    res.status(201).json({ message: "Transfer request created.", data: result });
  } catch (error) {
    next(error);
  }
}
