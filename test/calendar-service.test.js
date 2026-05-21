const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CalendarService } = require("../src/services/calendar-service");

function createTempService(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-test-"));
  const filePath = path.join(dir, "calendar-2026.json");
  fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
  return new CalendarService({ dataDir: dir });
}

const SAMPLE_DATA = {
  year: 2026,
  holidays: [
    "2026-01-01", "2026-01-02", "2026-01-03",
    "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
    "2026-04-04", "2026-04-05", "2026-04-06",
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
  ],
  adjustedWorkdays: [
    "2026-02-14", "2026-02-28", "2026-04-26", "2026-05-09", "2026-10-10",
  ],
  holidayPeriods: [
    { name: "元旦", start: "2026-01-01", end: "2026-01-03" },
    { name: "春节", start: "2026-02-17", end: "2026-02-23" },
    { name: "清明节", start: "2026-04-04", end: "2026-04-06" },
    { name: "劳动节", start: "2026-05-01", end: "2026-05-05" },
    { name: "国庆节", start: "2026-10-01", end: "2026-10-07" },
  ],
};

test("getDayType returns holiday for statutory holiday", () => {
  const service = createTempService(SAMPLE_DATA);
  assert.equal(service.getDayType("2026-01-01"), "holiday");
  assert.equal(service.getDayType("2026-10-01"), "holiday");
});

test("getDayType returns workday for adjusted workday", () => {
  const service = createTempService(SAMPLE_DATA);
  assert.equal(service.getDayType("2026-02-14"), "workday");
  assert.equal(service.getDayType("2026-10-10"), "workday");
});

test("getDayType returns rest_day for regular weekend", () => {
  const service = createTempService(SAMPLE_DATA);
  assert.equal(service.getDayType("2026-05-17"), "rest_day");
});

test("getDayType returns workday for regular weekday", () => {
  const service = createTempService(SAMPLE_DATA);
  assert.equal(service.getDayType("2026-05-18"), "workday");
});

test("getDayType falls back when no data file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-test-empty-"));
  const service = new CalendarService({ dataDir: dir });
  assert.equal(service.getDayType("2099-01-05"), "workday");
});

test("buildDayContext returns formatted string", () => {
  const service = createTempService(SAMPLE_DATA);
  const ctx = service.buildDayContext("2026-05-18");
  assert.ok(ctx.includes("2026-05-18"));
  assert.ok(ctx.includes("工作日"));
});

test("buildDayContext includes upcoming holiday", () => {
  const service = createTempService(SAMPLE_DATA);
  const ctx = service.buildDayContext("2026-04-28");
  assert.ok(ctx.includes("劳动节"));
});
