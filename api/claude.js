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
          generationConfig: { maxOutputTokens: body.max_tokens || 4000, temperature: 0.1 }
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

    // Aggressively clean markdown
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    text = text.replace(/\s*```$/i, '').trim();
    // Also handle inline backticks
    if (text.includes('```')) {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace >= 0) {
        text = text.slice(firstBrace, lastBrace + 1);
      }
    }

    // Fix control characters in strings
    text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

    // Parse server-side and re-stringify for guaranteed clean output
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e) {
      // Last resort: replace literal newlines within strings
      text = text.replace(/("(?:[^"\\]|\\.)*")/g, m =>
        m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      );
      parsed = JSON.parse(text);
    }

    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }] });

  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
