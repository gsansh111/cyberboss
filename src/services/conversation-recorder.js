const fs = require("fs");
const path = require("path");

function createConversationRecorder(config) {
  const stateDir = config?.stateDir || process.env.CYBERBOSS_STATE_DIR;
  if (!stateDir) {
    console.warn("[conversation-recorder] no stateDir configured, recording disabled");
    return null;
  }

  const conversationsDir = path.join(stateDir, "conversations");
  try {
    fs.mkdirSync(conversationsDir, { recursive: true });
  } catch {
    console.warn("[conversation-recorder] could not create conversations dir, recording disabled");
    return null;
  }

  function append(entry) {
    const date = (entry.timestamp || new Date().toISOString()).slice(0, 10);
    const filePath = path.join(conversationsDir, `${date}.jsonl`);
    try {
      fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      console.error(`[conversation-recorder] write error: ${err.message}`);
    }
  }

  function recordInbound(prepared) {
    if (!prepared?.senderId) return;
    append({
      type: "message",
      direction: "inbound",
      timestamp: prepared.receivedAt || new Date().toISOString(),
      senderId: prepared.senderId,
      accountId: prepared.accountId || "",
      workspaceId: prepared.workspaceId || "",
      messageId: prepared.messageId || "",
      text: prepared.originalText || prepared.text || "",
      meta: {
        attachments: (prepared.attachments || []).map((a) => ({
          kind: a.kind || "",
          label: a.label || "",
          fileName: a.fileName || "",
          filePath: a.filePath || "",
        })),
        provider: prepared.provider || "",
      },
    });
  }

  function recordOutbound(event) {
    if (!event?.payload) return;
    const userId = event.payload.senderId
      || event.payload.userId
      || "";
    if (!userId && event.type !== "runtime.turn.completed") return;

    if (event.type === "runtime.reply.completed" && event.payload.text) {
      append({
        type: "message",
        direction: "outbound",
        timestamp: new Date().toISOString(),
        senderId: userId,
        threadId: event.payload.threadId || "",
        turnId: event.payload.turnId || "",
        text: event.payload.text,
        meta: {},
      });
    } else if (event.type === "runtime.turn.failed" && event.payload.text) {
      append({
        type: "error",
        direction: "outbound",
        timestamp: new Date().toISOString(),
        senderId: userId,
        threadId: event.payload.threadId || "",
        turnId: event.payload.turnId || "",
        text: event.payload.text,
        meta: {},
      });
    } else if (event.type === "runtime.turn.completed") {
      append({
        type: "turn.completed",
        direction: "outbound",
        timestamp: new Date().toISOString(),
        senderId: userId,
        threadId: event.payload.threadId || "",
        turnId: event.payload.turnId || "",
        text: "",
        meta: {},
      });
    }
  }

  return { recordInbound, recordOutbound };
}

module.exports = { createConversationRecorder };
