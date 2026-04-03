// backend/src/services/fabricService.js
// Wraps Hyperledger Fabric SDK calls — single source of truth for all chaincode interaction

const { Gateway, Wallets } = require('fabric-network');
const path  = require('path');
const fs    = require('fs');

const CHANNEL_NAME  = process.env.FABRIC_CHANNEL  || 'ehr-channel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE || 'ehr-chaincode';

// Path to the connection profile (generated during bootstrap)
const CONNECTION_PROFILE_PATH = path.resolve(
  __dirname, '../../..', 'blockchain', 'config', 'connection-profile.json'
);

/**
 * FabricService
 *
 * Usage:
 *   const fabric = new FabricService();
 *   await fabric.init();
 *   const result = await fabric.invoke('uploadEHR', ...args);
 */
class FabricService {
  constructor() {
    this.gateway = null;
    this.network = null;
    this.contract = null;
    this.wallet  = null;
  }

  // ── Initialize connection ──────────────────────────────────────────────────

  async init(userId, orgMsp) {
    const ccpJSON = fs.readFileSync(CONNECTION_PROFILE_PATH, 'utf8');
    const ccp = JSON.parse(ccpJSON);

    // Use a file-system wallet in dev; swap for HSM-backed wallet in production
    const walletPath = path.join(__dirname, '..', '..', 'wallet');
    this.wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check that the identity exists in the wallet
    const identity = await this.wallet.get(userId);
    if (!identity) {
      throw new Error(
        `Identity '${userId}' not found in wallet. ` +
        `Register the user first via /api/auth/register.`
      );
    }

    this.gateway = new Gateway();
    await this.gateway.connect(ccp, {
      wallet:           this.wallet,
      identity:         userId,
      discovery:        { enabled: true, asLocalhost: true },
      eventHandlerOptions: {
        commitTimeout:  300,
        strategy:       null,
      },
    });

    this.network  = await this.gateway.getNetwork(CHANNEL_NAME);
    this.contract = this.network.getContract(CHAINCODE_NAME);
    return this;
  }

  // ── Submit (write transaction) ─────────────────────────────────────────────

  async invoke(fcn, ...args) {
    if (!this.contract) throw new Error('FabricService not initialized. Call init() first.');
    const stringArgs = args.map(a => typeof a === 'string' ? a : JSON.stringify(a));
    const result = await this.contract.submitTransaction(fcn, ...stringArgs);
    return result.toString() ? JSON.parse(result.toString()) : null;
  }

  // ── Query (read-only) ──────────────────────────────────────────────────────

  async query(fcn, ...args) {
    if (!this.contract) throw new Error('FabricService not initialized. Call init() first.');
    const stringArgs = args.map(a => typeof a === 'string' ? a : JSON.stringify(a));
    const result = await this.contract.evaluateTransaction(fcn, ...stringArgs);
    return result.toString() ? JSON.parse(result.toString()) : null;
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async disconnect() {
    if (this.gateway) {
      await this.gateway.disconnect();
      this.gateway = null;
      this.network = null;
      this.contract = null;
    }
  }
}

// ── Convenience factory ────────────────────────────────────────────────────────
// Creates, inits, runs, and disconnects in one go
async function withFabric(userId, orgMsp, callback) {
  const fabric = new FabricService();
  try {
    await fabric.init(userId, orgMsp);
    return await callback(fabric);
  } finally {
    await fabric.disconnect();
  }
}

module.exports = { FabricService, withFabric };
