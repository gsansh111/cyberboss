const SYSTEM_PATTERNS = [
  /\baction:\s*send_message\b/,
  /\bNo reasoning\b/,
  /\bNo text outside the JSON\b/,
  /SYSTEM ACTION MODE/i,
  /internal trigger/i,
  /系统提醒/,
  /后台/,
  /memory.*流程/,
  /记忆分类/,
  /\.jsonl/,
  /\.md\b/,
  /index\.jsonl/,
  /pending\.jsonl/,
  /检索/,
  /冲突校验/,
  /冲突检测/,
  /增量追加/,
  /intent classifier/,
  /\bslot[":]/,
  /draft conflict/,
  /outgoing.*filter/,
  /MemoryService/,
  /pre-response/,
  /post-response/,
  /batch mining/,
  /候选记忆/,
  /低置信度/,
  /写入权重/,
];

const ALLOWED_EXEMPTIONS = [
  /["'`].*["'`]/,
];

function filterOutgoingMessage(text) {
  if (typeof text !== "string" || !text.trim()) {
    return text;
  }

  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    for (const exemption of ALLOWED_EXEMPTIONS) {
      if (exemption.test(trimmed)) return true;
    }

    for (const pattern of SYSTEM_PATTERNS) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    return true;
  });

  return filtered.join("\n").trim();
}

function containsSystemContent(text) {
  if (typeof text !== "string") return false;
  for (const pattern of SYSTEM_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

module.exports = { filterOutgoingMessage, containsSystemContent };
