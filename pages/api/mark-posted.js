import { markPlatformPosted, uploadScreenshotToDrive } from "../../lib/sheets";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { postId, platformName, postedBy, screenshot } = req.body;
    let screenshotLink = null;

    // Upload screenshot to Drive if provided
    if (screenshot && screenshot.data) {
      screenshotLink = await uploadScreenshotToDrive(
        screenshot.data,
        screenshot.name || `${platformName}_${postId}_${Date.now()}.png`,
        screenshot.mimeType || "image/png",
        screenshot.clientName || "General"
      );
    }

    await markPlatformPosted(postId, platformName, postedBy, screenshotLink);
    return res.json({ ok: true, screenshotLink });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
