const fs = require("fs");
const path = require("path");

const TIMEZONE = "Asia/Shanghai";
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const TYPE_LABELS = {
  workday: "工作日",
  rest_day: "休息日",
  holiday: "法定假日",
};

class CalendarService {
  constructor({ dataDir } = {}) {
    this.dataDir = dataDir || path.resolve(__dirname, "..", "..", "data");
    this.cache = new Map();
  }

  loadYear(year) {
    if (this.cache.has(year)) return this.cache.get(year);
    const filePath = path.join(this.dataDir, `calendar-${year}.json`);
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const data = {
        year,
        holidays: new Set(Array.isArray(parsed.holidays) ? parsed.holidays : []),
        adjustedWorkdays: new Set(Array.isArray(parsed.adjustedWorkdays) ? parsed.adjustedWorkdays : []),
        holidayPeriods: Array.isArray(parsed.holidayPeriods) ? parsed.holidayPeriods : [],
      };
      this.cache.set(year, data);
      return data;
    } catch {
      return null;
    }
  }

  hasDataForYear(year) {
    return this.loadYear(year) !== null;
  }

  getDayType(dateInput) {
    const dateStr = this.toDateString(dateInput);
    const year = Number(dateStr.slice(0, 4));
    const data = this.loadYear(year);
    if (!data) return this.weekdayOrWeekend(dateStr);
    if (data.holidays.has(dateStr)) return "holiday";
    if (data.adjustedWorkdays.has(dateStr)) return "workday";
    return this.weekdayOrWeekend(dateStr);
  }

  isWorkday(dateInput) {
    return this.getDayType(dateInput) === "workday";
  }

  isHoliday(dateInput) {
    return this.getDayType(dateInput) === "holiday";
  }

  isRestDay(dateInput) {
    const type = this.getDayType(dateInput);
    return type === "rest_day" || type === "holiday";
  }

  getTodayType() {
    return this.getDayType(new Date());
  }

  buildDayContext(dateInput) {
    const dateStr = this.toDateString(dateInput);
    const dayType = this.getDayType(dateInput);
    const dow = this.getDayOfWeek(dateStr);
    const lines = [
      `[日历上下文] ${dateStr} 周${DAY_NAMES[dow]}，${TYPE_LABELS[dayType]}`,
    ];

    const upcoming = this.getUpcomingHolidays(dateStr, 7);
    if (upcoming.length > 0) {
      const next = upcoming[0];
      if (next.daysUntil === 0) {
        lines.push(`最近假期：${next.name}（今天开始）`);
      } else {
        lines.push(`最近假期：${next.name}（${next.daysUntil}天后）`);
      }
    }

    return lines.join("\n");
  }

  getUpcomingHolidays(dateInput, withinDays = 7) {
    const dateStr = this.toDateString(dateInput);
    const year = Number(dateStr.slice(0, 4));
    const data = this.loadYear(year);
    if (!data || !data.holidayPeriods.length) return [];

    const startDate = parseDateStr(dateStr);
    const results = [];

    for (const period of data.holidayPeriods) {
      const periodStart = parseDateStr(period.start);
      const daysUntil = Math.floor((periodStart - startDate) / 86400000);
      if (daysUntil >= 0 && daysUntil <= withinDays) {
        results.push({
          name: period.name,
          start: period.start,
          end: period.end,
          daysUntil,
        });
      }
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil);
    return results;
  }

  getDayDetail(dateInput) {
    const dateStr = this.toDateString(dateInput);
    const dayType = this.getDayType(dateInput);
    const dow = this.getDayOfWeek(dateStr);
    return {
      date: dateStr,
      dayType,
      dayOfWeek: dow,
      dayName: DAY_NAMES[dow],
      label: TYPE_LABELS[dayType],
    };
  }

  toDateString(input) {
    if (input instanceof Date) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(input);
      const y = parts.find((p) => p.type === "year")?.value || "0000";
      const m = parts.find((p) => p.type === "month")?.value || "01";
      const d = parts.find((p) => p.type === "day")?.value || "01";
      return `${y}-${m}-${d}`;
    }
    const str = String(input || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return str.slice(0, 10);
  }

  getDayOfWeek(dateStr) {
    const d = parseDateStr(dateStr);
    return d.getUTCDay();
  }

  weekdayOrWeekend(dateStr) {
    const dow = this.getDayOfWeek(dateStr);
    return (dow >= 1 && dow <= 5) ? "workday" : "rest_day";
  }
}

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

module.exports = { CalendarService };
