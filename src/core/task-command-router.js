function createTaskCommandRouter(taskService) {
  function tryRoute(command, args) {
    switch (command) {
      case "list":    return handleList(args);
      case "create":  return handleCreate(args);
      case "show":    return handleShow(args);
      case "done":    return handleDone(args);
      case "cancel":  return handleCancel(args);
      case "delete":  return handleDelete(args);
      case "pending": return handlePending();
      default: return { ok: false, text: `未知命令：${command}。支持：list, create, show, done, cancel, delete, pending` };
    }
  }

  function handleList(filter) {
    const pending = taskService.listPending();
    if (!pending.length) return { ok: true, text: "当前没有未完成的任务" };
    const lines = pending.map((t) => {
      const icon = t.status === "in_progress" ? " ▶" : " ○";
      const p = { high: "高", medium: "中", low: "低" }[t.priority] || "中";
      const due = t.dueDate ? ` [截止 ${t.dueDate}]` : "";
      const project = t.project ? `[${t.project}]` : "";
      return `${icon} ${project} ${t.title}（${p}优先级${due}）(${t.id})`;
    });
    return { ok: true, text: `未完成任务（${pending.length}个）：\n${lines.join("\n")}` };
  }

  function handleCreate(raw) {
    if (!raw || !raw.trim()) return { ok: false, text: "用法：/task create <标题>" };
    const task = taskService.create({ title: raw.trim() });
    return { ok: true, text: `已创建任务：${task.title} (${task.id})` };
  }

  function handleShow(id) {
    if (!id) return { ok: false, text: "用法：/task show <id>" };
    const task = taskService.getById(id);
    if (!task) return { ok: true, text: `未找到任务：${id}` };
    return {
      ok: true,
      text: [
        `ID: ${task.id}`,
        `标题: ${task.title}`,
        `状态: ${task.status}`,
        `优先级: ${task.priority}`,
        task.project ? `项目: ${task.project}` : null,
        task.dueDate ? `截止: ${task.dueDate}` : null,
        task.tags.length ? `标签: ${task.tags.join(", ")}` : null,
        `创建: ${task.createdAt}`,
        `更新: ${task.updatedAt}`,
      ].filter(Boolean).join("\n"),
    };
  }

  function handleDone(id) {
    if (!id) return { ok: false, text: "用法：/task done <id>" };
    const task = taskService.markDone(id);
    if (!task) return { ok: true, text: `未找到任务：${id}` };
    return { ok: true, text: `已完成：${task.title}` };
  }

  function handleCancel(id) {
    if (!id) return { ok: false, text: "用法：/task cancel <id>" };
    const task = taskService.markCancelled(id);
    if (!task) return { ok: true, text: `未找到任务：${id}` };
    return { ok: true, text: `已取消：${task.title}` };
  }

  function handleDelete(id) {
    if (!id) return { ok: false, text: "用法：/task delete <id>" };
    const ok = taskService.delete(id);
    if (!ok) return { ok: true, text: `未找到任务：${id}` };
    return { ok: true, text: `已删除任务：${id}` };
  }

  function handlePending() {
    return handleList("");
  }

  return { tryRoute };
}

module.exports = { createTaskCommandRouter };
