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

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            maxOutputTokens: body.max_tokens || 4000,
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ error: 'Gemini error: ' + errText.slice(0, 300) });
    }

    const data = await geminiRes.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = parts.map(p => p.text || '').join('');

    // Strip markdown fences
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract outermost JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) {
      return res.status(500).json({ error: 'No JSON found in response', raw: text.slice(0, 200) });
    }
    text = text.slice(start, end + 1);

    // Parse with Node.js (server-side) - if this fails, send error
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e) {
      // Try fixing common issues: unescaped newlines in strings
      const fixed = text
        .replace(/[\r\n]+/g, ' ')  // replace newlines with spaces
        .replace(/\t/g, ' ')        // replace tabs
        .replace(/[\x00-\x1F\x7F]/g, ' '); // remove other control chars
      parsed = JSON.parse(fixed);
    }

    // Sanitize all string values to remove control chars
    function sanitize(obj) {
      if (typeof obj === 'string') {
        return obj.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const k in obj) out[k] = sanitize(obj[k]);
        return out;
      }
      return obj;
    }

    const clean = sanitize(parsed);
    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(clean) }] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
