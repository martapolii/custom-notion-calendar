import { authorize, notesConfigOrError, notionFetch } from "./_notion.js";

function richText(text) {
  const chars = Array.from(text || "");
  const chunks = [];
  for (let i = 0; i < chars.length; i += 1900) chunks.push(chars.slice(i, i + 1900).join(""));
  return chunks.map(content => ({ type: "text", text: { content } }));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed." });
  if (!authorize(req, res)) return;
  const config = notesConfigOrError(res);
  if (!config) return;
  const { id, date, text } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || typeof text !== "string") {
    return res.status(400).json({ error: "A valid date and note text are required." });
  }
  if (text.length > 150000) return res.status(413).json({ error: "This daily note is too long." });
  try {
    let pageId = id;
    if (!pageId) {
      const existing = await notionFetch(`/data_sources/${config.dataSourceId}/query`, config.token, {
        method: "POST",
        body: JSON.stringify({ page_size: 1, filter: { property: "Date", date: { equals: date } } })
      });
      pageId = existing.results[0]?.id;
    }
    const properties = { Notes: { rich_text: richText(text) } };
    if (pageId) {
      await notionFetch(`/pages/${pageId}`, config.token, { method: "PATCH", body: JSON.stringify({ properties }) });
    } else {
      const created = await notionFetch("/pages", config.token, {
        method: "POST",
        body: JSON.stringify({
          parent: { type: "data_source_id", data_source_id: config.dataSourceId },
          properties: {
            Day: { title: [{ type: "text", text: { content: date } }] },
            Date: { date: { start: date } },
            ...properties
          }
        })
      });
      pageId = created.id;
    }
    return res.status(200).json({ ok: true, id: pageId, date });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Unable to save note." });
  }
}
