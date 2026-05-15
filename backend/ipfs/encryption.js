import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret = process.env.IPFS_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("IPFS_ENCRYPTION_KEY is required for encrypted IPFS storage.");
  }

  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.from(
    JSON.stringify({
      version: 1,
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      data: encrypted.toString("base64")
    })
  );
}

export function decryptBuffer(encryptedPayload) {
  const payload = JSON.parse(Buffer.from(encryptedPayload).toString("utf8"));

  if (payload.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported IPFS encryption algorithm: ${payload.algorithm}`);
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final()
  ]);
}
