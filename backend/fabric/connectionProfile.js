import fs from "fs/promises";

export async function loadConnectionProfile(connectionProfilePath) {
  const profile = await fs.readFile(connectionProfilePath, "utf8");
  return JSON.parse(profile);
}
