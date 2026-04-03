# ⛓️ MedChain — Blockchain-Based Smart Healthcare System

A production-oriented Electronic Health Record (EHR) system built on **Hyperledger Fabric**,
featuring encrypted off-chain storage (IPFS/S3), role-based access control, and an immutable
audit trail.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Frontend (React.js)                        │
│  Hospital | Doctor | Patient Dashboards     │
└────────────┬────────────────────────────────┘
             │ HTTPS / REST
┌────────────▼────────────────────────────────┐
│  Backend (Node.js / Express)                │
│  Auth · EHR · Access · Audit APIs           │
└────────────┬────────────────────────────────┘
             │ Fabric SDK (fabric-network)
┌────────────▼────────────────────────────────┐
│  Hyperledger Fabric Network                 │
│  ┌──────────────────────────────────────┐  │
│  │  ehr-channel                          │  │
│  │  HospitalOrg │ DoctorOrg │ PatientOrg │  │
│  │  Chaincode: ehr-chaincode             │  │
│  │  Endorsement: 2-of-3 orgs            │  │
│  └──────────────────────────────────────┘  │
│  Orderer (Raft consensus)                   │
└────────────┬────────────────────────────────┘
             │ IPFS hash only (on-chain)
┌────────────▼────────────────────────────────┐
│  Off-chain Storage                          │
│  IPFS (encrypted files) + AWS S3 (backup)  │
└─────────────────────────────────────────────┘
```

---

## 📁 Folder Structure

```
smart-healthcare/
├── blockchain/
│   ├── chaincode/
│   │   └── ehr-chaincode/
│   │       ├── index.js          ← Smart contract (all EHR logic)
│   │       └── package.json
│   ├── config/
│   │   ├── crypto-config.yaml   ← Org/peer/CA definitions
│   │   └── configtx.yaml        ← Channel + endorsement policy
│   ├── scripts/
│   │   └── bootstrap.sh         ← One-command network setup
│   └── docker-compose.yaml      ← All Fabric services
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          ← Register/login + Fabric CA enrollment
│   │   │   ├── ehr.js           ← Upload/view/download records
│   │   │   ├── access.js        ← Grant/revoke permissions
│   │   │   └── audit.js         ← Audit trail queries
│   │   ├── services/
│   │   │   ├── fabricService.js ← Fabric SDK wrapper
│   │   │   └── storageService.js← IPFS + S3 with AES-256-GCM encryption
│   │   ├── middleware/
│   │   │   └── auth.js          ← JWT verify + RBAC
│   │   └── app.js               ← Express entry point
│   ├── wallet/                  ← Fabric identities (auto-generated)
│   ├── .env.example
│   └── package.json
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── HospitalDashboard.js
        │   ├── DoctorDashboard.js
        │   ├── PatientDashboard.js
        │   ├── LoginPage.js
        │   └── RegisterPage.js
        ├── components/
        │   ├── Hospital/
        │   │   ├── UploadEHR.js
        │   │   └── PatientRecords.js
        │   ├── Patient/
        │   │   └── MyRecords.js
        │   └── Shared/
        │       ├── AccessManager.js
        │       ├── AuditTrail.js
        │       ├── Navbar.js
        │       └── StatsCard.js
        ├── services/api.js       ← All HTTP calls
        ├── context/AuthContext.js
        ├── App.js
        ├── App.css
        └── package.json
```

---

## 🚀 Deployment Guide — Step by Step

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | ≥ 24 | https://docs.docker.com/get-docker/ |
| Docker Compose | ≥ 2.20 | Included with Docker Desktop |
| Node.js | ≥ 18 | https://nodejs.org |
| Fabric binaries | 2.5 | See below |

### Step 1 — Install Hyperledger Fabric Binaries

```bash
# Downloads cryptogen, configtxgen, peer, etc. into ./bin and ./config
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.5 1.5.7
export PATH=$PWD/bin:$PATH
```

### Step 2 — Start the Fabric Network

```bash
cd blockchain

# Make script executable
chmod +x scripts/bootstrap.sh

# This single script:
#  1. Generates crypto material (certs, keys) for all 3 orgs
#  2. Creates genesis block and channel tx
#  3. Starts all Docker containers (CAs, peers, orderer)
#  4. Creates and joins ehr-channel
#  5. Packages, installs, approves, and commits chaincode
./scripts/bootstrap.sh
```

Expected output at the end:
```
[INFO] Network is UP. Chaincode deployed on ehr-channel.
```

### Step 3 — Start the Backend

```bash
cd backend

# Copy and configure environment variables
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum

npm install
npm run dev
# Server running on http://localhost:4000
```

### Step 4 — Start IPFS (local node)

```bash
# Install Kubo (IPFS implementation)
# macOS:  brew install ipfs
# Linux:  https://docs.ipfs.tech/install/command-line/

ipfs init
ipfs daemon
# IPFS API listening on /ip4/127.0.0.1/tcp/5001
```

### Step 5 — Start the Frontend

```bash
cd frontend
npm install
npm start
# React app running on http://localhost:3000
```

### Step 6 — Test the System

1. Open http://localhost:3000
2. Register as **Hospital Admin** → gets enrolled in HospitalMSP CA
3. Register as **Doctor** → enrolled in DoctorMSP CA  
4. Register as **Patient** → enrolled in PatientMSP CA
5. Log in as Hospital → upload a PDF lab report for the patient
6. Log in as Patient → grant doctor access to that EHR
7. Log in as Doctor → view and download the decrypted record
8. Check Audit Trail → see every action immutably logged on-chain

---

## 🔐 Security Architecture

### Encryption Flow

```
File Upload:
  Browser → AES-256-GCM encrypt → IPFS (encrypted bytes)
                                → Blockchain (IPFS hash + enc key)

File Download:
  Blockchain (verify access) → IPFS (get encrypted bytes) → AES-256-GCM decrypt → User
```

### Key Management
- Each file is encrypted with a unique AES-256-GCM key
- In production: the symmetric key is encrypted with the **patient's RSA/EC public key**
- Only the patient can decrypt the key → only they control who can read it
- Key rotation: re-encrypt with new key and update on-chain

### Role-Based Access Control

| Action | Hospital | Doctor | Patient |
|--------|----------|--------|---------|
| Upload EHR | ✅ | ✅ | ❌ |
| View EHR | ✅ if uploaded | ✅ if granted | ✅ own records |
| Grant Access | ✅ (own records) | ❌ | ✅ (own records) |
| Revoke Access | ✅ | ❌ | ✅ |
| View Audit Trail | ✅ | ❌ | ✅ |
| Delete EHR | ✅ (soft delete) | ❌ | ❌ |

### Digital Signatures
- Every Fabric transaction is **digitally signed** by the submitter's X.509 certificate
- Certificates issued by org-specific **Fabric CAs** — not self-signed
- MSP (Membership Service Provider) verifies identity on every chaincode call

---

## 🧪 Sample API Calls

```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr. Ravi","email":"ravi@hospital.com","password":"securepass","role":"doctor"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi@hospital.com","password":"securepass"}' | jq -r .token)

# Upload EHR
curl -X POST http://localhost:4000/api/ehr/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/report.pdf" \
  -F "patientId=patient-123" \
  -F "recordType=lab_result"

# Grant access to a doctor
curl -X POST http://localhost:4000/api/access/grant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ehrId":"<ehr-uuid>","requesterId":"ravi@hospital.com_doctor","requesterOrg":"DoctorMSP"}'

# View audit trail
curl http://localhost:4000/api/audit/<ehr-uuid> \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📦 Production Checklist

- [ ] Replace file-system wallet with **HSM-backed wallet** (e.g., AWS CloudHSM)
- [ ] Replace in-memory user store with **PostgreSQL** or **MongoDB**
- [ ] Implement **RSA/ECIES** encryption of AES keys with patient's public key
- [ ] Add **TLS termination** with NGINX reverse proxy
- [ ] Set up **Prometheus + Grafana** for Fabric metrics
- [ ] Configure **multi-orderer Raft** (3+ orderers) for HA
- [ ] Enable **Fabric private data collections** for ultra-sensitive fields
- [ ] Implement **key rotation** and **certificate renewal** automation
- [ ] Add **multi-factor authentication** for hospital admins
- [ ] Set up **audit log archival** to immutable S3 (Object Lock)

---

## 🤝 Organizations and Channels

| Organization | MSP ID | Port | Role |
|-------------|--------|------|------|
| HospitalOrg | HospitalMSP | 7051 | Upload EHRs, manage access |
| DoctorOrg   | DoctorMSP   | 8051 | View/upload clinical notes |
| PatientOrg  | PatientMSP  | 9051 | View own records, control access |
| Orderer     | OrdererMSP  | 7050 | Raft consensus, block ordering |

**Channel:** `ehr-channel` — all 3 orgs participate  
**Endorsement Policy:** 2-of-3 orgs must endorse every transaction

---

## 🛠️ Troubleshooting

```bash
# Check all containers are running
docker ps

# View peer logs
docker logs peer0.hospital.ehr.com

# Chaincode query directly (from CLI container)
docker exec cli peer chaincode query \
  -C ehr-channel -n ehr-chaincode \
  -c '{"function":"getPatientRecords","Args":["patient-123"]}'

# Reset everything
cd blockchain && docker-compose down --volumes --remove-orphans
rm -rf crypto-config channel-artifacts wallet
```
