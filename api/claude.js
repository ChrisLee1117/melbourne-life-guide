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
            temperature: 0.1
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

    // Strip markdown
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end >= 0) {
      text = text.slice(start, end + 1);
    }

    // Parse and re-stringify server-side to ensure clean JSON
    // This removes all control characters automatically
    let cleaned;
    try {
      cleaned = JSON.parse(text);
    } catch(e) {
      // Aggressive clean: remove all chars below 0x20 except tab
      text = text.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code < 0x20 && code !== 0x09) return ' ';
        return c;
      }).join('');
      cleaned = JSON.parse(text);
    }

    // Return clean re-stringified JSON
    res.status(200).json({
      content: [{ type: 'text', text: JSON.stringify(cleaned) }]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
