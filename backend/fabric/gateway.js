import { createRequire } from "module";
import { getFabricConfig } from "./config.js";
import { loadConnectionProfile } from "./connectionProfile.js";
import { getWallet, importIdentityFromMsp } from "./wallet.js";

const require = createRequire(import.meta.url);
const { Gateway } = require("fabric-network");

export async function connectGateway(options = {}) {
  const config = getFabricConfig();
  const identityLabel = options.identityLabel || config.identityLabel;
  const connectionProfilePath = options.connectionProfilePath || config.connectionProfilePath;
  const wallet = await getWallet();

  if (!(await wallet.get(identityLabel))) {
    await importIdentityFromMsp({ identityLabel });
  }

  try {
    const gateway = new Gateway();
    console.log(`[FABRIC] Loading profile: ${connectionProfilePath}`);
    const connectionProfile = await loadConnectionProfile(connectionProfilePath);

    console.log(`[FABRIC] Connecting to channel: ${config.channelName}`);
    
    await gateway.connect(connectionProfile, {
      wallet,
      identity: identityLabel,
      discovery: {
        enabled: config.discoveryEnabled,
        asLocalhost: config.discoveryAsLocalhost
      }
    });

    return gateway;
  } catch (error) {
    console.error("[FABRIC ERROR] Failed to connect to gateway:", error);
    throw error;
  }
}

export async function getContract(options = {}) {
  const config = getFabricConfig();
  const gateway = await connectGateway(options);
  const network = await gateway.getNetwork(options.channelName || config.channelName);
  const contract = network.getContract(options.chaincodeName || config.chaincodeName);

  return { gateway, network, contract };
}
