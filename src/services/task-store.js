const fs = require("fs");
const path = require("path");

class TaskStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    this.state = { tasks: [] };
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
      this.state = { tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [] };
    } catch {
      this.state = { tasks: [] };
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  insert(task) {
    this.load();
    this.state.tasks.push(task);
    this.save();
    return task;
  }

  update(id, updates) {
    this.load();
    const index = this.state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const updated = { ...this.state.tasks[index], ...updates, updatedAt: new Date().toISOString() };
    this.state.tasks[index] = updated;
    this.save();
    return updated;
  }

  delete(id) {
    this.load();
    const index = this.state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.state.tasks.splice(index, 1);
    this.save();
    return true;
  }

  getById(id) {
    this.load();
    return this.state.tasks.find((t) => t.id === id) || null;
  }

  list(filter = {}) {
    this.load();
    let tasks = this.state.tasks;
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== "") {
        tasks = tasks.filter((t) => t[key] === value);
      }
    }
    return tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPrio = priorityOrder[a.priority] ?? 1;
      const bPrio = priorityOrder[b.priority] ?? 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }
}

module.exports = { TaskStore };
