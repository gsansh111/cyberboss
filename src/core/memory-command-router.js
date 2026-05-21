function createMemoryCommandRouter(memoryService) {
  if (!memoryService) {
    throw new Error("memoryService is required");
  }

  function tryRoute(command, args) {
    switch (command) {
      case "search":
        return handleSearch(args);
      case "show":
        return handleShow(args);
      case "forget":
        return handleForget(args);
      case "update":
        return handleUpdate(args);
      case "undo":
        return handleUndo();
      case "pending":
        return handlePending();
      case "approve":
        return handleApprove(args);
      case "reject":
        return handleReject(args);
      case "prune":
        return handlePrune(args);
      case "mine":
        return handleMine();
      default:
        return { ok: false, text: `未知命令：${command}。支持：search, show, forget, update, undo, pending, approve, reject, prune, mine` };
    }
  }

  function handleSearch(query) {
    if (!query) return { ok: false, text: "用法：/memory search <关键词>" };
    const results = memoryService.searchMemory(query);
    if (!results.length) return { ok: true, text: `没有找到包含"${query}"的记忆` };
    const lines = results.slice(0, 10).map((r) =>
      `[${r.id}] ${r.title || r.key || "(无标题)"} — ${(r.description || r.text || "").slice(0, 60)}`
    );
    return { ok: true, text: `找到 ${results.length} 条结果（显示前10条）：\n${lines.join("\n")}` };
  }

  function handleShow(category) {
    if (!category) return { ok: false, text: "用法：/memory show <分类名>（如 facts, preferences, patterns）" };
    const entries = memoryService.getActiveByCategory(category);
    if (!entries.length) {
      const content = memoryService.readMarkdown(category);
      if (content) return { ok: true, text: `[${category}]\n${content.slice(0, 1000)}` };
      return { ok: true, text: `分类"${category}"没有内容` };
    }
    const lines = entries.map((r) => `- ${r.title || r.key}: ${(r.description || r.text || "").slice(0, 80)}`);
    return { ok: true, text: `[${category}] ${entries.length}条记录：\n${lines.join("\n")}` };
  }

  function handleForget(query) {
    if (!query) return { ok: false, text: "用法：/memory forget <关键词或id>" };
    const results = memoryService.searchMemory(query);
    if (!results.length) return { ok: true, text: `没有找到匹配"${query}"的记忆` };
    const target = results[0];
    memoryService.markDeleted(target.id);
    return { ok: true, text: `已删除：${target.title || target.key || target.id}` };
  }

  function handleUpdate(args) {
    const parts = (args || "").split(/\s+/);
    if (parts.length < 2) return { ok: false, text: "用法：/memory update <id> <新值>" };
    const [id, ...rest] = parts;
    const newValue = rest.join(" ");
    const updated = memoryService.updateMemory(id, { text: newValue });
    if (!updated) return { ok: true, text: `未找到id为"${id}"的记录` };
    return { ok: true, text: `已更新：${id}` };
  }

  function handleUndo() {
    const undone = memoryService.undoLastWrite();
    if (!undone) return { ok: true, text: "没有可撤销的写入" };
    return { ok: true, text: `已撤销写入：${undone.id}` };
  }

  function handlePending() {
    const pending = memoryService.readPending();
    if (!pending.length) return { ok: true, text: "没有待确认的记忆候选" };
    const lines = pending.map((p) => `[${p.id}] ${p.text || p.title || "(无内容)"}`);
    return { ok: true, text: `待确认（${pending.length}条）：\n${lines.join("\n")}` };
  }

  function handleApprove(id) {
    if (!id) return { ok: false, text: "用法：/memory approve <pending_id>" };
    const result = memoryService.approvePending(id);
    if (!result) return { ok: true, text: `未找到id为"${id}"的待确认项` };
    return { ok: true, text: `已确认：${result.title || result.text || id}` };
  }

  function handleReject(id) {
    if (!id) return { ok: false, text: "用法：/memory reject <pending_id>" };
    memoryService.rejectPending(id);
    return { ok: true, text: `已拒绝：${id}` };
  }

  function handlePrune(category) {
    if (!category) return { ok: false, text: "用法：/memory prune <分类名>" };
    const result = memoryService.pruneCategory(category);
    return { ok: true, text: `已清理分类"${category}"，备份：${result.backup}，清理：${result.pruned}条` };
  }

  function handleMine() {
    return { ok: true, text: "手动挖掘功能待实现" };
  }

  return { tryRoute };
}

module.exports = { createMemoryCommandRouter };
