const NOTION_VERSION = "2025-09-03";

export function authorize(req, res) {
  const expected = process.env.CALENDAR_ACCESS_KEY;
  if (!expected) {
    res.status(500).json({ error: "CALENDAR_ACCESS_KEY is not configured." });
    return false;
  }
  if (req.headers["x-calendar-key"] !== expected) {
    res.status(401).json({ error: "Incorrect calendar access key." });
    return false;
  }
  return true;
}

export function configOrError(res) {
  const token = process.env.NOTION_API_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  if (!token || !dataSourceId) {
    res.status(500).json({ error: "Notion task environment variables are not configured." });
    return null;
  }
  return { token, dataSourceId };
}

export function notesConfigOrError(res) {
  const token = process.env.NOTION_API_TOKEN;
  const dataSourceId = process.env.NOTION_NOTES_DATA_SOURCE_ID;
  if (!token || !dataSourceId) {
    res.status(500).json({ error: "Notion notes environment variables are not configured." });
    return null;
  }
  return { token, dataSourceId };
}

export async function notionFetch(path, token, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `Notion API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}
