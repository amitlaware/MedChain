import { create } from "ipfs-http-client";

export function createIPFSClient() {
  return create({
    url: process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0"
  });
}

export const ipfsClient = createIPFSClient();
