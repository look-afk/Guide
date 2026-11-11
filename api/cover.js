export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ai_not_configured' });
  const rawName = String(req.body?.filename || '').trim().slice(0, 240);
  if (!rawName) return res.status(400).json({ error: 'missing_filename' });
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://guide.vercel.app',
        'X-Title': 'Guide Music Metadata'
      },
      body: JSON.stringify({
        model: 'openrouter/free', temperature: 0.1, max_tokens: 180,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Identify the real music track from a filename. Return only JSON with string fields artist and title. Remove file numbering, extensions, quality tags, official audio/video labels and other noise. Do not guess an artist if uncertain; use an empty string. Keep original language and spelling.' },
          { role: 'user', content: rawName }
        ]
      })
    });
    if (!response.ok) return res.status(502).json({ error: 'ai_request_failed' });
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '');
    const artist = String(parsed.artist || '').trim().slice(0, 120);
    const title = String(parsed.title || '').trim().slice(0, 120);
    if (!artist && !title) return res.status(422).json({ error: 'track_not_identified' });
    return res.status(200).json({ artist, title });
  } catch {
    return res.status(502).json({ error: 'metadata_normalization_failed' });
  }
}
