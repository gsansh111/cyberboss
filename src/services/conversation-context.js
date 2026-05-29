const fs = require('fs');
const path = require('path');

function createConversationContext(config) {
  const stateDir = config?.stateDir || path.join(require('os').homedir(), '.cyberboss');
  const convDir = path.join(stateDir, 'conversations');

  try { fs.mkdirSync(convDir, { recursive: true }); } catch {}

  function todayFile() {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(convDir, date + '.jsonl');
  }

  function recordInbound(text, senderId) {
    if (!text || !senderId) return;
    try {
      const entry = JSON.stringify({
        time: new Date().toISOString(),
        who: '小航',
        text: String(text).slice(0, 2000),
      }) + '\n';
      fs.appendFileSync(todayFile(), entry, 'utf8');
    } catch {}
  }

  function recordOutbound(text, userId) {
    if (!text || !userId) return;
    try {
      const entry = JSON.stringify({
        time: new Date().toISOString(),
        who: '丹恒',
        text: String(text).slice(0, 2000),
      }) + '\n';
      fs.appendFileSync(todayFile(), entry, 'utf8');
    } catch {}
  }

  function loadRecent(maxCount) {
    if (!maxCount) maxCount = 30;
    try {
      const files = [];
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      for (const d of [yesterday, today]) {
        const f = path.join(convDir, d + '.jsonl');
        if (fs.existsSync(f)) files.push(f);
      }

      const messages = [];
      for (const f of files) {
        const raw = fs.readFileSync(f, 'utf8');
        for (const line of raw.split('\n').filter(Boolean)) {
          try { messages.push(JSON.parse(line)); } catch {}
        }
      }

      const recent = messages.slice(-maxCount);
      if (!recent.length) return '';

      return 'Recent conversation (for context, do not re-send these):\n' +
        recent.map(function(m) {
          var t = (m.time || '').slice(11, 16);
          var txt = (m.text || '').slice(0, 300);
          return '[' + t + '] ' + m.who + ': ' + txt;
        }).join('\n');
    } catch {
      return '';
    }
  }

  return { recordInbound, recordOutbound, loadRecent };
}

module.exports = { createConversationContext };
