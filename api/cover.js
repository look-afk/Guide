export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const artist = String(req.query.artist || '').trim().slice(0, 120);
  const title = String(req.query.title || '').trim().slice(0, 120);
  if (!artist && !title) return res.status(400).json({ error: 'missing_track' });

  const headers = { 'User-Agent': 'GuideMusicPlayer/1.0 (https://github.com/look-afk/Guide)' };
  const clean = value => value.replace(/[\\():"]/g, ' ').replace(/\\s+/g, ' ').trim();
  const terms = [
    [title && `recording:"${clean(title)}"`, artist && `artist:"${clean(artist)}"`].filter(Boolean).join(' AND '),
    [title && `release:"${clean(title)}"`, artist && `artist:"${clean(artist)}"`].filter(Boolean).join(' AND ')
  ].filter(Boolean);

  try {
    for (const query of terms) {
      const searchUrl = new URL('https://musicbrainz.org/ws/2/recording/');
      searchUrl.search = new URLSearchParams({ query, fmt: 'json', limit: '8' });
      const searchResponse = await fetch(searchUrl, { headers });
      if (!searchResponse.ok) continue;
      const searchData = await searchResponse.json();
      const releases = (searchData.recordings || [])
        .flatMap(recording => recording.releases || [])
        .filter(release => release.id);
      const unique = [...new Map(releases.map(release => [release.id, release])).values()].slice(0, 8);

      for (const release of unique) {
        const coverResponse = await fetch('https://coverartarchive.org/release/' + encodeURIComponent(release.id), { headers });
        if (!coverResponse.ok) continue;
        const coverData = await coverResponse.json();
        const images = coverData.images || [];
        const front = images.find(image => image.front) || images[0];
        const image = front && (front.thumbnails?.large || front.thumbnails?.['500'] || front.image);
        if (image && /^https:\/\//i.test(image)) {
          return res.status(200).json({ image, release: release.title || '' });
        }
      }
    }
    return res.status(404).json({ error: 'no_cover_found' });
  } catch {
    return res.status(502).json({ error: 'cover_lookup_unavailable' });
  }
}
