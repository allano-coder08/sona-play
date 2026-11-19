// api/search.js — Vercel serverless function for Sona Play
// Keeps the YouTube API key on the server and caches results for everyone.

module.exports = async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase().slice(0, 100);
  const max = Math.min(Math.max(parseInt(req.query.max, 10) || 12, 1), 25);

  if (!q) return res.status(400).json({ error: { message: "Missing query" } });

  const key = process.env.YT_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "Server API key not set" } });

  const url =
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video" +
    "&videoEmbeddable=true&videoCategoryId=10" +
    `&maxResults=${max}&q=${encodeURIComponent(q)}&key=${key}`;

  try {
    const r = await fetch(url);
    const j = await r.json();

    if (!r.ok) {
      // Errors are NOT cached, so the site recovers as soon as quota resets.
      return res.status(r.status).json({
        error: { message: j.error?.message || "Search failed" }
      });
    }

    // Cache successful results on Vercel's CDN for 24h (same query = 0 quota).
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json(j);
  } catch (e) {
    return res.status(502).json({ error: { message: "Could not reach YouTube" } });
  }
};