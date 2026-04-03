// backend/src/services/storageService.js
// Abstracts file storage — uses IPFS by default, falls back to AWS S3

const { create } = require('ipfs-http-client');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto  = require('crypto');
const { Readable } = require('stream');

// ── IPFS client (local Kubo node or Infura) ────────────────────────────────
function createIPFSClient() {
  const host   = process.env.IPFS_HOST   || 'localhost';
  const port   = process.env.IPFS_PORT   || '5001';
  const proto  = process.env.IPFS_PROTO  || 'http';

  if (process.env.IPFS_PROJECT_ID) {
    // Infura IPFS
    const auth = 'Basic ' + Buffer.from(
      `${process.env.IPFS_PROJECT_ID}:${process.env.IPFS_PROJECT_SECRET}`
    ).toString('base64');
    return create({ host: 'ipfs.infura.io', port: 5001, protocol: 'https',
      headers: { authorization: auth } });
  }

  return create({ host, port: parseInt(port), protocol: proto });
}

// ── AWS S3 client ─────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const S3_BUCKET = process.env.S3_BUCKET || 'ehr-healthcare-bucket';

// ── Encryption helpers ─────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';

/**
 * encryptBuffer — Encrypt file bytes before storing off-chain.
 * Returns { encryptedBuffer, key (hex), iv (hex), authTag (hex) }
 */
function encryptBuffer(buffer) {
  const key = crypto.randomBytes(32);      // 256-bit symmetric key
  const iv  = crypto.randomBytes(12);      // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedBuffer: encrypted,
    key:     key.toString('hex'),
    iv:      iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * decryptBuffer — Reverse of encryptBuffer.
 */
function decryptBuffer(encryptedBuffer, keyHex, ivHex, authTagHex) {
  const key     = Buffer.from(keyHex,     'hex');
  const iv      = Buffer.from(ivHex,      'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

// ── Public API ─────────────────────────────────────────────────────────────

class StorageService {
  constructor() {
    this.ipfs = createIPFSClient();
  }

  /**
   * uploadToIPFS — Encrypts the file and pins it to IPFS.
   *
   * @param   {Buffer} fileBuffer
   * @returns {{ ipfsHash, encryptionMeta }}
   *   ipfsHash       — store this on the blockchain
   *   encryptionMeta — key/iv/authTag — encrypt this with the patient's public key
   *                    before storing anywhere persistent
   */
  async uploadToIPFS(fileBuffer) {
    const { encryptedBuffer, key, iv, authTag } = encryptBuffer(fileBuffer);

    const { cid } = await this.ipfs.add(encryptedBuffer, { pin: true });
    const ipfsHash = cid.toString();

    return {
      ipfsHash,
      encryptionMeta: { key, iv, authTag },
    };
  }

  /**
   * downloadFromIPFS — Fetch and decrypt a file from IPFS.
   *
   * @param   {string} ipfsHash
   * @param   {object} encryptionMeta  { key, iv, authTag }
   * @returns {Buffer}
   */
  async downloadFromIPFS(ipfsHash, encryptionMeta) {
    const chunks = [];
    for await (const chunk of this.ipfs.cat(ipfsHash)) {
      chunks.push(chunk);
    }
    const encryptedBuffer = Buffer.concat(chunks);
    return decryptBuffer(
      encryptedBuffer,
      encryptionMeta.key,
      encryptionMeta.iv,
      encryptionMeta.authTag,
    );
  }

  /**
   * uploadToS3 — Backup / fallback storage.
   * Stores the already-encrypted buffer so S3 never holds plaintext.
   *
   * @returns {{ s3Key, etag }}
   */
  async uploadToS3(encryptedBuffer, s3Key, mimeType = 'application/octet-stream') {
    const command = new PutObjectCommand({
      Bucket:      S3_BUCKET,
      Key:         s3Key,
      Body:        encryptedBuffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',  // S3 at-rest encryption on top
    });
    const result = await s3.send(command);
    return { s3Key, etag: result.ETag };
  }

  /**
   * getS3SignedUrl — Pre-signed URL (expires in 15 min) for frontend download.
   */
  async getS3SignedUrl(s3Key) {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key });
    return getSignedUrl(s3, command, { expiresIn: 900 });
  }
}

module.exports = { StorageService, encryptBuffer, decryptBuffer };
