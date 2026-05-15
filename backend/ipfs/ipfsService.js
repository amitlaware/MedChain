import fs from "fs/promises";
import { decryptBuffer } from "./encryption.js";
import { ipfsClient } from "./ipfsClient.js";
import { encryptFile } from "../utils/fileCrypto.js";

function assertPdf(buffer, filename = "file") {
  const header = buffer.subarray(0, 5).toString("utf8");

  if (header !== "%PDF-") {
    throw new Error(`${filename} must be a PDF file.`);
  }
}

async function collectAsyncIterable(iterable) {
  const chunks = [];

  for await (const chunk of iterable) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function uploadFileToIPFS(filePath, options = {}) {
  const filename = options.filename || filePath;
  const fileBuffer = await fs.readFile(filePath);

  if (options.validatePdf !== false) {
    assertPdf(fileBuffer, filename);
  }

  const encryptedFile = await encryptFile(filePath, options.encryptedOutputPath, {
    validatePdf: options.validatePdf
  });
  const encryptedPayload = await fs.readFile(encryptedFile.outputPath);
  const result = await ipfsClient.add(
    {
      path: options.ipfsPath || `${filename}.enc`,
      content: encryptedPayload
    },
    {
      cidVersion: 1,
      pin: options.pin !== false
    }
  );

  const cid = result.cid.toString();

  // Automatically copy to MFS so it appears in IPFS Desktop Files tab
  try {
    const mfsPath = `/medical-records/${filename}.enc`;
    // Ensure directory exists
    await ipfsClient.files.mkdir("/medical-records", { parents: true }).catch(() => {});
    // Copy the CID to the MFS path
    await ipfsClient.files.cp(`/ipfs/${cid}`, mfsPath).catch((err) => {
      console.warn("MFS Copy warning (might already exist):", err.message);
    });
  } catch (mfsError) {
    console.error("Failed to copy to IPFS MFS:", mfsError.message);
  }

  return {
    cid,
    size: result.size,
    filename,
    encryptedPath: encryptedFile.outputPath,
    encrypted: true
  };
}

export async function getFileFromIPFS(cid) {
  if (!cid) {
    throw new Error("CID is required.");
  }

  const encryptedPayload = await collectAsyncIterable(ipfsClient.cat(cid));
  return decryptBuffer(encryptedPayload);
}
