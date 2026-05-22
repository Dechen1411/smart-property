import { MongoClient } from "mongodb";
import { MONGODB_DB_NAME, MONGODB_URI, USE_MONGODB } from "../config/constants.mjs";
import { baseDb } from "./seed.mjs";
import { isWallet, normalizeRole, normalizeWallet, seededVerifiedWallets } from "../utils/values.mjs";

const collectionNames = {
  meta: "meta",
  users: "users",
  pendingSessions: "pendingSessions",
  walletChallenges: "walletChallenges",
  properties: "properties",
  listings: "listings",
  balances: "balances",
  approvals: "approvals",
  orders: "orders",
  leases: "leases",
  transferEvents: "transferEvents",
  auditLog: "auditLog",
  verifiedWallets: "verifiedWallets",
};

const legacySeedWallets = [
  "0xa110000000000000000000000000000000000001",
  "0xb220000000000000000000000000000000000002",
  "0xc330000000000000000000000000000000000003",
].map(normalizeWallet);
const legacySeedPropertyIds = ["prop-mountain-villa", "prop-commercial-office", "prop-prime-land"];
const legacySeedListingIds = ["LST-1001", "LST-1002", "LST-1003", "LST-1004"];
const legacySeedTokenIds = ["1001", "1002", "1003"];

let clientPromise = null;
let mongoReadyPromise = null;
const parseBoolean = (value = "") => ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
const mongoTlsAllowInvalidHostnames = parseBoolean(process.env.MONGODB_TLS_ALLOW_INVALID_HOSTNAMES || "");

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const withMongoRetry = async (operation, attempts = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      clientPromise = null;
      mongoReadyPromise = null;
      if (attempt < attempts) {
        await wait(attempt * 1500);
      }
    }
  }

  throw lastError;
};

const mongoClient = async () => {
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 15_000,
      maxPoolSize: 10,
      retryReads: true,
      retryWrites: true,
      serverSelectionTimeoutMS: 5_000,
      tlsAllowInvalidHostnames: mongoTlsAllowInvalidHostnames,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
};

const mongoDb = async () => {
  const client = await mongoClient();
  return client.db(MONGODB_DB_NAME);
};

const stripMongoId = (doc, { keepStringId = false } = {}) => {
  const clone = { ...doc };
  if (!keepStringId || typeof clone._id !== "string") {
    delete clone._id;
  }
  return clone;
};

const collectionRows = async (database, collectionName, options = {}) => {
  const rows = await database.collection(collectionName).find({}).toArray();
  return rows.map((row) => stripMongoId(row, options));
};

const balancesToObject = (rows) =>
  rows.reduce((acc, row) => {
    const wallet = normalizeWallet(row.wallet);
    if (isWallet(wallet)) {
      acc[wallet] = row.tokens ?? {};
    }
    return acc;
  }, {});

const verifiedWalletsToObject = (rows) =>
  rows.reduce((acc, row) => {
    const wallet = normalizeWallet(row.wallet);
    if (isWallet(wallet)) {
      acc[wallet] = Boolean(row.verified);
    }
    return acc;
  }, {});

const objectToBalances = (balances = {}) =>
  Object.entries(balances).map(([wallet, tokens]) => ({
    wallet: normalizeWallet(wallet),
    tokens: tokens ?? {},
  }));

const objectToVerifiedWallets = (verifiedWallets = {}) =>
  Object.entries(verifiedWallets).map(([wallet, verified]) => ({
    wallet: normalizeWallet(wallet),
    verified: Boolean(verified),
  }));

const dedupeByField = (docs = [], field) => {
  const byField = new Map();
  const withoutField = [];

  for (const doc of docs) {
    const value = doc?.[field];
    if (value === undefined || value === null || value === "") {
      withoutField.push(doc);
      continue;
    }
    byField.set(String(value), doc);
  }

  return [...byField.values(), ...withoutField];
};

const replaceCollection = async (database, collectionName, docs, options = {}) => {
  const collection = database.collection(collectionName);
  await collection.deleteMany({});
  const safeDocs = dedupeByField(docs.map((doc) => stripMongoId(doc, options)), "_id");
  if (safeDocs.length) {
    await collection.insertMany(safeDocs, { ordered: false });
  }
};

const removeLegacySeedData = async (database) => {
  await Promise.all([
    database.collection(collectionNames.users).deleteMany({
      $or: [{ holderDid: "did:key:demo-seller" }, { walletProvider: "seed" }, { walletAddress: { $in: legacySeedWallets } }],
    }),
    database.collection(collectionNames.properties).deleteMany({
      $or: [
        { _id: { $in: legacySeedPropertyIds } },
        { docStorageRef: /^seed:\/\// },
        { ownerWallet: { $in: legacySeedWallets }, tokenId: { $in: legacySeedTokenIds } },
      ],
    }),
    database.collection(collectionNames.listings).deleteMany({
      $or: [{ id: { $in: legacySeedListingIds } }, { sellerWallet: { $in: legacySeedWallets }, tokenId: { $in: legacySeedTokenIds } }],
    }),
    database.collection(collectionNames.balances).deleteMany({ wallet: { $in: legacySeedWallets } }),
    database.collection(collectionNames.approvals).deleteMany({ ownerWallet: { $in: legacySeedWallets } }),
    database.collection(collectionNames.transferEvents).deleteMany({
      $or: [{ id: /^(EVT-MINT-100[1-3]|EVT-SEED-)/ }, { tokenId: { $in: legacySeedTokenIds }, toWallet: { $in: legacySeedWallets } }],
    }),
    database.collection(collectionNames.auditLog).deleteMany({ $or: [{ id: "AUD-SEED-1" }, { action: "PLATFORM_SEEDED", target: "demo" }] }),
    database.collection(collectionNames.verifiedWallets).deleteMany({ wallet: { $in: legacySeedWallets } }),
  ]);

  const [state, remainingProperties] = await Promise.all([
    database.collection(collectionNames.meta).findOne({ _id: "state" }),
    database.collection(collectionNames.properties).countDocuments({}),
  ]);
  if (remainingProperties === 0 && Number(state?.nextTokenId) === 1004) {
    await database.collection(collectionNames.meta).updateOne({ _id: "state" }, { $set: { nextTokenId: 1, updatedAt: new Date() } });
  }
};

const writeMongoDb = async (db) => {
  const database = await mongoDb();

  await database.collection(collectionNames.meta).replaceOne(
    { _id: "state" },
    {
      _id: "state",
      version: db.version ?? 2,
      nextTokenId: db.nextTokenId ?? 1,
      updatedAt: new Date(),
    },
    { upsert: true },
  );

  await Promise.all([
    replaceCollection(database, collectionNames.users, db.users ?? []),
    replaceCollection(database, collectionNames.pendingSessions, db.pendingSessions ?? []),
    replaceCollection(database, collectionNames.walletChallenges, db.walletChallenges ?? []),
    replaceCollection(database, collectionNames.properties, db.properties ?? [], { keepStringId: true }),
    replaceCollection(database, collectionNames.listings, db.listings ?? []),
    replaceCollection(database, collectionNames.balances, objectToBalances(db.balances)),
    replaceCollection(database, collectionNames.approvals, db.approvals ?? []),
    replaceCollection(database, collectionNames.orders, db.orders ?? []),
    replaceCollection(database, collectionNames.leases, db.leases ?? []),
    replaceCollection(database, collectionNames.transferEvents, db.transferEvents ?? []),
    replaceCollection(database, collectionNames.auditLog, db.auditLog ?? []),
    replaceCollection(database, collectionNames.verifiedWallets, objectToVerifiedWallets(db.verifiedWallets)),
  ]);
};

const initializeMongoDb = async () => {
  const database = await mongoDb();
  await removeLegacySeedData(database);

  await Promise.all([
    database.collection(collectionNames.users).createIndex({ holderDid: 1 }),
    database.collection(collectionNames.users).createIndex({ privyWalletExternalId: 1 }),
    database.collection(collectionNames.users).createIndex({ sessionToken: 1 }),
    database.collection(collectionNames.properties).createIndex({ tokenId: 1 }),
    database.collection(collectionNames.listings).createIndex({ tokenId: 1, status: 1 }),
    database.collection(collectionNames.orders).createIndex({ buyerWallet: 1 }),
    database.collection(collectionNames.leases).createIndex({ tokenId: 1, status: 1 }),
    database.collection(collectionNames.leases).createIndex({ lessorWallet: 1 }),
    database.collection(collectionNames.leases).createIndex({ lesseeWallet: 1 }),
    database.collection(collectionNames.verifiedWallets).createIndex({ wallet: 1 }, { unique: true }),
  ]);

  const state = await database.collection(collectionNames.meta).findOne({ _id: "state" });
  if (!state) {
    await writeMongoDb(baseDb());
  }
};

const ensureMongoDb = async () => {
  if (!mongoReadyPromise) {
    mongoReadyPromise = withMongoRetry(initializeMongoDb);
  }

  return mongoReadyPromise;
};

const normalizeDb = (db) => {
  const normalizedDb = {
    ...baseDb(),
    ...db,
    users: db.users ?? [],
    pendingSessions: db.pendingSessions ?? [],
    walletChallenges: db.walletChallenges ?? [],
    properties: dedupeByField(db.properties ?? [], "_id"),
    listings: db.listings ?? [],
    verifiedWallets: hydrateVerifiedWallets(db),
    balances: db.balances ?? {},
    approvals: db.approvals ?? [],
    orders: db.orders ?? [],
    leases: db.leases ?? [],
    transferEvents: db.transferEvents ?? [],
    auditLog: db.auditLog ?? [],
  };

  normalizedDb.users = normalizedDb.users.map((user) => ({
    ...user,
    role: normalizeRole(user.role),
  }));
  normalizedDb.pendingSessions = normalizedDb.pendingSessions.map((session) => ({
    ...session,
    role: normalizeRole(session.role),
  }));

  return normalizedDb;
};

export const ensureDb = async () => {
  if (!USE_MONGODB) {
    throw new Error("MONGODB_URI is required. Local JSON app-state storage is disabled.");
  }

  await ensureMongoDb();
};

export const normalizeVerifiedWallets = (wallets = {}) =>
  Object.entries(wallets).reduce((acc, [wallet, verified]) => {
    const normalized = normalizeWallet(wallet);
    if (isWallet(normalized)) {
      acc[normalized] = Boolean(verified);
    }
    return acc;
  }, {});

export const hydrateVerifiedWallets = (db) => {
  const verifiedWallets = {
    ...seededVerifiedWallets(),
    ...normalizeVerifiedWallets(db.verifiedWallets),
  };

  for (const user of db.users ?? []) {
    const wallet = normalizeWallet(user.walletAddress);
    if (isWallet(wallet) && user.ndiVerifiedAt && !Object.prototype.hasOwnProperty.call(verifiedWallets, wallet)) {
      verifiedWallets[wallet] = true;
    }
  }

  return verifiedWallets;
};

export const readDb = async () => {
  await ensureDb();

  const database = await mongoDb();
  const [
    meta,
    users,
    pendingSessions,
    walletChallenges,
    properties,
    listings,
    balanceRows,
    approvals,
    orders,
    leases,
    transferEvents,
    auditLog,
    verifiedWalletRows,
  ] = await Promise.all([
    database.collection(collectionNames.meta).findOne({ _id: "state" }),
    collectionRows(database, collectionNames.users),
    collectionRows(database, collectionNames.pendingSessions),
    collectionRows(database, collectionNames.walletChallenges),
    collectionRows(database, collectionNames.properties, { keepStringId: true }),
    collectionRows(database, collectionNames.listings),
    collectionRows(database, collectionNames.balances),
    collectionRows(database, collectionNames.approvals),
    collectionRows(database, collectionNames.orders),
    collectionRows(database, collectionNames.leases),
    collectionRows(database, collectionNames.transferEvents),
    collectionRows(database, collectionNames.auditLog),
    collectionRows(database, collectionNames.verifiedWallets),
  ]);

  return normalizeDb({
    version: meta?.version ?? 2,
    nextTokenId: meta?.nextTokenId ?? 1,
    users,
    pendingSessions,
    walletChallenges,
    properties,
    listings,
    balances: balancesToObject(balanceRows),
    approvals,
    orders,
    leases,
    transferEvents,
    auditLog,
    verifiedWallets: verifiedWalletsToObject(verifiedWalletRows),
  });
};

export const writeDb = async (db) => {
  await ensureDb();
  await writeMongoDb(db);
};
