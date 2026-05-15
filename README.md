# EHR Blockchain System

A sample Electronic Health Record (EHR) system that demonstrates storing encrypted patient medical records on IPFS, managing metadata and permissions on Hyperledger Fabric, and persisting metadata in MongoDB. Includes a React frontend and Node.js/Express backend with Fabric integration.

---

## Project Overview

- Purpose: secure, auditable sharing of patient medical records between hospitals and doctors using IPFS for storage and Hyperledger Fabric for access control and audit logging.
- Key features:
  - Upload PDF medical records (client-side → backend)
  - AES-256-GCM encryption of PDFs before storing on IPFS
  - File CID and permissions stored on Hyperledger Fabric chaincode
  - Metadata stored in MongoDB for quick queries
  - Role-based access control: patients, doctors, admin
  - Patient-managed grant/revoke access workflows
  - Transfer request flow for moving records between hospitals

  ### Access expiry and permission shape

  Permissions now support structured entries with optional expiry and granular flags. Example permission object stored on Fabric and in MongoDB:

  ```json
  {
    "doctorId": "D1",
    "canView": true,
    "expires": "2026-06-01T00:00:00.000Z"
  }
  ```

  When granting access you may provide `canView` (boolean) and `expires` (ISO date). The backend and chaincode will enforce expiry when evaluating access.

  ### Access audit trail

  Chaincode now records every record read in an `accessLogs` array on the `record` object. Each entry includes the `actor` (blockchain identity that requested the read) and a `timestamp` (ISO). Example:

  ```json
  {
    "actor": "x509::/CN=doctor1::/C=US/ST=...",
    "timestamp": "2026-05-08T12:34:56.789Z"
  }
  ```

  An audit log entry (`READ_RECORD`) is also stored using the existing audit log mechanism. This provides an immutable trail of who accessed which records and when.

  ### File integrity (SHA-256)

  For additional data integrity assurance, the backend computes a SHA-256 hash of the original PDF at upload time and the hash is stored on-chain with the record. When a doctor downloads and the backend decrypts the file from IPFS, the backend re-computes the SHA-256 and verifies it matches the on-chain `fileHash`. If the hashes differ the backend rejects the download with an integrity error.

  This ensures that even if IPFS content were tampered with or corrupted, mismatch will be detected using the on-ledger hash.

---

## Architecture

- Frontend: React + Vite (SPA)
- Backend: Node.js, Express — handles auth, file uploads (multer), encryption, IPFS interaction, Fabric gateway calls, MongoDB persistence
- Storage: IPFS (encrypted payloads)
- Ledger: Hyperledger Fabric chaincode (chaincode located at `chaincode/ehr/ehr-contract.js`)
- Database: MongoDB (metadata), CouchDB (optional for Fabric state database)
- Local dev orchestrator: Docker Compose (MongoDB + CouchDB + backend + frontend)

Important: Blockchain is the source of truth. MongoDB is used only as a cache and for query optimization. The backend always validates permissions and record existence against Hyperledger Fabric before serving or authorizing access.

Diagram (high level):

Client (React) → Backend API → IPFS (encrypted) + Fabric (metadata/permissions) + MongoDB (metadata)

---

## Repo layout

- `backend/` — Express API, Fabric, IPFS helpers, models, controllers
- `frontend/` — React app
- `chaincode/` — Hyperledger Fabric chaincode source
- `docs/` — setup guides (Fabric, IPFS)
- `docker-compose.yml` — local Docker Compose for MongoDB/CouchDB/backend/frontend

---

## Installation (local dev, prerequisites)

Prerequisites:
- Node.js 18+ and npm
- Docker and Docker Compose (for services)
- (Optional) WSL2 on Windows for Fabric local network

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd ehr-system

# backend deps
cd backend
npm install

# frontend deps
cd ../frontend
npm install
```

---

## WSL2 setup (Windows users)

If you're on Windows, using WSL2 improves compatibility with Fabric and Docker. See the detailed guide in **docs/fabric-wsl2-setup.md** for step-by-step instructions to enable WSL2, install required packages, and configure Docker to work with WSL.

- Open: [docs/fabric-wsl2-setup.md](docs/fabric-wsl2-setup.md)

---

## Docker setup

This repository includes a `docker-compose.yml` to run MongoDB, CouchDB, the backend, and the frontend dev server.

1. Copy the environment example and edit values:

```bash
cp .env.example .env
# Edit .env: set strong passwords and IPFS_ENCRYPTION_KEY
```

2. Start services:

```bash
docker compose up --build
```

Services after startup:
- MongoDB: `mongodb://localhost:27017`
- CouchDB: `http://localhost:5984`
- Backend API: `http://localhost:5000`
- Frontend (Vite dev): `http://localhost:5173`

Notes:
- The Fabric test-network is not containerized here — run Fabric locally (see Hyperledger section) and ensure the backend has access to the Fabric connection profile and wallet.
- For production, replace the Vite dev server with a built static frontend.

---

## Hyperledger Fabric setup (local test network)

We do not containerize Fabric as part of the compose; use Fabric samples or your own test-network. Basic steps:

1. Install prerequisites: Docker, Docker Compose, Node.js, Go, and Fabric binaries. See Fabric docs.
2. From your Fabric samples repository (or local scripts), start a test-network and create a channel.
3. Install and instantiate the chaincode located at `chaincode/ehr`.
4. Ensure backend has the connection profile and wallet entries expected by `backend/fabric/*` helpers. You can mount those files into the backend container or run backend on host with access to them.

See the project's Fabric guide: `docs/fabric-wsl2-setup.md` for tips and commands used during development.

### Fabric Certificate Authority (CA) — identities and X.509 certs (important)

Hyperledger Fabric issues and manages identities using X.509 certificates. For a secure, auditable EHR system each participant (patient, doctor, hospital, admin) should have a distinct blockchain identity issued by a Fabric Certificate Authority (CA). The backend relies on wallet credentials (private keys and certs) that are derived from these identities — you must provision them before attempting ledger transactions.

We recommend using Fabric CA (fabric-ca) and the `fabric-ca-client` CLI to register and enroll identities. Typical workflow:

1. Start a Fabric CA server (may be included in your test-network or run separately).
2. Use the CA admin identity to `register` accounts for doctors/patients/hospitals.
3. `enroll` each account to obtain the X.509 certificate and private key, then store them in a wallet directory the backend can access.

Example `fabric-ca-client` commands (replace hostnames, ports, and CA name as configured in your network):

```bash
# export CA server and wallet paths
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca-client

# enroll the CA admin (first-time setup)
fabric-ca-client enroll -u http://admin:adminpw@localhost:7054 --caname ca.example.com -M $FABRIC_CA_CLIENT_HOME/admin/msp

# register a doctor identity (admin registers the user)
fabric-ca-client register --id.name doctor1 --id.secret doctor1pw --id.type client -u http://localhost:7054 --caname ca.example.com

# enroll the doctor to create certs/keys in a wallet location
fabric-ca-client enroll -u http://doctor1:doctor1pw@localhost:7054 --caname ca.example.com -M $FABRIC_CA_CLIENT_HOME/doctor1/msp

# If TLS is enabled on the CA, include the CA cert file
# fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 --caname ca.example.com -M ./wallet/admin/msp --tls.certfiles /path/to/ca-cert.pem
```

Wallet & backend integration
- Place the enrolled identities (certs and keys) into a wallet directory that the backend `gateway` code expects (see `backend/fabric/wallet.js`). Common layout:

```
backend/fabric/wallet/
  admin/
    msp/        # contains signcerts and keystore
  doctor1/
    msp/
  patient1/
    msp/
```

- When running the backend container, mount the wallet and connection profile into the container so the app can load identities and connect to the Fabric gateway. Example `docker-compose` volume snippet (not exhaustive):

```yaml
services:
  backend:
    volumes:
      - ./backend/fabric/wallet:/app/backend/fabric/wallet:ro
      - ./backend/fabric/connectionProfile.yaml:/app/backend/fabric/connectionProfile.yaml:ro
```

Security notes
- Keep private keys and wallet directories secure — do not commit them to version control.
- In production, consider a secure secrets manager or HSM for private key storage and signing operations.


---

## IPFS setup

This project expects an IPFS HTTP client (configured in `backend/ipfs/ipfsClient.js`). For local testing, you can run an IPFS node (kubo) locally. See `docs/ipfs-kubo-setup.md` for instructions to install and run Kubo locally.

Important: `IPFS_ENCRYPTION_KEY` environment variable must be set (64-hex string or passphrase). It's used by `backend/ipfs/encryption.js`.

---

## MongoDB setup

When using Docker Compose the `mongo` service will initialize with admin credentials set in `.env`. The backend uses `MONGODB_URI` (configured in `docker-compose.yml`) to connect.

If running MongoDB locally instead of Docker, set `MONGODB_URI` environment variable to the correct connection string.

---

## Frontend setup

Development:

```bash
cd frontend
npm install
npm run dev
```

Build for production:

```bash
npm run build
# serve build directory with a static server (e.g. serve or nginx)
```

The frontend reads `VITE_API_URL` (default `http://localhost:5000/api`) to communicate with the backend. Set this value in `.env` or via the Docker Compose environment.

---

## Backend setup

Run locally for development (nodemon recommended):

```bash
cd backend
npm install
npm run dev
```

Environment variables used by backend (examples are in `.env.example`):
- `MONGODB_URI` — MongoDB connection string
- `IPFS_ENCRYPTION_KEY` — key for AES-256-GCM encryption for IPFS payloads
- Fabric-related env vars and connection files — ensure `backend/fabric` has the expected connection profile and wallet.

Useful scripts:
- `npm run dev` — development server (nodemon)
- `npm start` — production node server

---

## Common commands

- Start with Docker Compose:
  - `docker compose up --build`
  - `docker compose down -v` to stop and remove volumes
- Backend locally:
  - `cd backend && npm run dev`
- Frontend locally:
  - `cd frontend && npm run dev`

---

## Screenshots

Add screenshots to `docs/screenshots/` and reference them here. Example:

```markdown
![Patient Dashboard](docs/screenshots/patient-dashboard.png)
```

Suggested screenshots:
- Patient dashboard (records list)
- Upload flow (file select + success)
- Permission manager (grant/revoke)
- Doctor view (authorized records)
- Fabric audit logs or chaincode explorer view

---

## Troubleshooting

- Backend cannot connect to Fabric:
  - Ensure Fabric test-network is running and that the backend has the correct connection profile and wallet credentials. Mount them into the container or run backend on host.
  - Check `backend/fabric/` and your `.env` for correct paths.

- IPFS encryption errors (decryption failures):
  - Confirm `IPFS_ENCRYPTION_KEY` is identical between encryption (upload) and decryption (download).
  - Provide either a 64-character hex key or a passphrase — backend code derives a 32-byte key via SHA-256 if not hex.

- CORS / auth issues:
  - Ensure frontend `VITE_API_URL` matches backend host and `CLIENT_URL` is set in backend env when using CORS.

- MongoDB auth errors:
  - If using Docker Compose, confirm `.env` credentials match `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` and that `MONGODB_URI` in `docker-compose.yml` uses them.

- Multer upload errors (file too large / invalid file type):
  - Default limit is 10 MB. Adjust `backend/middleware/uploadMiddleware.js` limits or increase via environment and Docker Compose as needed.

If you hit issues not covered here, check the service logs:

```bash
docker compose logs -f backend
docker compose logs -f mongo
```

---

## Contributing

Contributions welcome — open issues or PRs. If developing features that touch Fabric or IPFS, please include reproducible steps so reviewers can run the flow locally.

---

## License

Please check repository root for license information. If none exists, contact the project owner.
# EHR System

Blockchain-based Electronic Health Record management system.

## Tech Stack

- React frontend
- Node.js backend
- Hyperledger Fabric chaincode
- IPFS file storage
- MongoDB database

## Project Structure

```text
ehr-system/
├── frontend/
│   ├── pages/
│   ├── components/
│   ├── services/
│   └── context/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── fabric/
│   ├── ipfs/
│   ├── models/
│   └── uploads/
├── chaincode/
│   └── ehr/
├── scripts/
├── docs/
├── README.md
└── .gitignore
```

## Modules

- `frontend`: React user interface for patients, doctors, and administrators.
- `backend`: Node.js API server, authentication, MongoDB models, IPFS integration, and Fabric gateway services.
- `chaincode/ehr`: Hyperledger Fabric smart contracts for EHR access and audit records.
- `scripts`: Deployment, setup, and utility scripts.
- `docs`: Architecture notes, API documentation, and setup guides.
