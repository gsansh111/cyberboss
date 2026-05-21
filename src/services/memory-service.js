const fs = require("fs");
const path = require("path");
const os = require("os");

function createMemoryService(config) {
  const stateDir = config?.stateDir || process.env.CYBERBOSS_STATE_DIR || path.join(os.homedir(), ".cyberboss");
  const memoryDir = path.join(stateDir, "memory");

  let _indexCache = null;
  let _indexCacheTime = 0;
  const INDEX_CACHE_TTL_MS = 5000;

  ensureMemoryDir();

  function ensureMemoryDir() {
    try {
      fs.mkdirSync(memoryDir, { recursive: true });
      for (const file of ["index.jsonl", "pending.jsonl", "ops.jsonl"]) {
        const filePath = path.join(memoryDir, file);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, "", "utf8");
        }
      }
    } catch (err) {
      console.error(`[memory-service] failed to init: ${err.message}`);
    }
  }

  function indexPath() {
    return path.join(memoryDir, "index.jsonl");
  }
  function pendingPath() {
    return path.join(memoryDir, "pending.jsonl");
  }
  function opsPath() {
    return path.join(memoryDir, "ops.jsonl");
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function generateId(category) {
    const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const rand = Math.random().toString(36).slice(2, 6);
    return `mem_${category}_${ts}_${rand}`;
  }

  // ---- Index ----

  function readIndex(filter) {
    const mtime = fs.statSync(indexPath()).mtimeMs;
    if (_indexCache && _indexCacheTime > Date.now() - INDEX_CACHE_TTL_MS && mtime <= _indexCacheTime) {
      return applyFilter(_indexCache, filter);
    }
    const entries = [];
    try {
      const raw = fs.readFileSync(indexPath(), "utf8");
      for (const line of raw.split("\n").filter(Boolean)) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip malformed */ }
      }
    } catch { /* no file yet */ }
    _indexCache = entries;
    _indexCacheTime = Date.now();
    return applyFilter(entries, filter);
  }

  function applyFilter(entries, filter) {
    if (!filter || !Object.keys(filter).length) return entries;
    return entries.filter((e) => {
      for (const [key, value] of Object.entries(filter)) {
        if (e[key] !== value) return false;
      }
      return true;
    });
  }

  function appendIndex(entry) {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(indexPath(), line, "utf8");
    if (_indexCache) _indexCache.push(entry);
    logOp("index.append", { id: entry.id, category: entry.category });
  }

  // ---- Markdown Files ----

  function listMarkdownFiles() {
    try {
      return fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  }

  function readMarkdown(category) {
    const filePath = path.join(memoryDir, `${category}.md`);
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch {
      return "";
    }
  }

  function appendMarkdown(category, text) {
    const filePath = path.join(memoryDir, `${category}.md`);
    try {
      fs.appendFileSync(filePath, `\n${text}`, "utf8");
      return true;
    } catch (err) {
      console.error(`[memory-service] appendMarkdown error: ${err.message}`);
      return false;
    }
  }

  function backupBeforeRewrite(filePath) {
    const backupPath = filePath + ".bak";
    try {
      fs.copyFileSync(filePath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  // ---- Pending ----

  function readPending() {
    const entries = [];
    try {
      const raw = fs.readFileSync(pendingPath(), "utf8");
      for (const line of raw.split("\n").filter(Boolean)) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip */ }
      }
    } catch { /* no file */ }
    return entries;
  }

  function appendPending(candidate) {
    const entry = {
      ...candidate,
      id: candidate.id || generateId("pending"),
      status: "pending",
      createdAt: nowISO(),
    };
    fs.appendFileSync(pendingPath(), JSON.stringify(entry) + "\n", "utf8");
    logOp("pending.append", { id: entry.id });
    return entry;
  }

  function approvePending(id) {
    const entries = readPending();
    const target = entries.find((e) => e.id === id);
    if (!target) return null;
    const active = {
      ...target,
      status: "active",
      approvedAt: nowISO(),
    };
    appendIndex(active);
    removePendingLine(id);
    logOp("pending.approve", { id });
    return active;
  }

  function rejectPending(id) {
    removePendingLine(id);
    logOp("pending.reject", { id });
    return true;
  }

  function removePendingLine(id) {
    const entries = readPending();
    const filtered = entries.filter((e) => e.id !== id);
    fs.writeFileSync(pendingPath(), filtered.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }

  // ---- Ops Log ----

  function logOp(action, detail) {
    try {
      const entry = JSON.stringify({ action, detail, timestamp: nowISO() }) + "\n";
      fs.appendFileSync(opsPath(), entry, "utf8");
    } catch { /* best effort */ }
  }

  // ---- Search ----

  function searchMemory(query) {
    const lowerQuery = String(query).toLowerCase();
    const entries = readIndex();
    return entries.filter((e) => {
      const searchable = [e.title, e.description, e.key, e.text, ...(e.tags || [])].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(lowerQuery);
    });
  }

  // ---- Conflict Detection ----

  function findDuplicate(candidate) {
    const entries = readIndex({ status: "active" });
    return entries.find((e) => {
      if (candidate.category && e.category !== candidate.category) return false;
      if (candidate.key && e.key === candidate.key) return true;
      if (candidate.text && e.text === candidate.text) return true;
      return false;
    }) || null;
  }

  function findConflict(candidate) {
    const entries = readIndex({ status: "active" });
    return entries.find((e) => {
      if (e.priority === "hard_fact" || e.priority === "hard_preference") {
        if (candidate.key && e.key === candidate.key) {
          const newVal = String(candidate.value ?? "");
          const oldVal = String(e.value ?? "");
          if (newVal && oldVal && newVal !== oldVal) return true;
        }
      }
      return false;
    }) || null;
  }

  // ---- CRUD ----

  function findById(id) {
    return readIndex().find((e) => e.id === id) || null;
  }

  function markDeleted(id) {
    const entries = readIndex();
    const target = entries.find((e) => e.id === id);
    if (!target) return null;
    target.status = "deleted";
    target.updatedAt = nowISO();
    rewriteIndex(entries);
    logOp("index.delete", { id });
    return target;
  }

  function markSuperseded(id) {
    const entries = readIndex();
    const target = entries.find((e) => e.id === id);
    if (!target) return null;
    target.status = "superseded";
    target.updatedAt = nowISO();
    rewriteIndex(entries);
    logOp("index.supersede", { id });
    return target;
  }

  function updateMemory(id, updates) {
    const entries = readIndex();
    const target = entries.find((e) => e.id === id);
    if (!target) return null;
    Object.assign(target, updates, { updatedAt: nowISO() });
    rewriteIndex(entries);
    logOp("index.update", { id, updates: Object.keys(updates) });
    return target;
  }

  function rewriteIndex(entries) {
    _indexCache = entries;
    _indexCacheTime = Date.now();
    fs.writeFileSync(indexPath(), entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }

  function undoLastWrite() {
    const ops = readOps();
    const lastIndexAppend = ops.reverse().find((o) => o.action === "index.append");
    if (lastIndexAppend) {
      markDeleted(lastIndexAppend.detail.id);
      logOp("index.undo", { id: lastIndexAppend.detail.id });
      return lastIndexAppend.detail;
    }
    return null;
  }

  function readOps() {
    const entries = [];
    try {
      const raw = fs.readFileSync(opsPath(), "utf8");
      for (const line of raw.split("\n").filter(Boolean)) {
        try { entries.push(JSON.parse(line)); } catch { /* skip */ }
      }
    } catch { /* no file */ }
    return entries;
  }

  // ---- Query Helpers ----

  function getActiveByCategory(category) {
    return readIndex({ category, status: "active" });
  }

  function getActiveByType(type) {
    return readIndex({ type, status: "active" });
  }

  function pruneCategory(category) {
    const filePath = path.join(memoryDir, `${category}.md`);
    const backup = backupBeforeRewrite(filePath);
    fs.writeFileSync(filePath, `# ${category}\n\n`, "utf8");
    const entries = readIndex();
    const remaining = entries.filter((e) => e.category !== category || e.status !== "active");
    rewriteIndex(remaining);
    logOp("prune", { category, backup });
    return { backup, pruned: entries.length - remaining.length };
  }

  return {
    // Core
    readIndex,
    appendIndex,
    readMarkdown,
    appendMarkdown,
    listMarkdownFiles,

    // Pending
    readPending,
    appendPending,
    approvePending,
    rejectPending,

    // CRUD
    findById,
    searchMemory,
    findDuplicate,
    findConflict,
    markDeleted,
    markSuperseded,
    updateMemory,
    undoLastWrite,

    // Query
    getActiveByCategory,
    getActiveByType,

    // Maintenance
    pruneCategory,
    backupBeforeRewrite,
    logOp,
  };
}

module.exports = { createMemoryService };
