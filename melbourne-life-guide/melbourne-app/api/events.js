// api/events.js
// 前端呼叫此 API 獲取最新活動資料

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Content-Type", "application/json");

  try {
    // Read from Vercel Blob
    const blobUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? `https://${process.env.VERCEL_URL || "localhost"}/api/blob/events.json`
      : null;

    // Try to fetch from blob storage
    const BLOB_BASE_URL = process.env.EVENTS_BLOB_URL; // set this in Vercel env vars after first deploy

    if (BLOB_BASE_URL) {
      const response = await fetch(BLOB_BASE_URL);
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // Fallback: return empty with message
    res.status(200).json({
      lastUpdated: null,
      events: [],
      message: "尚未有活動資料，請先執行 /api/update 更新"
    });

  } catch (error) {
    res.status(500).json({ error: error.message, events: [] });
  }
}
