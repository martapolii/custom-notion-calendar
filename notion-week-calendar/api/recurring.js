import { authorize, recurrenceConfigOrError, notionFetch } from "./_notion.js";
import { generateForRange } from "./_recurrence.js";

const validFrequencies = new Set(["Daily", "Weekly", "Monthly"]);
const validWeekdays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const addDays = (value, amount) => { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!authorize(req, res)) return;
  const config = recurrenceConfigOrError(res);
  if (!config) return;
  const { name, frequency, interval = 1, weekdays = [], startDate, endDate = null } = req.body || {};
  if (!name?.trim() || !validFrequencies.has(frequency) || !Number.isInteger(Number(interval)) || Number(interval) < 1 || Number(interval) > 99 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) || weekdays.some(x => !validWeekdays.has(x))) {
    return res.status(400).json({ error: "Please provide a valid recurring-task rule." });
  }
  if (endDate && endDate < startDate) return res.status(400).json({ error: "End date must be after the start date." });
  if (frequency === "Weekly" && !weekdays.length) return res.status(400).json({ error: "Select at least one weekday." });
  try {
    const created = await notionFetch("/pages", config.token, {
      method: "POST",
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: config.ruleDataSourceId },
        properties: {
          Name: { title: [{ type: "text", text: { content: name.trim() } }] },
          Frequency: { select: { name: frequency } },
          Interval: { number: Number(interval) },
          Weekdays: { multi_select: frequency === "Weekly" ? weekdays.map(name => ({ name })) : [] },
          "Start Date": { date: { start: startDate } },
          "End Date": { date: endDate ? { start: endDate } : null },
          Active: { checkbox: true }
        }
      })
    });
    const rule = { id: created.id, name: name.trim(), frequency, interval: Number(interval), weekdays, startDate, endDate };
    const horizonEnd = endDate && endDate < addDays(startDate, 28) ? addDays(endDate, 1) : addDays(startDate, 28);
    const generated = await generateForRange(config, startDate, horizonEnd, rule);
    return res.status(201).json({ ok: true, id: created.id, generated });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Unable to create recurring task." });
  }
}
