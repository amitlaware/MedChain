# Local IPFS Setup with Kubo

This guide runs a local Kubo daemon and connects the Node.js backend to it through the IPFS HTTP API.

The backend stores encrypted PDF bytes in IPFS. Keep `IPFS_ENCRYPTION_KEY` private; anyone with the CID can fetch the encrypted payload, but only the key can decrypt it.

## Install Kubo on WSL2 Ubuntu

The current official Kubo install docs publish binaries from `dist.ipfs.tech`.

```bash
cd /tmp
wget https://dist.ipfs.tech/kubo/v0.40.1/kubo_v0.40.1_linux-amd64.tar.gz
tar -xvzf kubo_v0.40.1_linux-amd64.tar.gz
cd kubo
sudo bash install.sh
ipfs --version
```

Initialize your local IPFS repo:

```bash
ipfs init
```

Optional local-only profile for development:

```bash
ipfs config profile apply local-discovery
```

## Start the IPFS Daemon

Run this in WSL2 Ubuntu:

```bash
ipfs daemon
```

Default endpoints:

```text
API:     http://127.0.0.1:5001/api/v0
Gateway: http://127.0.0.1:8080/ipfs/<cid>
Web UI:  http://127.0.0.1:5001/webui
```

Verify the daemon from another terminal:

```bash
ipfs id
ipfs swarm peers
```

## Backend Environment

Add these values to `backend/.env`:

```env
IPFS_API_URL=http://127.0.0.1:5001/api/v0
IPFS_ENCRYPTION_KEY=replace_with_32_byte_hex_or_long_random_passphrase
```

Generate a strong hex key:

```bash
openssl rand -hex 32
```

Install the Node.js client:

```bash
cd /mnt/c/New\ folder/ehr-system/backend
npm install ipfs-http-client@60.0.1
```

Note: `ipfs-http-client` is deprecated upstream in favor of newer IPFS client libraries, but this project uses it because the current integration request specifically targets it.

## Backend Usage

Upload and encrypt a PDF:

```js
import { uploadFileToIPFS } from "./ipfs/index.js";

const result = await uploadFileToIPFS("uploads/report.pdf", {
  filename: "report.pdf"
});

console.log(result.cid);
```

Retrieve and decrypt a PDF:

```js
import fs from "fs/promises";
import { getFileFromIPFS } from "./ipfs/index.js";

const pdfBuffer = await getFileFromIPFS("bafy...");
await fs.writeFile("downloads/report.pdf", pdfBuffer);
```

## IPFS CLI Checks

Add a normal file:

```bash
echo "hello ehr" > hello.txt
ipfs add hello.txt
```

Fetch by CID:

```bash
ipfs cat <cid>
```

Pin a CID:

```bash
ipfs pin add <cid>
```

Remove unused local blocks:

```bash
ipfs repo gc
```

## Security Notes

- Do not store plaintext PDFs in IPFS.
- Do not commit `IPFS_ENCRYPTION_KEY`.
- Keep the encryption key outside chaincode and outside MongoDB records.
- Store only the returned CID and metadata in MongoDB or Fabric.
- Rotate keys carefully; old encrypted files need the key that encrypted them.
