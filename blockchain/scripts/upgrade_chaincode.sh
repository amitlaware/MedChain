#!/bin/bash
set -e
info()    { echo -e "\033[0;32m[INFO]\033[0m  $1"; }

info "1. Packaging upgraded chaincode v2..."
docker exec cli peer lifecycle chaincode package ehr-chaincode_2.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/ehr-chaincode \
  --lang node \
  --label ehr-chaincode_2.0

info "2. Installing v2 on all peers..."
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
    cli peer lifecycle chaincode install ehr-chaincode_2.tar.gz
done

info "3. Approving v2 (Sequence 2) for all organizations..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep "ehr-chaincode_2.0" | awk '{print $3}' | sed 's/,//')

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
      --version 2.0 \
      --package-id $PACKAGE_ID \
      --sequence 2 \
      --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem
done

info "4. Committing v2 (Sequence 2) to the channel..."
docker exec cli peer lifecycle chaincode commit \
  -o orderer.ehr.com:7050 \
  --channelID ehr-channel \
  --name ehr-chaincode \
  --version 2.0 \
  --sequence 2 \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem \
  --peerAddresses peer0.hospital.ehr.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hospital.ehr.com/peers/peer0.hospital.ehr.com/tls/ca.crt \
  --peerAddresses peer0.doctor.ehr.com:8051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/doctor.ehr.com/peers/peer0.doctor.ehr.com/tls/ca.crt \
  --peerAddresses peer0.patient.ehr.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/patient.ehr.com/peers/peer0.patient.ehr.com/tls/ca.crt

info "SUCCESS! Chaincode upgraded successfully to Version 2.0."
