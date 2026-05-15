import fs from "fs/promises";
import path from "path";
import { decryptBuffer, encryptBuffer } from "../ipfs/encryption.js";

function getEncryptedOutputPath(inputPath, outputPath) {
  return outputPath || `${inputPath}.enc`;
}

function getDecryptedOutputPath(inputPath, outputPath) {
  if (outputPath) {
    return outputPath;
  }

  if (inputPath.endsWith(".enc")) {
    return inputPath.slice(0, -4);
  }

  const parsedPath = path.parse(inputPath);
  return path.join(parsedPath.dir, `${parsedPath.name}.decrypted${parsedPath.ext}`);
}

function assertPdf(buffer, filename = "file") {
  const header = buffer.subarray(0, 5).toString("utf8");

  if (header !== "%PDF-") {
    throw new Error(`${filename} must be a PDF file.`);
  }
}

export async function encryptFile(inputPath, outputPath, options = {}) {
  const fileBuffer = await fs.readFile(inputPath);

  if (options.validatePdf !== false) {
    assertPdf(fileBuffer, inputPath);
  }

  const encryptedBuffer = encryptBuffer(fileBuffer);
  const encryptedPath = getEncryptedOutputPath(inputPath, outputPath);

  await fs.writeFile(encryptedPath, encryptedBuffer);

  return {
    inputPath,
    outputPath: encryptedPath,
    encrypted: true,
    bytesWritten: encryptedBuffer.length
  };
}

export async function decryptFile(inputPath, outputPath, options = {}) {
  const encryptedBuffer = await fs.readFile(inputPath);
  const decryptedBuffer = decryptBuffer(encryptedBuffer);

  if (options.validatePdf !== false) {
    assertPdf(decryptedBuffer, outputPath || inputPath);
  }

  const decryptedPath = getDecryptedOutputPath(inputPath, outputPath);

  await fs.writeFile(decryptedPath, decryptedBuffer);

  return {
    inputPath,
    outputPath: decryptedPath,
    encrypted: false,
    bytesWritten: decryptedBuffer.length
  };
}
