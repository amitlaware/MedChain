// backend/src/services/networkService.js
// Wraps all org-registry chaincode calls

const { withFabric } = require('./fabricService');

const ORG_REGISTRY_CC = process.env.ORG_REGISTRY_CC || 'org-registry';

/**
 * NetworkService
 * Higher-level methods that combine Fabric SDK calls with local helpers.
 * All methods accept a caller { fabricId, orgMsp } so the right identity signs.
 */
class NetworkService {

  // ── Org CRUD ──────────────────────────────────────────────────────────────

  async registerOrg(caller, { orgId, orgName, orgType, contact, tlsCert, peerEndpoint }) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke(
        'registerOrg',
        orgId,
        orgName,
        orgType,
        JSON.stringify(contact),
        tlsCert || '',
        peerEndpoint || '',
        { chaincodeName: ORG_REGISTRY_CC }
      );
    });
  }

  async getAllOrgs(caller) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.query('getAllOrgs', { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async getOrg(caller, orgId) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.query('getOrg', orgId, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async getOrgsByType(caller, orgType) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.query('getOrgsByType', orgType, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async approveOrg(caller, orgId, threshold = 2) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke('approveOrg', orgId, String(threshold), { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async updateOrgStatus(caller, orgId, status) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke('updateOrgStatus', orgId, status, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  // ── Share requests ────────────────────────────────────────────────────────

  async createShareRequest(caller, { requestId, ehrId, fromOrgId, toOrgId, toUserId, reason, expiresAt }) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke(
        'createShareRequest',
        requestId,
        ehrId,
        fromOrgId,
        toOrgId,
        toUserId || 'any',
        reason,
        expiresAt || 'null',
        { chaincodeName: ORG_REGISTRY_CC }
      );
    });
  }

  async approveShareRequest(caller, requestId) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke('approveShareRequest', requestId, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async rejectShareRequest(caller, requestId, reason) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke('rejectShareRequest', requestId, reason || '', { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async revokeShareRequest(caller, requestId) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.invoke('revokeShareRequest', requestId, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async getShareRequestsForEHR(caller, ehrId) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.query('getShareRequestsForEHR', ehrId, { chaincodeName: ORG_REGISTRY_CC });
    });
  }

  async getPendingRequestsForOrg(caller, orgId) {
    return withFabric(caller.fabricId, caller.orgMsp, async (fabric) => {
      return fabric.query('getPendingRequestsForOrg', orgId, { chaincodeName: ORG_REGISTRY_CC });
    });
  }
}

module.exports = new NetworkService();
