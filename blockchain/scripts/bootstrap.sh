#!/bin/bash
# ============================================================
#  bootstrap.sh  — Set up the full Hyperledger Fabric network
#  Run: chmod +x bootstrap.sh && ./bootstrap.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Check dependencies ───────────────────────────────────────
info "Checking dependencies..."
for cmd in docker docker-compose cryptogen configtxgen; do
  command -v $cmd &>/dev/null || error "$cmd is required but not installed."
done
info "All dependencies found."

# ── Clean up previous run ────────────────────────────────────
info "Cleaning up previous network artifacts..."
docker-compose -f docker-compose.yaml down --volumes --remove-orphans 2>/dev/null || true
rm -rf crypto-config channel-artifacts
mkdir -p channel-artifacts

# ── Step 1: Generate crypto material ────────────────────────
info "Step 1: Generating crypto material with cryptogen..."
cryptogen generate --config=./config/crypto-config.yaml --output="crypto-config"
info "Crypto material generated in ./crypto-config"

# ── Step 2: Generate genesis block ──────────────────────────
info "Step 2: Generating genesis block..."
export FABRIC_CFG_PATH="$SCRIPT_DIR/config"
configtxgen -profile EHROrdererGenesis \
  -channelID system-channel \
  -outputBlock ./channel-artifacts/genesis.block
info "Genesis block created."

# ── Step 3: Generate channel transaction ────────────────────
info "Step 3: Creating channel configuration transaction..."
configtxgen -profile EHRChannel \
  -outputCreateChannelTx ./channel-artifacts/ehr-channel.tx \
  -channelID ehr-channel

# ── Step 4: Generate anchor peer updates ────────────────────
info "Step 4: Generating anchor peer transactions..."
for ORG in HospitalMSP DoctorMSP PatientMSP; do
  configtxgen -profile EHRChannel \
    -outputAnchorPeersUpdate "./channel-artifacts/${ORG}anchors.tx" \
    -channelID ehr-channel \
    -asOrg $ORG
  info "  Anchor peer tx for $ORG created."
done

# ── Step 5: Start Docker network ────────────────────────────
info "Step 5: Starting Docker containers..."
docker-compose -f docker-compose.yaml up -d
info "Waiting 30 seconds for containers to stabilize..."
sleep 30

# ── Step 6: Create and join channel ─────────────────────────
info "Step 6: Creating channel 'ehr-channel'..."
docker exec cli peer channel create \
  -o orderer.ehr.com:7050 \
  -c ehr-channel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ehr-channel.tx \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem

info "Joining peers to channel..."
for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/peers/peer0.$ORG.ehr.com/tls/ca.crt \
    cli peer channel join -b ehr-channel.block
  info "  $PEER joined channel."
done

info "Updating Anchor Peers..."
for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/peers/peer0.$ORG.ehr.com/tls/ca.crt \
    cli peer channel update -o orderer.ehr.com:7050 -c ehr-channel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${MSP}anchors.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem
  info "  Updated anchor peers for $MSP."
done

# ── Step 7: Install chaincode ────────────────────────────────
info "Step 7: Installing chaincode on all peers..."
docker exec cli peer lifecycle chaincode package ehr-chaincode.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/ehr-chaincode \
  --lang node \
  --label ehr-chaincode_1.0

for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/peers/peer0.$ORG.ehr.com/tls/ca.crt \
    cli peer lifecycle chaincode install ehr-chaincode.tar.gz
  info "  Chaincode installed on $PEER."
done

# ── Step 8: Approve and commit chaincode ─────────────────────
info "Step 8: Approving chaincode for all organizations..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep "ehr-chaincode_1.0" | awk '{print $3}' | sed 's/,//')

for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/peers/peer0.$ORG.ehr.com/tls/ca.crt \
    cli peer lifecycle chaincode approveformyorg \
      -o orderer.ehr.com:7050 \
      --channelID ehr-channel \
      --name ehr-chaincode \
      --version 1.0 \
      --package-id $PACKAGE_ID \
      --sequence 1 \
      --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem
  info "  $MSP approved chaincode."
done

info "Committing chaincode definition..."
docker exec cli peer lifecycle chaincode commit \
  -o orderer.ehr.com:7050 \
  --channelID ehr-channel \
  --name ehr-chaincode \
  --version 1.0 \
  --sequence 1 \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem \
  --peerAddresses peer0.hospital.ehr.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hospital.ehr.com/peers/peer0.hospital.ehr.com/tls/ca.crt \
  --peerAddresses peer0.doctor.ehr.com:8051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/doctor.ehr.com/peers/peer0.doctor.ehr.com/tls/ca.crt \
  --peerAddresses peer0.patient.ehr.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/patient.ehr.com/peers/peer0.patient.ehr.com/tls/ca.crt

info "Step 9: Generating Connection Profile for Node.js Application..."
node generate_ccp.js

info ""
info "═══════════════════════════════════════════════════════"
info "  Network is UP. Chaincode deployed on ehr-channel."
info "  Next: cd ../backend && npm install && npm run dev"
info "═══════════════════════════════════════════════════════"
