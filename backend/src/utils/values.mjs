import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ADMIN_DEMO_MODE, ADMIN_HOLDER_DIDS, ADMIN_ID_NUMBER_HASHES, ADMIN_WALLET_ADDRESSES, roleSet, walletAddressRegex } from "../config/constants.mjs";

export const now = () => new Date().toISOString();
export const asTokenId = (value) => String(value ?? "").trim();
export const normalizeWallet = (wallet) => String(wallet ?? "").trim().toLowerCase();
export const normalizeRole = (role) => (role === "admin" ? "admin" : "user");
export const isSupportedRole = (role) => roleSet.has(role);
export const isWallet = (wallet) => walletAddressRegex.test(String(wallet ?? ""));
export const isAdminWallet = (wallet) => ADMIN_WALLET_ADDRESSES.includes(normalizeWallet(wallet));
export const sha256Digest = (value) => createHash("sha256").update(String(value ?? "").trim()).digest("hex");
export const isAdminNdiIdentity = ({ holderDid = "", idNumberDisplay = "", walletAddress = "" } = {}) => {
  if (ADMIN_DEMO_MODE) {
    return true;
  }

  const holderMatch = ADMIN_HOLDER_DIDS.includes(String(holderDid).trim());
  const idHashMatch = Boolean(idNumberDisplay) && ADMIN_ID_NUMBER_HASHES.includes(sha256Digest(idNumberDisplay));
  const walletMatch = isAdminWallet(walletAddress);
  return holderMatch || idHashMatch || walletMatch;
};
export const seededVerifiedWallets = () =>
  Object.fromEntries(ADMIN_WALLET_ADDRESSES.map((wallet) => [normalizeWallet(wallet), true]));
export const sha256Hex = (value) => `0x${createHash("sha256").update(String(value)).digest("hex")}`;
export const randomHex = (bytes = 32) => `0x${randomBytes(bytes).toString("hex")}`;
export const randomNonce = (bytes = 16) => randomBytes(bytes).toString("hex");
export const randomSessionToken = () => `spp_${randomBytes(24).toString("hex")}`;
export const randomThreadId = () => randomUUID();
export const makeId = (prefix) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
