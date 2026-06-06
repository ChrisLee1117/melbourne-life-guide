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
    const prompt = messages.map(function(m) {
      return typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    }).join('\n');

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
            temperature: 0.3
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ error: 'Gemini API error: ' + errText.slice(0, 200) });
    }

    const data = await geminiRes.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(function(p) { return p.text || ''; }).join('');

    res.status(200).json({ content: [{ type: 'text', text: text }] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
