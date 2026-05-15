import json
import os

path = /home/sujal/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json
with open(path, r) as f:
    profile = json.load(f)

profile[orderers] = {
    orderer.example.com: {
        url: grpcs://localhost:7050,
        tlsCACerts: {
            pem: -----BEGIN
