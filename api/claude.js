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

    // Step 1: Search with google_search (returns markdown)
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

    const searchData = await searchRes.json();
    const rawParts = searchData.candidates?.[0]?.content?.parts || [];
    const rawText = rawParts.map(p => p.text || '').join('');

    // Step 2: Convert to clean JSON using responseMimeType (no tools this time)
    const jsonRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Based on this information about Melbourne events, output ONLY a JSON object matching this exact schema. No explanation, no markdown:\n\n' + rawText + '\n\nSchema: {"events":[{"id":1,"name":"中文名","nameEn":"English name","emoji":"🎭","category":"類別","color":"#7c3aed","fixedStart":"2026-MM-DD","fixedEnd":"2026-MM-DD","daysOfWeek":[0],"hours":"time","location":"venue","address":"address Melbourne VIC","venueLat":-37.8136,"venueLng":144.9631,"description":"desc","dateDesc":"日期","dateDescEn":"date","highlights":"tips","highlightsEn":"tips"}]}'
            }]
          }],
          generationConfig: {
            maxOutputTokens: body.max_tokens || 4000,
            temperature: 0,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const jsonData = await jsonRes.json();
    const jsonText = jsonData.candidates?.[0]?.content?.parts?.[0]?.text || '{"events":[]}';
    const parsed = JSON.parse(jsonText);

    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
