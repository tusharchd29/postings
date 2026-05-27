import { getScreenshot } from "../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { postId, platform } = req.query;
  if (!postId || !platform) return res.status(400).json({ ok: false });
  try {
    const ss = await getScreenshot(postId, platform);
    if (!ss) return res.status(404).json({ ok: false, error: "Not found" });
    // Serve as image directly
    const buf = Buffer.from(ss.base64, "base64");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
