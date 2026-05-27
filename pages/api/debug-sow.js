import { getPosts, getSOW, setupSheets } from "../../lib/sheets";

export default async function handler(req, res) {
  await setupSheets();
  const [posts, sowRows] = await Promise.all([getPosts(), getSOW()]);

  const postClientNames = [...new Set(posts.map(p => p.client).filter(Boolean))].sort();
  const sowClientNames = sowRows.map(r => ({ id: r.id, name: r.clientName }));

  res.json({ postClientNames, sowClientNames });
}
