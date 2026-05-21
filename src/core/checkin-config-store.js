const fs = require("fs");
const path = require("path");

const DEFAULT_MIN_INTERVAL_MS = 3 * 60_000;
const DEFAULT_MAX_INTERVAL_MS = 60 * 60_000;
const DEFAULT_SLEEP_MIN_INTERVAL_MS = 4 * 60 * 60_000;
const DEFAULT_SLEEP_MAX_INTERVAL_MS = 6 * 60 * 60_000;

const SLEEP_HOUR_START = 0;
const SLEEP_HOUR_END = 8;

const SLEEP_KEYWORDS = [
  "晚安", "睡了", "睡觉了", "去睡了", "去睡", "我睡了", "我睡啦", "睡啦",
  "goodnight", "good night", "sleep", "going to bed", "gonna sleep",
];

class CheckinConfigStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    this.state = {};
    this.ensureParentDirectory();
    this.load();
  }

  ensureParentDirectory() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = normalizePersistedState(parsed) || {};
    } catch {
      this.state = {};
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  getRange(fallbackRange = resolveDefaultCheckinRange()) {
    this.load();
    return normalizeIntervalRange(this.state, fallbackRange);
  }

  setRange(range) {
    const normalized = normalizeIntervalRange(range);
    this.state = { ...this.state, ...normalized };
    this.save();
    return { ...normalized };
  }

  isSleepHour() {
    return isSleepHour();
  }

  isSleeping() {
    this.load();
    if (this.state.sleeping === true) return true;
    return isSleepHour();
  }

  setSleeping(sleeping) {
    this.load();
    this.state.sleeping = sleeping;
    this.state.sleepStateChangedAt = new Date().toISOString();
    this.save();
  }

  getSleepRange() {
    const envMin = readIntervalMs(process.env?.CYBERBOSS_CHECKIN_SLEEP_MIN_INTERVAL_MS, DEFAULT_SLEEP_MIN_INTERVAL_MS);
    const envMax = Math.max(
      envMin,
      readIntervalMs(process.env?.CYBERBOSS_CHECKIN_SLEEP_MAX_INTERVAL_MS, DEFAULT_SLEEP_MAX_INTERVAL_MS)
    );
    const persistedMin = normalizePositiveInteger(this.state.sleepMinIntervalMs);
    const persistedMax = normalizePositiveInteger(this.state.sleepMaxIntervalMs);
    return {
      minIntervalMs: persistedMin || envMin,
      maxIntervalMs: Math.max(persistedMin || envMin, persistedMax || envMax),
    };
  }

  getEffectiveRange(fallbackRange = resolveDefaultCheckinRange()) {
    if (this.isSleeping()) {
      return this.getSleepRange();
    }
    return this.getRange(fallbackRange);
  }
}

function detectSleepIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return SLEEP_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isSleepHour() {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  }).format(now));
  return hour >= SLEEP_HOUR_START && hour < SLEEP_HOUR_END;
}

function resolveDefaultCheckinRange(env = process.env) {
  const minIntervalMs = readIntervalMs(env?.CYBERBOSS_CHECKIN_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS);
  const maxIntervalMs = Math.max(
    minIntervalMs,
    readIntervalMs(env?.CYBERBOSS_CHECKIN_MAX_INTERVAL_MS, DEFAULT_MAX_INTERVAL_MS)
  );
  return { minIntervalMs, maxIntervalMs };
}

function parseCheckinRangeMinutes(input) {
  const normalized = typeof input === "string" ? input.trim() : "";
  const match = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const minMinutes = Number.parseInt(match[1], 10);
  const maxMinutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes) || minMinutes <= 0 || maxMinutes <= 0 || maxMinutes < minMinutes) {
    return null;
  }
  return { minMinutes, maxMinutes };
}

function normalizePersistedState(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const minIntervalMs = normalizePositiveInteger(value.minIntervalMs);
  const maxIntervalMs = normalizePositiveInteger(value.maxIntervalMs);
  if (!minIntervalMs || !maxIntervalMs) {
    if (value.sleeping !== undefined || value.sleepStateChangedAt !== undefined) {
      return {
        sleeping: value.sleeping === true,
        sleepStateChangedAt: String(value.sleepStateChangedAt || ""),
      };
    }
    return null;
  }
  return {
    minIntervalMs,
    maxIntervalMs: Math.max(minIntervalMs, maxIntervalMs),
    sleeping: value.sleeping === true,
    sleepStateChangedAt: String(value.sleepStateChangedAt || ""),
    sleepMinIntervalMs: normalizePositiveInteger(value.sleepMinIntervalMs) || undefined,
    sleepMaxIntervalMs: normalizePositiveInteger(value.sleepMaxIntervalMs) || undefined,
  };
}

function normalizePersistedRange(value) {
  const state = normalizePersistedState(value);
  if (!state || !state.minIntervalMs || !state.maxIntervalMs) return null;
  return { minIntervalMs: state.minIntervalMs, maxIntervalMs: state.maxIntervalMs };
}

function normalizeIntervalRange(value, fallbackRange = resolveDefaultCheckinRange()) {
  const fallback = normalizePersistedRange(fallbackRange) || {
    minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
    maxIntervalMs: DEFAULT_MAX_INTERVAL_MS,
  };
  const normalized = normalizePersistedRange(value);
  return normalized || fallback;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readIntervalMs(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  CheckinConfigStore,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_MAX_INTERVAL_MS,
  DEFAULT_SLEEP_MIN_INTERVAL_MS,
  DEFAULT_SLEEP_MAX_INTERVAL_MS,
  SLEEP_HOUR_START,
  SLEEP_HOUR_END,
  parseCheckinRangeMinutes,
  resolveDefaultCheckinRange,
  detectSleepIntent,
  isSleepHour,
};
