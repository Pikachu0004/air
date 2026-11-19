// ============================================================================
// AIRLOOP GENAI DEPLOYMENT PROXY (Serverless / Node.js)
// ============================================================================

function resolveApiKey(clientKey) {
  const candidates = [
    clientKey,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_KEY,
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.GEMINI_AI_API_KEY,
    process.env.API_KEY
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const clean = c.trim().replace(/^["']|["']$/g, '');
      if (clean.length > 5) return clean;
    }
  }
  return '';
}

// Fetch live models directly supported by the user's specific API key
async function fetchGoogleModelManifest(apiKey) {
  const versions = ['v1beta', 'v1'];
  for (const ver of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`;
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      });
      const data = await res.json();
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        const generationModels = data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            name: m.name, // e.g. "models/gemini-1.5-flash"
            displayName: m.displayName || m.name,
            version: ver
          }));

        if (generationModels.length > 0) {
          // Sort with preference: 2.0-flash, 1.5-flash, flash-8b, any flash, pro
          generationModels.sort((a, b) => {
            const getScore = (item) => {
              const n = item.name.toLowerCase();
              if (n.includes('2.0-flash') && !n.includes('exp')) return 100;
              if (n.includes('1.5-flash') && !n.includes('8b')) return 90;
              if (n.includes('2.5-flash')) return 85;
              if (n.includes('1.5-flash-8b')) return 80;
              if (n.includes('flash')) return 70;
              if (n.includes('1.5-pro')) return 60;
              return 10;
            };
            return getScore(b) - getScore(a);
          });

          return { success: true, apiVersion: ver, models: generationModels };
        }
      } else if (data.error) {
        return { success: false, apiVersion: ver, error: data.error.message || `Code ${data.error.code}` };
      }
    } catch (e) {
      // try next version
    }
  }
  return { success: false, error: 'Could not contact Google ModelService' };
}

export default async function handler(req, res) {
  // CORS & Hardened Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Diagnostics: GET /api/chat or GET /api/status
  if (req.method === 'GET') {
    const key = resolveApiKey(req.query?.apiKey);
    let manifest = null;
    if (key) {
      manifest = await fetchGoogleModelManifest(key);
    }
    return res.status(200).json({
      status: 'ok',
      geminiConfigured: Boolean(key),
      keyPrefix: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
      manifest: manifest
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, context, apiKey: clientKey } = req.body || {};
  if (!q) {
    return res.status(400).json({ error: 'Missing question parameter' });
  }

  const geminiKey = resolveApiKey(clientKey);

  const city = context?.city || 'Delhi NCR';
  const aqi = Math.round(context?.aqi || 384);
  const band = context?.band || 'Severe';

  const systemPrompt = process.env.AIRLOOP_SYSTEM_PROMPT || `You are AirLoop Clinical Smog Coach, an expert environmental pulmonology and urban air quality AI assistant for families navigating severe winter smog.
Context: City=${city}, AQI=${aqi} (${band}), Baseline PM2.5=${context?.pm25 || 326} µg/m³. Profiles=${JSON.stringify(context?.profiles || context?.profile || [])}.
Rules:
1. Reply in clean HTML: <b>header: City · AQI (level)</b>, a <ul> of 3-4 specific, doable steps, then <div class="imp">Impact: …</div> with at least one quantified number (% dose cut, cigarette-equivalents, or kg CO2).
2. Tailor strictly to profile (kids, elderly, asthma = stricter). Cover CADR filtration, N95 respirators, solar purge window timing (13:00-15:30), and electric transit alternatives.
3. Never diagnose. If chest pain or severe breathlessness is mentioned, issue an immediate emergency alert.
4. Keep advice calm, actionable, and mathematically grounded.`;

  let lastError = null;

  // 1. Google Gemini via Live Model Discovery & Execution
  if (geminiKey) {
    const manifest = await fetchGoogleModelManifest(geminiKey);

    let modelsToTry = [];
    if (manifest.success && manifest.models && manifest.models.length > 0) {
      modelsToTry = manifest.models.map(m => ({ ver: m.version, model: m.name }));
    } else {
      if (manifest.error) {
        lastError = manifest.error;
      }
      // Standard static fallback list
      modelsToTry = [
        { ver: 'v1beta', model: 'models/gemini-1.5-flash' },
        { ver: 'v1', model: 'models/gemini-1.5-flash' },
        { ver: 'v1beta', model: 'models/gemini-2.0-flash' },
        { ver: 'v1', model: 'models/gemini-2.0-flash' },
        { ver: 'v1beta', model: 'models/gemini-1.5-flash-8b' },
        { ver: 'v1beta', model: 'models/gemini-1.5-pro' },
        { ver: 'v1', model: 'models/gemini-pro' }
      ];
    }

    for (const item of modelsToTry) {
      const cleanModel = item.model.startsWith('models/') ? item.model : `models/${item.model}`;
      const url = `https://generativelanguage.googleapis.com/${item.ver}/${cleanModel}:generateContent?key=${geminiKey}`;

      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${q}` }]
              }
            ],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 600
            }
          })
        });

        const j = await r.json();
        if (j.error) {
          lastError = j.error.message || `Error code ${j.error.code}`;
          console.warn(`[Gemini Attempt] ${item.ver}/${cleanModel} failed:`, lastError);
          continue; // Try next model from manifest
        }

        const rawText = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          const cleanHtml = rawText.replace(/^```html\s*|\s*```$/gi, '').trim();
          return res.status(200).json({
            html: cleanHtml,
            engine: cleanModel.replace('models/', ''),
            apiVersion: item.ver,
            provider: 'Google Gemini',
            geminiSuccess: true
          });
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }

  // 2. Clinical Heuristics Fallback with diagnostic metadata
  const qLow = q.toLowerCase();
  let fallbackHtml = '';
  if (qLow.includes('chest') || qLow.includes('breath') || qLow.includes('pain') || qLow.includes('emergency')) {
    fallbackHtml = `
      <b style="color:var(--red-light, #f87171);">EMERGENCY CLINICAL TRIAGE · ${city} · AQI ${aqi}</b>
      <ul>
        <li><strong>Immediate Medical Attention:</strong> Symptoms of acute respiratory distress or chest tightness in AQI >300 require immediate medical evaluation.</li>
        <li><strong>Emergency Contact:</strong> Dial 112 (National Emergency) or 102 (Ambulance Service) immediately.</li>
        <li><strong>Acute Indoor Triage:</strong> Administer prescribed rescue inhaler (e.g. Salbutamol via spacer), remain seated upright in an air-purified room, and avoid physical exertion.</li>
      </ul>
      <div class="imp">Impact: Timely emergency medical response is critical during severe atmospheric pollution spikes.</div>
    `;
  } else if (qLow.includes('kid') || qLow.includes('infant') || qLow.includes('child')) {
    fallbackHtml = `
      <b>header: ${city} · AQI ${aqi} (${band})</b>
      <ul>
        <li><strong>Zero outdoor exposure before 1:00 PM:</strong> Toddlers breathe 40–50 breaths/min compared to 12–16 in adults, depositing 2.5x more particulate mass in developing alveolar tissue.</li>
        <li><strong>Continuous bedroom clean room:</strong> Operate HEPA filtration to maintain indoor PM2.5 strictly under 20 µg/m³.</li>
        <li><strong>Pediatric N95 sizing:</strong> Standard adult masks leave cheek gaps. Use certified pediatric respirators with adjustable headbands.</li>
      </ul>
      <div class="imp">Impact: Eliminating outdoor morning exposure protects developing alveoli and saves ~11.5 cigarette-equivalents of fine particulate intake daily.</div>
    `;
  } else {
    fallbackHtml = `
      <b>header: ${city} · AQI ${aqi} (${band})</b>
      <ul>
        <li><strong>Hermetic filtration sanctuary:</strong> Seal bedroom thresholds with silicone sweeps and run true HEPA filtration continuously.</li>
        <li><strong>Fitted N95 respirator transit:</strong> Always wear a fitted N95 respirator during outdoor transit; cloth masks are ineffective for fine aerosols.</li>
        <li><strong>Solar purge timing:</strong> Air out living areas only between 1:00 PM and 3:30 PM when solar convection opens the inversion layer.</li>
        <li><strong>Electrified mass transit:</strong> Shift from open auto-rickshaws to subterranean metro rail systems.</li>
      </ul>
      <div class="imp">Impact: Combining these measures cuts particulate inhalation by 97.0%, saving 14.4 cigarette-equivalents per person daily.</div>
    `;
  }

  return res.status(200).json({
    html: fallbackHtml,
    engine: 'clinical-heuristics',
    provider: 'Deployment Engine',
    geminiConfigured: Boolean(geminiKey),
    geminiError: lastError
  });
}
