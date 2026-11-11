export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const q = String(req.query.q || '').trim().slice(0, 180);
  if (!q) return res.status(400).json({ error: 'missing_query' });
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return res.status(503).json({ error: 'google_image_search_not_configured' });
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.search = new URLSearchParams({
      key, cx, q: q + ' album cover', searchType: 'image',
      num: '10', safe: 'active', imgType: 'photo', fields: 'items(link,mime,image/width,image/height)'
    });
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'google_search_failed' });
    const data = await response.json();
    const item = (data.items || []).find(x =>
      x.mime && x.mime.startsWith('image/') && x.link &&
      /^https:\/\//i.test(x.link) &&
      (!x.image || ((x.image.width || 0) >= 180 && (x.image.height || 0) >= 180))
    );
    if (!item) return res.status(404).json({ error: 'no_image_found' });
    return res.status(200).json({ image: item.link });
  } catch {
    return res.status(502).json({ error: 'image_search_unavailable' });
  }
}
