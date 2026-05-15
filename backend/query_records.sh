#!/bin/bash
cd ~/fabric-samples/test-network
export PATH=$PATH:/home/sujal/fabric-samples/bin
export FABRIC_CFG_PATH=/home/sujal/fabric-samples/config/
. ./scripts/envVar.sh
setGlobals 1
peer chaincode query -C ehr-channel -n ehr -c '{"Args":["getPatientRecords", "6a0597766ff56163b0d59aaa"]}'
