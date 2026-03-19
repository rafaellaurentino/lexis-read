export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { word, context, srcLang, tgtLang } = req.body;
  if (!word || !context) return res.status(400).json({ error: 'Missing word or context' });

  // Support user-provided key (sent from frontend) OR server env var
  const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key configured' });

  const prompt = `You are a language learning assistant. Analyze the word "${word}" in ${srcLang} as used in this context: "${context}"

Respond ONLY with valid JSON (no markdown fences, no extra text), exactly this structure:
{
  "word": "${word}",
  "part_of_speech": "grammatical category in ${srcLang}",
  "contextual_meaning": "precise meaning of this word IN THIS SPECIFIC CONTEXT, written in ${tgtLang}",
  "general_meaning": "broader dictionary meaning in ${tgtLang}",
  "examples_source": [
    {"sentence": "natural example in ${srcLang} with similar meaning", "translation": "in ${tgtLang}"},
    {"sentence": "another natural example in ${srcLang}", "translation": "in ${tgtLang}"}
  ],
  "context_translation": "translate the key part of the context to ${tgtLang} in 1 concise sentence"
}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini error' });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
