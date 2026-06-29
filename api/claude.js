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
    const userPrompt = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('\n');

    // Step 1: Search with Google
    const searchRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: body.max_tokens || 4000, temperature: 0.1 }
        })
      }
    );

    const searchData = await searchRes.json();
    if (searchData.error) return res.status(500).json({ error: searchData.error.message });

    const rawParts = searchData.candidates?.[0]?.content?.parts || [];
    const rawText = rawParts.map(p => p.text || '').join('');

    // Step 2: Convert to strict JSON using responseMimeType (no tools)
    const jsonRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: 'You are a JSON API. You ONLY output raw JSON. Never include any text, explanation, markdown, or code fences before or after the JSON. Your entire response must be valid JSON starting with { and ending with }.' }] },
          contents: [{
            parts: [{
              text: 'Convert this information into the required JSON format. Output ONLY the JSON object, nothing else:\n\n' + rawText
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
    if (jsonData.error) return res.status(500).json({ error: jsonData.error.message });

    const jsonText = jsonData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse and re-stringify to guarantee clean JSON
    const parsed = JSON.parse(jsonText);
    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
