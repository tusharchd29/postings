import { getPosts, getSOW, setupSheets } from "../../lib/sheets";

export default async function handler(req, res) {
  await setupSheets();
  const [posts, sowRows] = await Promise.all([getPosts(), getSOW()]);
  const curMonth = new Date().toISOString().slice(0, 7);

  const postsSummary = posts.map(p => ({
    id: p.id,
    client: p.client,
    date: p.date,
    month: p.date ? p.date.slice(0, 7) : "",
    platforms: p.platforms.map(pl => ({ name: pl.name, posted: pl.posted })),
    allPosted: p.platforms.length > 0 && p.platforms.every(pl => pl.posted),
    anyPosted: p.platforms.some(pl => pl.posted),
  }));

  const thisMonth = postsSummary.filter(p => p.month === curMonth);

  const autoCountMap = {};
  thisMonth.forEach(p => {
    if (!p.allPosted) return;
    autoCountMap[p.client] = (autoCountMap[p.client] || 0) + 1;
  });

  const autoCountMapAny = {};
  thisMonth.forEach(p => {
    if (!p.anyPosted) return;
    autoCountMapAny[p.client] = (autoCountMapAny[p.client] || 0) + 1;
  });

  res.json({
    curMonth,
    totalPosts: posts.length,
    postsThisMonth: thisMonth.length,
    autoCountMap_allPosted: autoCountMap,
    autoCountMap_anyPosted: autoCountMapAny,
    sowClientNames: sowRows.map(r => r.clientName),
    postsThisMonthDetail: thisMonth,
  });
}
