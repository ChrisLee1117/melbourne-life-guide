export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    const body = req.body;
    const messages = body.messages || [];
    const prompt = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('\n');

    // Step 1: Search with google_search tool (no JSON mode)
    const searchRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: body.max_tokens || 4000, temperature: 0.1 }
        })
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(500).json({ error: 'Gemini search error: ' + errText.slice(0, 300) });
    }

    const searchData = await searchRes.json();
    if (searchData.error) return res.status(500).json({ error: searchData.error.message });

    const parts = searchData.candidates?.[0]?.content?.parts || [];
    let rawText = parts.map(p => p.text || '').join('');

    // Clean markdown fences
    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Step 2: If not valid JSON, ask Gemini to convert to clean JSON (no tools)
    let parsed;
    try {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      parsed = JSON.parse(rawText.slice(start, end + 1));
    } catch(e) {
      // Re-ask Gemini to output clean JSON from the raw text
      const cleanRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Convert this to valid JSON only, no markdown, no explanation:\n' + rawText }] }],
            generationConfig: {
              maxOutputTokens: body.max_tokens || 4000,
              temperature: 0,
              responseMimeType: 'application/json'
            }
          })
        }
      );
      const cleanData = await cleanRes.json();
      const cleanText = cleanData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      parsed = JSON.parse(cleanText);
    }

    // Sanitize all strings
    function sanitize(obj) {
      if (typeof obj === 'string') return obj.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const k in obj) out[k] = sanitize(obj[k]);
        return out;
      }
      return obj;
    }

    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(sanitize(parsed)) }] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
