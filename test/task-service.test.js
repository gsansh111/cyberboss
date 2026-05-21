const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { TaskService } = require("../src/services/task-service");

function createTempService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "task-test-"));
  const config = { taskFile: path.join(dir, "tasks.json") };
  return { service: new TaskService({ config }), dir };
}

test("create returns task with required fields", () => {
  const { service } = createTempService();
  const task = service.create({ title: "测试任务" });
  assert.ok(task.id.startsWith("tsk_"));
  assert.equal(task.title, "测试任务");
  assert.equal(task.status, "pending");
  assert.equal(task.priority, "medium");
  assert.equal(task.project, "");
  assert.equal(task.dueDate, "");
  assert.deepEqual(task.tags, []);
  assert.ok(task.createdAt);
  assert.ok(task.updatedAt);
});

test("create with all optional fields", () => {
  const { service } = createTempService();
  const task = service.create({
    title: "刷题到第8章",
    project: "学习",
    priority: "high",
    dueDate: "2026-05-25",
    tags: ["刷题", "考研"],
  });
  assert.equal(task.title, "刷题到第8章");
  assert.equal(task.project, "学习");
  assert.equal(task.priority, "high");
  assert.equal(task.dueDate, "2026-05-25");
  assert.deepEqual(task.tags, ["刷题", "考研"]);
});

test("create throws on empty title", () => {
  const { service } = createTempService();
  assert.throws(() => service.create({ title: "" }), /title is required/);
  assert.throws(() => service.create({ title: "  " }), /title is required/);
  assert.throws(() => service.create(), /title is required/);
});

test("markDone changes status to done", () => {
  const { service } = createTempService();
  const task = service.create({ title: "待完成" });
  const done = service.markDone(task.id);
  assert.equal(done.status, "done");
  assert.ok(new Date(done.updatedAt) >= new Date(done.createdAt));
});

test("markCancelled changes status", () => {
  const { service } = createTempService();
  const task = service.create({ title: "取消的" });
  const cancelled = service.markCancelled(task.id);
  assert.equal(cancelled.status, "cancelled");
});

test("markInProgress changes status", () => {
  const { service } = createTempService();
  const task = service.create({ title: "进行中" });
  const progress = service.markInProgress(task.id);
  assert.equal(progress.status, "in_progress");
});

test("update changes specified fields", () => {
  const { service } = createTempService();
  const task = service.create({ title: "旧标题", project: "旧项目" });
  const updated = service.update(task.id, { title: "新标题", priority: "high" });
  assert.equal(updated.title, "新标题");
  assert.equal(updated.priority, "high");
  assert.equal(updated.project, "旧项目");
});

test("update returns null for unknown id", () => {
  const { service } = createTempService();
  const result = service.update("nonexistent", { title: "新" });
  assert.equal(result, null);
});

test("listPending only returns active tasks", () => {
  const { service } = createTempService();
  service.create({ title: "待办1" });
  const t2 = service.create({ title: "待办2" });
  service.create({ title: "待办3" });
  service.markDone(t2.id);

  const pending = service.listPending();
  assert.equal(pending.length, 2);
});

test("list filters by project", () => {
  const { service } = createTempService();
  service.create({ title: "学习任务", project: "学习" });
  service.create({ title: "生活任务", project: "生活" });

  const study = service.list({ project: "学习" });
  assert.equal(study.length, 1);
  assert.equal(study[0].title, "学习任务");
});

test("delete removes task", () => {
  const { service } = createTempService();
  const task = service.create({ title: "要删除的" });
  assert.ok(service.getById(task.id));
  assert.ok(service.delete(task.id));
  assert.equal(service.getById(task.id), null);
});

test("delete returns false for unknown id", () => {
  const { service } = createTempService();
  assert.equal(service.delete("nonexistent"), false);
});

test("buildContext returns formatted string with pending tasks", () => {
  const { service } = createTempService();
  service.create({ title: "任务A", project: "学习", priority: "high" });
  service.create({ title: "任务B", project: "生活", priority: "low" });

  const ctx = service.buildContext();
  assert.ok(ctx.includes("[当前任务]"));
  assert.ok(ctx.includes("任务A"));
  assert.ok(ctx.includes("任务B"));
  assert.ok(ctx.includes('项目"学习"'));
  assert.ok(ctx.includes('项目"生活"'));
  assert.ok(ctx.includes("2 个未完成任务"));
});

test("buildContext returns empty when no pending tasks", () => {
  const { service } = createTempService();
  assert.equal(service.buildContext(), "");
});

test("tasks persist across service instances", () => {
  const { service, dir } = createTempService();
  service.create({ title: "持久化测试" });

  const service2 = new TaskService({ config: { taskFile: path.join(dir, "tasks.json") } });
  const tasks = service2.listPending();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "持久化测试");
});
