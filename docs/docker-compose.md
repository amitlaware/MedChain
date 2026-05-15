Docker Compose setup — MongoDB, CouchDB, backend, frontend
===========================================================

This workspace includes a `docker-compose.yml` and Dockerfiles to run the API and frontend alongside MongoDB and CouchDB. The Hyperledger Fabric test-network is intentionally not containerized.

Files added
- `docker-compose.yml` — top-level compose file
- `backend/Dockerfile` — backend image build
- `frontend/Dockerfile` — frontend image build (Vite dev server)
- `.env.example` — example environment variables

Prerequisites
- Docker and Docker Compose installed on your machine.
- A working Fabric test-network available locally (the backend still needs Fabric connection files/credentials).

Quick start
1. Copy the example env and set secure values:

```bash
cp .env.example .env
# edit .env and set strong passwords and IPFS_ENCRYPTION_KEY
```

2. Build and start services:

```bash
docker compose up --build
```

This will start:
- MongoDB on `localhost:27017`
- CouchDB on `localhost:5984`
- Backend API on `localhost:5000`
- Frontend dev server on `localhost:5173`

Notes and environment variables
- `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`: used by the Mongo image for initial admin user. `docker-compose.yml` sets `MONGODB_URI` for the backend to use these credentials.
- `COUCHDB_USER` and `COUCHDB_PASSWORD`: CouchDB admin credentials.
- `IPFS_ENCRYPTION_KEY`: required by `backend/ipfs/encryption.js` to encrypt/decrypt files sent to IPFS. Provide a secure 64-hex string or a passphrase.
- `VITE_API_URL`: the frontend will use this to talk to the backend. Default in compose points to `http://localhost:5000/api`.

Fabric integration
- This compose setup does NOT include Hyperledger Fabric. You must run or provide access to a Fabric gateway and the required connection profile and wallet files expected by the backend's Fabric helpers (`backend/fabric/*`). Ensure those files and credentials are mounted or available to the backend container (e.g., via volumes or using the host filesystem).

Testing and development tips
- If you change backend code and prefer hot-reload, develop locally (not in container) or modify the backend service command to use `npm run dev` (nodemon) in `docker-compose.yml`.
- To view logs:

```bash
docker compose logs -f backend
```

Stopping and cleanup

```bash
docker compose down -v
```
