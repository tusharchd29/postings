import { markPlatformPosted, uploadScreenshot, updateScreenshotOnly } from "../../lib/sheets";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { postId, platformName, postedBy, screenshot, screenshotOnly } = req.body;
    let screenshotLink = null;

    if (screenshot && screenshot.data) {
      screenshotLink = await uploadScreenshot(
        screenshot.data,
        screenshot.name || `${platformName}_${Date.now()}.png`,
        postId,
        platformName
      );
    }

    if (screenshotOnly) {
      // PM replacing screenshot — just update the screenshot ref, don't change posted status
      if (screenshotLink) await updateScreenshotOnly(postId, platformName, screenshotLink);
      return res.json({ ok: true, screenshotLink });
    }

    await markPlatformPosted(postId, platformName, postedBy, screenshotLink);
    return res.json({ ok: true, screenshotLink });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
