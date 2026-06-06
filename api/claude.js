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

    // Clean up common JSON issues from Gemini
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    // Remove control characters
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Try to parse and re-stringify to ensure valid JSON
    try {
      const parsed = JSON.parse(text);
      text = JSON.stringify(parsed);
    } catch(e) {
      // If parse fails, try to extract JSON object
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end >= 0) {
        text = text.slice(start, end + 1);
        // Try again after extraction
        try {
          const parsed = JSON.parse(text);
          text = JSON.stringify(parsed);
        } catch(e2) {
          // Return raw text, let client handle it
        }
      }
    }

    res.status(200).json({ content: [{ type: 'text', text: text }] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
