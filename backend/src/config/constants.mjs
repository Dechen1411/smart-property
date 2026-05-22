import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "..");

export const ROOT_DIR = path.resolve(SRC_DIR, "..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const DOCS_DIR = path.join(DATA_DIR, "documents");

const loadLocalEnv = () => {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadLocalEnv();

export const PORT = Number(process.env.PORT ?? 4001);
export const SHARES_PER_PROPERTY = 10_000;
export const ZERO_WALLET = "0x0000000000000000000000000000000000000000";
export const MONGODB_URI = process.env.MONGODB_URI || "";
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "smart_property_platform";
export const USE_MONGODB = Boolean(MONGODB_URI);
export const DOCUMENT_STORAGE_DRIVER = (process.env.DOCUMENT_STORAGE_DRIVER || "").toLowerCase() || "local";
export const IPFS_PROVIDER = (process.env.IPFS_PROVIDER || "").toLowerCase();
export const PINATA_JWT = process.env.PINATA_JWT || "";
export const PINATA_API_URL = process.env.PINATA_API_URL || "https://api.pinata.cloud/pinning/pinJSONToIPFS";
export const PINATA_FILE_API_URL = process.env.PINATA_FILE_API_URL || "https://api.pinata.cloud/pinning/pinFileToIPFS";
export const PINATA_NETWORK = process.env.PINATA_NETWORK || "public";
export const PINATA_GATEWAY_URL = (process.env.PINATA_GATEWAY_URL || "").replace(/^https?:\/\//, "").replace(/\/+$/g, "");
export const IPFS_API_URL = (process.env.IPFS_API_URL || "").replace(/\/+$/g, "");
export const IPFS_API_TOKEN = process.env.IPFS_API_TOKEN || "";
export const USE_IPFS_DOCUMENT_STORAGE = DOCUMENT_STORAGE_DRIVER === "ipfs";
export const HAS_IPFS_DOCUMENT_CONFIG = Boolean(PINATA_JWT || IPFS_API_URL);
export const CHAIN_RPC_URL = process.env.CHAIN_RPC_URL || "";
export const SMART_PROPERTY_CONTRACT_ADDRESS = process.env.SMART_PROPERTY_CONTRACT_ADDRESS || process.env.SMART_CONTRACT_ADDRESS || "";
export const CONTRACT_ADMIN_PRIVATE_KEY = process.env.CONTRACT_ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
export const USE_CHAIN = Boolean(CHAIN_RPC_URL && SMART_PROPERTY_CONTRACT_ADDRESS && CONTRACT_ADMIN_PRIVATE_KEY);
export const NDI_AUTH_BASE = process.env.NDI_AUTH_BASE || "https://staging.bhutanndi.com";
export const NDI_API_BASE = process.env.NDI_API_BASE || "https://demo-client.bhutanndi.com";
export const NDI_CLIENT_ID = process.env.NDI_CLIENT_ID || "";
export const NDI_CLIENT_SECRET = process.env.NDI_CLIENT_SECRET || "";
export const NDI_FOUNDATIONAL_SCHEMA =
  process.env.NDI_FOUNDATIONAL_SCHEMA || "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076";
export const NDI_NATS_URL = process.env.NDI_NATS_URL || "wss://natsdemoclient.bhutanndi.com";
export const NDI_NATS_NKEY_SEED = process.env.NDI_NATS_NKEY_SEED || "";
export const USE_NDI = Boolean(NDI_CLIENT_ID && NDI_CLIENT_SECRET);
export const USE_NDI_NATS = Boolean(USE_NDI && NDI_NATS_NKEY_SEED);
export const PRIVY_API_BASE = (process.env.PRIVY_API_BASE || "https://api.privy.io/v1").replace(/\/+$/g, "");
export const PRIVY_APP_ID = process.env.PRIVY_APP_ID || "";
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || "";
export const USE_PRIVY = Boolean(PRIVY_APP_ID && PRIVY_APP_SECRET);

export const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/;
export const parseCsvList = (value = "") =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseWalletList = (value = "") => parseCsvList(value).map((wallet) => wallet.toLowerCase()).filter((wallet) => walletAddressRegex.test(wallet));
const parseHashList = (value = "") =>
  parseCsvList(value)
    .map((hash) => hash.toLowerCase().replace(/^0x/, ""))
    .filter((hash) => /^[a-f0-9]{64}$/.test(hash));
const parseBoolean = (value = "") => ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());

export const ADMIN_DEMO_MODE = parseBoolean(process.env.ADMIN_DEMO_MODE || "");
export const ADMIN_WALLET_ADDRESSES = parseWalletList(process.env.ADMIN_WALLET_ADDRESSES || "");
export const ADMIN_HOLDER_DIDS = parseCsvList(process.env.ADMIN_HOLDER_DIDS || "");
export const ADMIN_ID_NUMBER_HASHES = parseHashList(process.env.ADMIN_ID_NUMBER_HASHES || "");
export const roleSet = new Set(["user", "admin"]);
