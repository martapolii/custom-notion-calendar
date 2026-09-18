import { authorize, configOrError, notionFetch } from "./_notion.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  if (!authorize(req, res)) return;
  const config = configOrError(res);
  if (!config) return;

  const { start, end } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "")) {
    return res.status(400).json({ error: "Valid start and end dates are required." });
  }

  try {
    const results = [];
    let cursor;
    do {
      const payload = await notionFetch(`/data_sources/${config.dataSourceId}/query`, config.token, {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          filter: {
            and: [
              { property: "Date", date: { on_or_after: start } },
              { property: "Date", date: { before: end } }
            ]
          },
          sorts: [{ property: "Date", direction: "ascending" }]
        })
      });
      results.push(...payload.results);
      cursor = payload.has_more ? payload.next_cursor : undefined;
    } while (cursor && results.length < 500);

    const tasks = results.map(page => {
      const p = page.properties || {};
      const title = (p.Name?.title || []).map(x => x.plain_text || "").join("") || "Untitled";
      const date = p.Date?.date?.start || null;
      const done = Boolean(p["did?"]?.checkbox);
      const status = p.status?.status?.name || (done ? "DONE" : "TO DO");
      return { id: page.id, url: page.url, title, date, done, status };
    }).filter(task => task.date);

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Unable to load tasks." });
  }
}
