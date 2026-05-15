import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { getFabricConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { Wallets } = require("fabric-network");

async function findPrivateKey(keyDirectory) {
  const files = await fs.readdir(keyDirectory);
  const keyFile = files.find((file) => file.endsWith("_sk") || file.endsWith(".pem"));

  if (!keyFile) {
    throw new Error(`No private key file found in ${keyDirectory}`);
  }

  return path.join(keyDirectory, keyFile);
}

export async function getWallet() {
  const { walletPath } = getFabricConfig();
  return Wallets.newFileSystemWallet(walletPath);
}

export async function identityExists(identityLabel) {
  const wallet = await getWallet();
  return Boolean(await wallet.get(identityLabel));
}

export async function importIdentityFromMsp(options = {}) {
  const config = getFabricConfig();
  const identityLabel = options.identityLabel || config.identityLabel;
  const mspId = options.mspId || config.mspId;
  const certPath = options.certPath || config.certPath;
  const keyDirectory = options.keyDirectory || config.keyDirectory;

  if (!certPath || !keyDirectory) {
    throw new Error("FABRIC_CERT_PATH and FABRIC_KEY_DIRECTORY are required to import a wallet identity.");
  }

  const wallet = await getWallet();
  const existingIdentity = await wallet.get(identityLabel);

  if (existingIdentity) {
    return existingIdentity;
  }

  console.log(`[WALLET] Importing identity: ${identityLabel}`);
  console.log(`[WALLET] Cert Path: ${certPath}`);
  console.log(`[WALLET] Key Dir: ${keyDirectory}`);

  try {
    const keyPath = await findPrivateKey(keyDirectory);
    console.log(`[WALLET] Private Key Path found: ${keyPath}`);

    const [certificate, privateKey] = await Promise.all([
      fs.readFile(certPath, "utf8"),
      fs.readFile(keyPath, "utf8")
    ]);

    const identity = {
      credentials: {
        certificate,
        privateKey
      },
      mspId,
      type: "X.509"
    };

    await wallet.put(identityLabel, identity);
    console.log(`[WALLET] Successfully imported identity: ${identityLabel}`);
    return identity;
  } catch (err) {
    console.error("[WALLET ERROR] Failed to import identity:", err.message);
    throw err;
  }
}
