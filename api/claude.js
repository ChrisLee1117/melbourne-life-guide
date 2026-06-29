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

    // Run multiple searches in parallel for more events
    const searchQueries = [
      userPrompt,
      userPrompt.replace('Search Google for Melbourne', 'Search for Melbourne events on Eventbrite, What\'s On Melbourne, visitmelbourne.com'),
      userPrompt.replace('Search Google for Melbourne', 'Search for Melbourne weekend activities, night markets, festivals, exhibitions'),
    ];

    const searchResults = await Promise.all(searchQueries.map(q =>
      fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: q }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 3000, temperature: 0.1 }
          })
        }
      ).then(r => r.json()).then(d => {
        const parts = d.candidates?.[0]?.content?.parts || [];
        return parts.map(p => p.text || '').join('');
      }).catch(() => '')
    ));

    const combinedText = searchResults.filter(Boolean).join('\n\n---\n\n');

    // Convert all results to clean JSON
    const jsonRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: 'You are a JSON API. Output ONLY raw valid JSON. No markdown, no explanation, no code fences. Start with { and end with }.' }] },
          contents: [{
            parts: [{
              text: 'From all the Melbourne event information below, extract ALL unique events and format as JSON. Include as many events as possible (aim for 20+). Remove duplicates. Only include events with real venues and dates.\n\nInformation:\n' + combinedText
            }]
          }],
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const jsonData = await jsonRes.json();
    if (jsonData.error) return res.status(500).json({ error: jsonData.error.message });

    const jsonText = jsonData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(jsonText);
    res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
