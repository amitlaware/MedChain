#!/bin/bash
for PEER_ENV in \
  "peer0.hospital.ehr.com:7051:HospitalMSP:hospital" \
  "peer0.doctor.ehr.com:8051:DoctorMSP:doctor" \
  "peer0.patient.ehr.com:9051:PatientMSP:patient"; do

  IFS=':' read -r PEER PORT MSP ORG <<< "$PEER_ENV"
  echo "Updating anchor peers for $ORG..."
  docker exec \
    -e CORE_PEER_ADDRESS=$PEER:$PORT \
    -e CORE_PEER_LOCALMSPID=$MSP \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/users/Admin@$ORG.ehr.com/msp \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG.ehr.com/peers/peer0.$ORG.ehr.com/tls/ca.crt \
    cli peer channel update \
      -o orderer.ehr.com:7050 \
      -c ehr-channel \
      -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${MSP}anchors.tx \
      --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ehr.com/orderers/orderer.ehr.com/msp/tlscacerts/tlsca.ehr.com-cert.pem
done
