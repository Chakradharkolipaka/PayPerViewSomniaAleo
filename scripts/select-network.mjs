import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function parseEnv(content) {
  const out = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    out.set(key, value);
  }
  return out;
}

function stringifyEnv(map) {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")
    .concat("\n");
}

function main() {
  const existing = readEnvFile(envPath);
  const env = parseEnv(existing);

  env.set("NEXT_PUBLIC_NETWORK", "somnia");
  env.set("NEXT_PUBLIC_SOMNIA_RPC_URL", env.get("NEXT_PUBLIC_SOMNIA_RPC_URL") || "https://dream-rpc.somnia.network/");
  env.set("NEXT_PUBLIC_PAYPERVIEW_ADDRESS", env.get("NEXT_PUBLIC_PAYPERVIEW_ADDRESS") || "");
  env.set("NEXT_PUBLIC_ACCESS_NFT_ADDRESS", env.get("NEXT_PUBLIC_ACCESS_NFT_ADDRESS") || "");
  env.set("NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS", env.get("NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS") || "");

  fs.writeFileSync(envPath, stringifyEnv(env), "utf8");

  console.log(`Updated ${envPath}`);
  console.log("NEXT_PUBLIC_NETWORK=somnia");
  console.log("NEXT_PUBLIC_SOMNIA_RPC_URL=https://dream-rpc.somnia.network/");
}

main();
