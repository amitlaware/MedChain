#!/bin/bash
# ============================================================
#  add-org.sh  — Add a brand-new organisation to ehr-channel
#
#  Usage:
#    ./add-org.sh Hospital2 hospital2 10051
#
#  Args:
#    $1  OrgName    e.g. Hospital2
#    $2  OrgDomain  e.g. hospital2   → hospital2.ehr.com
#    $3  PeerPort   e.g. 10051
# ============================================================
set -e

ORG_NAME=${1:-Hospital2}
ORG_DOMAIN=${2:-hospital2}
PEER_PORT=${3:-10051}
CAPORT=$(( PEER_PORT + 3 ))    # e.g. 10054
MSP_ID="${ORG_NAME}MSP"
FULL_DOMAIN="${ORG_DOMAIN}.ehr.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

info "Adding ${ORG_NAME} (${MSP_ID}) to ehr-channel..."
cd "$BLOCKCHAIN_DIR"

# ── Step 1: Generate crypto for the new org ────────────────────────────────
info "Step 1: Generating crypto material for ${ORG_NAME}..."

cat > /tmp/crypto-new-org.yaml << EOF
PeerOrgs:
  - Name: ${ORG_NAME}
    Domain: ${FULL_DOMAIN}
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 1
    CA:
      Hostname: ca
EOF

cryptogen extend --config=/tmp/crypto-new-org.yaml --input="./crypto-config"
info "Crypto material generated for ${ORG_NAME}."

# ── Step 2: Generate org definition JSON ──────────────────────────────────
info "Step 2: Generating org definition JSON..."

export FABRIC_CFG_PATH="$BLOCKCHAIN_DIR/config"

# Write a minimal configtx snippet for the new org
cat > /tmp/configtx-new-org.yaml << EOF
Organizations:
  - &${ORG_NAME}Org
    Name: ${MSP_ID}
    ID:   ${MSP_ID}
    MSPDir: ${BLOCKCHAIN_DIR}/crypto-config/peerOrganizations/${FULL_DOMAIN}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin','${MSP_ID}.peer','${MSP_ID}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin','${MSP_ID}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${MSP_ID}.peer')"
    AnchorPeers:
      - Host: peer0.${FULL_DOMAIN}
        Port: ${PEER_PORT}
EOF

# Print org definition using configtxgen
FABRIC_CFG_PATH=/tmp configtxgen \
  -printOrg ${ORG_NAME}Org \
  > ./channel-artifacts/${ORG_NAME}_definition.json 2>/dev/null || true

info "Org definition written to channel-artifacts/${ORG_NAME}_definition.json"

# ── Step 3: Fetch, decode, modify, re-encode channel config ────────────────
info "Step 3: Fetching current channel config block..."

docker exec cli peer channel fetch config \
  ./channel-artifacts/config_block.pb \
  -o orderer.ehr.com:7050 -c ehr-channel \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem

docker exec cli configtxlator proto_decode \
  --input ./channel-artifacts/config_block.pb \
  --type common.Block \
  --output /tmp/config_block.json

docker exec cli bash -c \
  "cat /tmp/config_block.json | jq '.data.data[0].payload.data.config' > /tmp/config.json"

info "Injecting ${ORG_NAME} definition into channel config..."

docker exec cli bash -c \
  "cat /tmp/config.json | jq \
    '.channel_group.groups.Application.groups.${MSP_ID} = $(cat ./channel-artifacts/${ORG_NAME}_definition.json)' \
    > /tmp/modified_config.json"

docker exec cli configtxlator proto_encode --input /tmp/config.json          --type common.Config --output /tmp/config.pb
docker exec cli configtxlator proto_encode --input /tmp/modified_config.json --type common.Config --output /tmp/modified_config.pb

docker exec cli configtxlator compute_update \
  --channel_id ehr-channel \
  --original  /tmp/config.pb \
  --updated   /tmp/modified_config.pb \
  --output    /tmp/config_update.pb

docker exec cli bash -c \
  "echo '{\"payload\":{\"header\":{\"channel_header\":{\"channel_id\":\"ehr-channel\",\"type\":2}},\"data\":{\"config_update\":'\$(configtxlator proto_decode --input /tmp/config_update.pb --type common.ConfigUpdate | jq .)'}}}' | jq . > /tmp/config_update_in_envelope.json"

docker exec cli configtxlator proto_encode \
  --input /tmp/config_update_in_envelope.json \
  --type  common.Envelope \
  --output ./channel-artifacts/${ORG_NAME}_update_in_envelope.pb

# ── Step 4: Sign by each existing org and submit ───────────────────────────
info "Step 4: Signing config update..."

for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    cli peer channel signconfigtx -f ./channel-artifacts/${ORG_NAME}_update_in_envelope.pb
  info "  Signed by ${MSP}"
done

info "Submitting channel update..."
docker exec cli peer channel update \
  -f ./channel-artifacts/${ORG_NAME}_update_in_envelope.pb \
  -c ehr-channel \
  -o orderer.ehr.com:7050 \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem

# ── Step 5: Start new org's containers ────────────────────────────────────
info "Step 5: Starting ${ORG_NAME} CA and peer containers..."

cat > /tmp/docker-compose-new-org.yaml << EOF
version: '3.7'
networks:
  ehr-network:
    external: true

services:
  ca-${ORG_DOMAIN}:
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-${ORG_DOMAIN}
      - FABRIC_CA_SERVER_PORT=${CAPORT}
      - FABRIC_CA_SERVER_TLS_ENABLED=true
    ports:
      - "${CAPORT}:${CAPORT}"
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ${BLOCKCHAIN_DIR}/crypto-config/peerOrganizations/${FULL_DOMAIN}/ca/:/etc/hyperledger/fabric-ca-server
    container_name: ca-${ORG_DOMAIN}
    networks:
      - ehr-network

  peer0.${FULL_DOMAIN}:
    container_name: peer0.${FULL_DOMAIN}
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=ehr-network
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_ID=peer0.${FULL_DOMAIN}
      - CORE_PEER_ADDRESS=peer0.${FULL_DOMAIN}:${PEER_PORT}
      - CORE_PEER_LISTENADDRESS=0.0.0.0:${PEER_PORT}
      - CORE_PEER_CHAINCODEADDRESS=peer0.${FULL_DOMAIN}:$(( PEER_PORT + 1 ))
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:$(( PEER_PORT + 1 ))
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.${FULL_DOMAIN}:${PEER_PORT}
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.${FULL_DOMAIN}:${PEER_PORT}
      - CORE_PEER_LOCALMSPID=${MSP_ID}
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ${BLOCKCHAIN_DIR}/crypto-config/peerOrganizations/${FULL_DOMAIN}/peers/peer0.${FULL_DOMAIN}/msp:/etc/hyperledger/fabric/msp
      - ${BLOCKCHAIN_DIR}/crypto-config/peerOrganizations/${FULL_DOMAIN}/peers/peer0.${FULL_DOMAIN}/tls:/etc/hyperledger/fabric/tls
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - "${PEER_PORT}:${PEER_PORT}"
    networks:
      - ehr-network
EOF

docker-compose -f /tmp/docker-compose-new-org.yaml up -d
info "Waiting 8 seconds for containers to stabilize..."
sleep 8

# ── Step 6: Join the channel ───────────────────────────────────────────────
info "Step 6: ${ORG_NAME} peer joining ehr-channel..."

docker exec cli bash -c "
  CORE_PEER_ADDRESS=peer0.${FULL_DOMAIN}:${PEER_PORT} \
  CORE_PEER_LOCALMSPID=${MSP_ID} \
  CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${FULL_DOMAIN}/users/Admin@${FULL_DOMAIN}/msp \
  CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${FULL_DOMAIN}/peers/peer0.${FULL_DOMAIN}/tls/ca.crt \
  peer channel join -b ehr-channel.block"

info "${ORG_NAME} peer successfully joined ehr-channel!"

# ── Step 7: Install chaincode on new peer ─────────────────────────────────
info "Step 7: Installing chaincode on ${ORG_NAME} peer..."

docker exec cli bash -c "
  CORE_PEER_ADDRESS=peer0.${FULL_DOMAIN}:${PEER_PORT} \
  CORE_PEER_LOCALMSPID=${MSP_ID} \
  CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${FULL_DOMAIN}/users/Admin@${FULL_DOMAIN}/msp \
  peer lifecycle chaincode install ehr-chaincode.tar.gz"

docker exec cli bash -c "
  CORE_PEER_ADDRESS=peer0.${FULL_DOMAIN}:${PEER_PORT} \
  CORE_PEER_LOCALMSPID=${MSP_ID} \
  CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${FULL_DOMAIN}/users/Admin@${FULL_DOMAIN}/msp \
  peer lifecycle chaincode install org-registry.tar.gz 2>/dev/null || true"

# ── Step 8: Approve chaincode for new org ─────────────────────────────────
info "Step 8: Approving chaincode definitions for ${MSP_ID}..."

PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep "ehr-chaincode_1.0" | awk '{print $3}' | sed 's/,//')

docker exec cli bash -c "
  CORE_PEER_ADDRESS=peer0.${FULL_DOMAIN}:${PEER_PORT} \
  CORE_PEER_LOCALMSPID=${MSP_ID} \
  CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${FULL_DOMAIN}/users/Admin@${FULL_DOMAIN}/msp \
  peer lifecycle chaincode approveformyorg \
    -o orderer.ehr.com:7050 \
    --channelID ehr-channel \
    --name ehr-chaincode \
    --version 1.0 \
    --package-id $PACKAGE_ID \
    --sequence 1 \
    --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem"

info ""
info "═══════════════════════════════════════════════════════════════"
info "  ${ORG_NAME} (${MSP_ID}) successfully added to ehr-channel!"
info "  Peer:    peer0.${FULL_DOMAIN}:${PEER_PORT}"
info "  CA port: ${CAPORT}"
info ""
info "  Next: call registerOrg chaincode function via the backend API"
info "  POST /api/network/register-org with orgId=${MSP_ID}"
info "═══════════════════════════════════════════════════════════════"
