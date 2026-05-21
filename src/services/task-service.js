const { TaskStore } = require("./task-store");

class TaskService {
  constructor({ config }) {
    this.config = config;
    this.store = new TaskStore({ filePath: config.taskFile });
  }

  generateId() {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    return `tsk_${datePart}_${rand}`;
  }

  create({ title, project = "", priority = "medium", dueDate = "", tags = [] } = {}) {
    if (!title || !title.trim()) {
      throw new Error("Task title is required.");
    }
    const now = new Date().toISOString();
    const task = {
      id: this.generateId(),
      title: title.trim(),
      status: "pending",
      priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
      project: project.trim(),
      dueDate: dueDate.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };
    return this.store.insert(task);
  }

  getById(id) {
    return this.store.getById(id);
  }

  update(id, updates) {
    const allowed = ["title", "status", "priority", "project", "dueDate", "tags"];
    const filtered = {};
    for (const key of allowed) {
      if (key in updates) {
        filtered[key] = updates[key];
      }
    }
    if (Object.keys(filtered).length === 0) return null;
    return this.store.update(id, filtered);
  }

  markDone(id) {
    return this.store.update(id, { status: "done" });
  }

  markCancelled(id) {
    return this.store.update(id, { status: "cancelled" });
  }

  markInProgress(id) {
    return this.store.update(id, { status: "in_progress" });
  }

  markPending(id) {
    return this.store.update(id, { status: "pending" });
  }

  list(filter = {}) {
    const cleaned = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== "") {
        cleaned[key] = value;
      }
    }
    return this.store.list(cleaned);
  }

  listPending() {
    return this.store.list().filter((t) => t.status === "pending" || t.status === "in_progress");
  }

  delete(id) {
    return this.store.delete(id);
  }

  buildContext() {
    const pending = this.listPending();
    if (!pending.length) return "";

    const lines = ["[当前任务]"];
    const byProject = {};
    for (const task of pending) {
      const project = task.project || "未分类";
      if (!byProject[project]) byProject[project] = [];
      byProject[project].push(task);
    }

    for (const [project, tasks] of Object.entries(byProject)) {
      lines.push(`项目"${project}"：`);
      for (const task of tasks) {
        const statusIcon = task.status === "in_progress" ? " ▶" : "";
        const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority] || "中";
        const duePart = task.dueDate ? `，截止 ${task.dueDate}` : "";
        lines.push(`  - ${task.title}${statusIcon}（${priorityLabel}优先级${duePart}）`);
      }
    }

    lines.push(`共 ${pending.length} 个未完成任务`);
    return lines.join("\n");
  }
}

module.exports = { TaskService };
