import { markPlatformPosted, uploadScreenshot, updateScreenshotOnly, requestSSReplacement } from "../../lib/sheets";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { postId, platformName, postedBy, screenshot, screenshotOnly, replacementRequest } = req.body;
    let screenshotLink = null;

    if (screenshot && screenshot.data) {
      if (replacementRequest) {
        // Posting team requesting replacement — store as pending, awaiting PM approval
        screenshotLink = await requestSSReplacement(
          screenshot.data,
          screenshot.name || `${platformName}_${Date.now()}.png`,
          postId,
          platformName
        );
        return res.json({ ok: true, screenshotLink, pending: true });
      }
      screenshotLink = await uploadScreenshot(
        screenshot.data,
        screenshot.name || `${platformName}_${Date.now()}.png`,
        postId,
        platformName
      );
    }

    if (screenshotOnly) {
      // PM replacing screenshot directly — instant, no approval needed
      if (screenshotLink) await updateScreenshotOnly(postId, platformName, screenshotLink);
      return res.json({ ok: true, screenshotLink });
    }

    await markPlatformPosted(postId, platformName, postedBy, screenshotLink);
    return res.json({ ok: true, screenshotLink });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
