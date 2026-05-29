import { approveSSReplacement, rejectSSReplacement, getPendingApprovals } from "../../lib/sheets";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { postId, platformName, action, comment } = req.body || {};
    if (!postId || !platformName) return res.status(400).json({ ok: false, error: "Missing postId or platformName" });
    try {
      if (action === "reject") {
        await rejectSSReplacement(postId, platformName, comment || "");
        return res.json({ ok: true });
      }
      // default: approve
      const link = await approveSSReplacement(postId, platformName);
      return res.json({ ok: true, screenshotLink: link });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  if (req.method === "GET") {
    try {
      const approvals = await getPendingApprovals();
      return res.json({ ok: true, approvals });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  res.status(405).end();
}
