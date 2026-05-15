import express from "express";
import multer from "multer";
import {
  listAuthorizedPatientRecords,
  uploadRecord,
  viewRecordPdf,
  grantAccess,
  revokeAccess,
  getMyRecords,
  requestTransfer,
  approveTransfer,
  executeTransfer,
  listTransfers,
  fetchAuditLogs
} from "../controllers/recordController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";

const router = express.Router();

function handleUploadError(error, _req, res, next) {
  if (!error) {
    next();
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({ message: error.message });
    return;
  }

  res.status(400).json({ message: error.message || "Invalid upload." });
}

router.post(
  "/upload",
  protect,
  allowRoles("doctor", "admin", "patient"),
  uploadPdf.single("file"),
  handleUploadError,
  uploadRecord
);

router.get(
  "/me",
  protect,
  allowRoles("patient"),
  getMyRecords
);

router.get(
  "/patient/:patientId",
  protect,
  allowRoles("doctor"),
  listAuthorizedPatientRecords
);

router.get(
  "/:recordId/pdf",
  protect,
  allowRoles("doctor", "patient"),
  viewRecordPdf
);

router.post(
  "/:recordId/grant",
  protect,
  allowRoles("patient"),
  express.json(),
  grantAccess
);

router.post(
  "/:recordId/revoke",
  protect,
  allowRoles("patient"),
  express.json(),
  revokeAccess
);

router.post(
  "/:recordId/transfer-request",
  protect,
  allowRoles("patient"),
  express.json(),
  requestTransfer
);

router.get(
  "/transfers/list",
  protect,
  allowRoles("doctor", "admin", "patient"),
  listTransfers
);

router.post(
  "/transfers/:transferId/approve",
  protect,
  allowRoles("doctor", "admin"),
  approveTransfer
);

router.post(
  "/transfers/:transferId/execute",
  protect,
  allowRoles("doctor", "admin", "patient"),
  executeTransfer
);

router.get(
  "/audit",
  protect,
  fetchAuditLogs
);

export default router;
