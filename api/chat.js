// ============================================================================
// AIRLOOP GENAI DEPLOYMENT PROXY (Serverless / Node.js)
// ============================================================================
// In production deployment (Vercel / Netlify / Render / Cloud Run), set GEMINI_API_KEY
// in your deployment environment variables, or specify it directly below:
const DEPLOYMENT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, context, apiKey: clientKey } = req.body || {};
  if (!q) {
    return res.status(400).json({ error: 'Missing question parameter' });
  }

  const geminiKey = DEPLOYMENT_GEMINI_KEY || clientKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const systemPrompt = process.env.AIRLOOP_SYSTEM_PROMPT || `You are AirLoop Clinical Smog Coach, an expert environmental pulmonology and urban air quality AI assistant for families navigating severe winter smog.
Context: ${JSON.stringify(context || {})}
Rules:
1. Reply in HTML: <b>header: City · AQI (level)</b>, a <ul> of 3-4 specific, doable steps, then <div class="imp">Impact: …</div> with at least one quantified number (% dose cut, cigarette-equivalents, or kg CO2).
2. Tailor to profile (kids, elderly, asthma = stricter). Cover CADR filtration, N95 respirators, solar purge window timing (13:00-15:30), and electric transit alternatives.
3. Never diagnose. If chest pain or severe breathlessness is mentioned, issue an immediate emergency alert.
4. Keep advice calm, actionable, and mathematically grounded.`;

  // 1. Google Gemini (Free Tier / Official API)
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Question: ${q}` }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 600 }
        })
      });
      const j = await r.json();
      if (j.error) return res.status(500).json({ error: j.error.message || 'Gemini API error' });
      const rawText = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanHtml = rawText.replace(/^```html\s*|\s*```$/gi, '').trim();
      return res.json({ html: cleanHtml, engine: model, provider: 'Google Gemini' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Gemini proxy error' });
    }
  }

  // 2. Anthropic Claude (Fallback Provider)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: "user", content: `Context: ${JSON.stringify(context || {})}\nQuestion: ${q}` }]
        })
      });
      const j = await r.json();
      if (j.error) return res.status(500).json({ error: j.error.message });
      return res.json({ html: j.content?.[0]?.text, engine: 'claude-3-5-sonnet', provider: 'Anthropic' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 3. Fallback Heuristics
  return res.status(200).json({
    html: `<b>header: ${context?.city || 'Delhi'} · AQI ${Math.round(context?.aqi || 384)} (Severe)</b>
      <ul>
        <li><strong>Continuous bedroom clean room:</strong> Operate true HEPA air purifier to keep PM2.5 < 20 µg/m³.</li>
        <li><strong>Hermetic N95 seal:</strong> Wear fitted respirator during all outdoor transit and commutes.</li>
        <li><strong>Solar purge ventilation:</strong> Air out indoor spaces strictly between 1:00 PM and 3:30 PM.</li>
      </ul>
      <div class="imp">Impact: Active routine cuts inhaled particulate dose by up to 97.0%, avoiding over 14 cigarettes daily.</div>`,
    engine: 'offline-heuristics',
    provider: 'Local Heuristics'
  });
}
