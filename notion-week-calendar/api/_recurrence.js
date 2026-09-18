import { notionFetch } from "./_notion.js";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateOnly = value => new Date(`${value}T12:00:00Z`);
const iso = date => date.toISOString().slice(0, 10);
const addDays = (date, amount) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + amount); return d; };

function occursOn(rule, date) {
  const start = dateOnly(rule.startDate);
  if (date < start || (rule.endDate && date > dateOnly(rule.endDate))) return false;
  const interval = Math.max(1, Number(rule.interval) || 1);
  const dayDiff = Math.round((date - start) / 86400000);
  if (rule.frequency === "Daily") return dayDiff % interval === 0;
  if (rule.frequency === "Weekly") {
    const selected = rule.weekdays?.length ? rule.weekdays : [weekdayNames[start.getUTCDay()]];
    const startMonday = addDays(start, -((start.getUTCDay() + 6) % 7));
    const dateMonday = addDays(date, -((date.getUTCDay() + 6) % 7));
    const weekDiff = Math.round((dateMonday - startMonday) / (86400000 * 7));
    return weekDiff % interval === 0 && selected.includes(weekdayNames[date.getUTCDay()]);
  }
  if (rule.frequency === "Monthly") {
    const monthDiff = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 + date.getUTCMonth() - start.getUTCMonth();
    return monthDiff >= 0 && monthDiff % interval === 0 && date.getUTCDate() === start.getUTCDate();
  }
  return false;
}

export async function listRules(config) {
  const payload = await notionFetch(`/data_sources/${config.ruleDataSourceId}/query`, config.token, {
    method: "POST",
    body: JSON.stringify({ page_size: 100, filter: { property: "Active", checkbox: { equals: true } } })
  });
  return payload.results.map(page => {
    const p = page.properties || {};
    return {
      id: page.id,
      name: (p.Name?.title || []).map(x => x.plain_text || "").join("") || "Recurring task",
      frequency: p.Frequency?.select?.name,
      interval: p.Interval?.number || 1,
      weekdays: (p.Weekdays?.multi_select || []).map(x => x.name),
      startDate: p["Start Date"]?.date?.start?.slice(0, 10),
      endDate: p["End Date"]?.date?.start?.slice(0, 10) || null
    };
  }).filter(rule => rule.startDate && rule.frequency);
}

async function existingKeys(config, ruleId) {
  const payload = await notionFetch(`/data_sources/${config.taskDataSourceId}/query`, config.token, {
    method: "POST",
    body: JSON.stringify({ page_size: 100, filter: { property: "Recurrence Key", rich_text: { contains: `${ruleId}:` } } })
  });
  return new Set(payload.results.map(page => (page.properties?.["Recurrence Key"]?.rich_text || []).map(x => x.plain_text || "").join("")).filter(Boolean));
}

async function createOccurrence(config, rule, date) {
  const dateString = iso(date), key = `${rule.id}:${dateString}`;
  await notionFetch("/pages", config.token, {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: config.taskDataSourceId },
      properties: {
        Name: { title: [{ type: "text", text: { content: rule.name } }] },
        Date: { date: { start: dateString } },
        "did?": { checkbox: false },
        status: { status: { name: "TO DO" } },
        "Recurrence Key": { rich_text: [{ type: "text", text: { content: key } }] }
      }
    })
  });
}

export async function generateForRange(config, rangeStart, rangeEnd, onlyRule = null) {
  const rules = onlyRule ? [onlyRule] : await listRules(config);
  let created = 0;
  for (const rule of rules) {
    const keys = await existingKeys(config, rule.id);
    const pending = [];
    for (let d = dateOnly(rangeStart); d < dateOnly(rangeEnd); d = addDays(d, 1)) {
      const key = `${rule.id}:${iso(d)}`;
      if (occursOn(rule, d) && !keys.has(key)) pending.push(new Date(d));
    }
    for (let i = 0; i < pending.length; i += 3) {
      await Promise.all(pending.slice(i, i + 3).map(date => createOccurrence(config, rule, date)));
      created += Math.min(3, pending.length - i);
    }
  }
  return created;
}
