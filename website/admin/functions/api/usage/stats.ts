import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import { fetchSiteData } from "../_shared/site-data.js";

const INSTALLS_PREFIX = "usage:install:";
const INSTALLS_INDEX_KEY = "usage:installs:index";

function daysAgoMs(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function bump(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function loadInstallRecords(env) {
  if (!env.ADMIN_KV?.get) return [];
  let ids = [];
  try {
    const raw = await env.ADMIN_KV.get(INSTALLS_INDEX_KEY);
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }

  const records = [];
  for (const id of ids) {
    try {
      const raw = await env.ADMIN_KV.get(`${INSTALLS_PREFIX}${id}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        records.push(parsed);
      }
    } catch {
      // skip bad rows
    }
  }
  return records;
}

function aggregate(records) {
  const now = Date.now();
  const cut5m = now - 5 * 60 * 1000;
  const cut1h = now - 60 * 60 * 1000;
  const cut24h = now - 24 * 60 * 60 * 1000;
  const cut7 = daysAgoMs(7);
  const cut30 = daysAgoMs(30);
  const byOs = {};
  const byHost = {};
  let activeNow = 0;
  let unique1h = 0;
  let unique24h = 0;
  let unique7d = 0;
  let unique30d = 0;
  let uniqueAll = 0;

  for (const r of records) {
    uniqueAll += 1;
    const seen = Date.parse(r.lastSeenAt || "") || 0;
    if (seen >= cut5m) activeNow += 1;
    if (seen >= cut1h) unique1h += 1;
    if (seen >= cut24h) unique24h += 1;
    if (seen >= cut7) unique7d += 1;
    if (seen >= cut30) unique30d += 1;
    bump(byOs, r.os || "unknown");
    bump(byHost, r.host || "unknown");
  }

  return { activeNow, unique1h, unique24h, unique7d, unique30d, uniqueAll, byOs, byHost };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const records = await loadInstallRecords(env);
  const optIn = aggregate(records);

  let downloads = null;
  let visits = null;
  try {
    const site = await fetchSiteData(env);
    downloads = site?.downloads ?? site?.marketplace ?? null;
    visits = site?.visitors ?? null;
  } catch {
    // optional enrichment
  }

  return jsonResponse({
    optInUniques: optIn,
    marketplace: downloads,
    visitors: visits,
    updatedAt: new Date().toISOString(),
  });
}
