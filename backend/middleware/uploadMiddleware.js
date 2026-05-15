import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDirectory = path.resolve("uploads", "records");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".pdf";
    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 80);

    callback(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

function pdfFileFilter(_req, file, callback) {
  const isPdf =
    file.mimetype === "application/pdf" &&
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) {
    callback(new Error("Only PDF files are allowed."));
    return;
  }

  callback(null, true);
}

export const uploadPdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});
