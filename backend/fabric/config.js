import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

function resolveFromBackend(value, fallback) {
  const target = value || fallback;

  if (path.isAbsolute(target)) {
    return target;
  }

  return path.resolve(backendRoot, target);
}

export function getFabricConfig() {
  return {
    channelName: process.env.FABRIC_CHANNEL_NAME || "ehr-channel",
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || "ehr",
    identityLabel: process.env.FABRIC_IDENTITY_LABEL || "appUser",
    mspId: process.env.FABRIC_MSP_ID || "Org1MSP",
    connectionProfilePath: resolveFromBackend(
      process.env.FABRIC_CONNECTION_PROFILE,
      "fabric/connection-org1.json"
    ),
    walletPath: resolveFromBackend(process.env.FABRIC_WALLET_PATH, "fabric/wallet"),
    certPath: process.env.FABRIC_CERT_PATH || "",
    keyDirectory: process.env.FABRIC_KEY_DIRECTORY || "",
    discoveryEnabled: process.env.FABRIC_DISCOVERY_ENABLED !== "false",
    discoveryAsLocalhost: process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== "false"
  };
}
