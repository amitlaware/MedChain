# Hyperledger Fabric v2.5 Setup on Windows + WSL2 Ubuntu

This guide sets up Hyperledger Fabric v2.5 using Docker Desktop, WSL2 Ubuntu, and the Fabric `test-network`.

Run the Fabric commands inside WSL2 Ubuntu, not Windows PowerShell, unless a section explicitly says PowerShell.

## 1. Windows Prerequisites

Open PowerShell as Administrator.

```powershell
wsl --install -d Ubuntu
wsl --set-default-version 2
```

Install Docker Desktop for Windows:

```powershell
winget install Docker.DockerDesktop
```

After Docker Desktop opens:

- Go to Settings > General.
- Enable "Use the WSL 2 based engine".
- Go to Settings > Resources > WSL Integration.
- Enable integration for Ubuntu.
- Apply and restart Docker Desktop.

Verify Docker from WSL2 Ubuntu:

```bash
docker --version
docker compose version
docker run hello-world
```

## 2. Install Ubuntu Packages

Inside WSL2 Ubuntu:

```bash
sudo apt update
sudo apt install -y curl git jq build-essential ca-certificates
```

Install Node.js LTS for JavaScript chaincode:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

## 3. Install Fabric Samples, Binaries, and Docker Images

Create a workspace:

```bash
mkdir -p ~/fabric
cd ~/fabric
```

Download Fabric v2.5 samples, binaries, and Docker images:

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh -f 2.5.9 docker samples binary
```

Add Fabric binaries to your shell path:

```bash
echo 'export PATH=$HOME/fabric/fabric-samples/bin:$PATH' >> ~/.bashrc
echo 'export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config' >> ~/.bashrc
source ~/.bashrc
```

Verify:

```bash
peer version
configtxgen --version
docker images | grep hyperledger
```

## 4. Start Fabric Test Network

Go to the test network:

```bash
cd ~/fabric/fabric-samples/test-network
```

Clean any old containers, volumes, and generated crypto material:

```bash
./network.sh down
```

Start the network with certificate authorities:

```bash
./network.sh up -ca
```

Check containers:

```bash
docker ps
```

You should see peer, orderer, and CA containers.

## 5. Create Channel

Create a channel named `ehrchannel`:

```bash
./network.sh createChannel -c ehrchannel
```

Or create the default `mychannel`:

```bash
./network.sh createChannel
```

For this project, use `ehrchannel` consistently in backend environment variables and Fabric gateway code.

## 6. JavaScript Chaincode Structure

From this project repo inside WSL2:

```bash
cd /mnt/c/New\ folder/ehr-system
mkdir -p chaincode/ehr/lib
cd chaincode/ehr
npm init -y
npm install fabric-contract-api fabric-shim
```

Recommended chaincode package fields:

```json
{
  "name": "ehr-chaincode",
  "version": "1.0.0",
  "description": "EHR chaincode for Hyperledger Fabric",
  "main": "index.js",
  "scripts": {
    "start": "fabric-chaincode-node start"
  },
  "dependencies": {
    "fabric-contract-api": "^2.5.0",
    "fabric-shim": "^2.5.0"
  }
}
```

Example `chaincode/ehr/index.js`:

```js
"use strict";

const { Contract } = require("fabric-contract-api");

class EhrContract extends Contract {
  async initLedger(ctx) {
    return "EHR ledger initialized";
  }

  async createRecord(ctx, recordId, patientId, cid, filename, hospitalId) {
    const exists = await this.recordExists(ctx, recordId);

    if (exists) {
      throw new Error(`Record ${recordId} already exists`);
    }

    const record = {
      docType: "record",
      recordId,
      patientId,
      cid,
      filename,
      hospitalId,
      permissions: [],
      createdAt: new Date().toISOString()
    };

    await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(record)));
    return JSON.stringify(record);
  }

  async readRecord(ctx, recordId) {
    const buffer = await ctx.stub.getState(recordId);

    if (!buffer || buffer.length === 0) {
      throw new Error(`Record ${recordId} does not exist`);
    }

    return buffer.toString();
  }

  async grantPermission(ctx, recordId, userId) {
    const record = JSON.parse(await this.readRecord(ctx, recordId));

    if (!record.permissions.includes(userId)) {
      record.permissions.push(userId);
    }

    await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(record)));
    return JSON.stringify(record);
  }

  async recordExists(ctx, recordId) {
    const buffer = await ctx.stub.getState(recordId);
    return Boolean(buffer && buffer.length > 0);
  }
}

module.exports = EhrContract;
```

If you use the example above, add this to `chaincode/ehr/package.json`:

```json
{
  "main": "index.js"
}
```

## 7. Deploy JavaScript Chaincode

From the Fabric test network directory:

```bash
cd ~/fabric/fabric-samples/test-network
```

Deploy JavaScript chaincode from this repo:

```bash
./network.sh deployCC \
  -c ehrchannel \
  -ccn ehr \
  -ccp /mnt/c/New\ folder/ehr-system/chaincode/ehr \
  -ccl javascript
```

If your repo is cloned directly inside WSL, use the Linux path instead:

```bash
./network.sh deployCC \
  -c ehrchannel \
  -ccn ehr \
  -ccp ~/ehr-system/chaincode/ehr \
  -ccl javascript
```

Deploy with an explicit version and sequence:

```bash
./network.sh deployCC \
  -c ehrchannel \
  -ccn ehr \
  -ccp /mnt/c/New\ folder/ehr-system/chaincode/ehr \
  -ccl javascript \
  -ccv 1.0 \
  -ccs 1
```

## 8. Invoke and Query Chaincode

Set peer CLI environment for Org1:

```bash
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

Invoke `initLedger`:

```bash
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C ehrchannel \
  -n ehr \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"initLedger","Args":[]}'
```

Create a record:

```bash
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C ehrchannel \
  -n ehr \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"createRecord","Args":["record-001","patient-001","bafy-example-cid","blood-report.pdf","hospital-001"]}'
```

Query the record:

```bash
peer chaincode query \
  -C ehrchannel \
  -n ehr \
  -c '{"function":"readRecord","Args":["record-001"]}'
```

Grant permission:

```bash
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C ehrchannel \
  -n ehr \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"grantPermission","Args":["record-001","doctor-001"]}'
```

## 9. Stop or Reset Network

Stop and remove Fabric test-network containers and generated material:

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh down
```

Remove chaincode Docker images if needed:

```bash
docker images | grep ehr
docker rmi $(docker images | grep ehr | awk '{print $3}')
```

## 10. Common Issues

If Docker commands fail inside WSL2, confirm Docker Desktop is running and WSL integration is enabled.

If `peer` is not found:

```bash
export PATH=$HOME/fabric/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config
```

If chaincode deploy fails because dependencies cannot install, run this inside the chaincode folder:

```bash
cd /mnt/c/New\ folder/ehr-system/chaincode/ehr
npm install
```

If a channel or chaincode already exists, reset the network:

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh down
./network.sh up -ca
./network.sh createChannel -c ehrchannel
```
