import { authorize, notesConfigOrError, notionFetch } from "./_notion.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  if (!authorize(req, res)) return;
  const config = notesConfigOrError(res);
  if (!config) return;
  const { start, end } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "")) {
    return res.status(400).json({ error: "Valid start and end dates are required." });
  }
  try {
    const payload = await notionFetch(`/data_sources/${config.dataSourceId}/query`, config.token, {
      method: "POST",
      body: JSON.stringify({
        page_size: 100,
        filter: { and: [
          { property: "Date", date: { on_or_after: start } },
          { property: "Date", date: { before: end } }
        ]},
        sorts: [{ property: "Date", direction: "ascending" }]
      })
    });
    const notes = payload.results.map(page => {
      const p = page.properties || {};
      return {
        id: page.id,
        date: p.Date?.date?.start?.slice(0, 10) || null,
        text: (p.Notes?.rich_text || []).map(x => x.plain_text || "").join("")
      };
    }).filter(note => note.date);
    return res.status(200).json({ notes });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Unable to load notes." });
  }
}
