import { authorize, configOrError, notionFetch } from "./_notion.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed." });
  if (!authorize(req, res)) return;
  const config = configOrError(res);
  if (!config) return;

  const { id, done } = req.body || {};
  if (!/^[0-9a-f-]{32,36}$/i.test(id || "") || typeof done !== "boolean") {
    return res.status(400).json({ error: "A valid task id and checkbox value are required." });
  }

  try {
    await notionFetch(`/pages/${id}`, config.token, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          "did?": { checkbox: done },
          "status": { status: { name: done ? "DONE" : "TO DO" } }
        }
      })
    });
    return res.status(200).json({ ok: true, done, status: done ? "DONE" : "TO DO" });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Unable to update task." });
  }
}
