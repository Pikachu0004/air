const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key] && val) process.env[key] = val;
        }
      }
    });
  }
} catch (e) {}

const PORT = parseInt(process.env.PORT || '3000', 10);

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

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Statically read and cache HTML templates in memory
// (Static string literals ensure @vercel/nft includes these files in the serverless bundle)
const HTML_PAGES = {};
try { HTML_PAGES['index.html'] = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); } catch (e) {}
try { HTML_PAGES['assistant.html'] = fs.readFileSync(path.join(__dirname, 'assistant.html'), 'utf8'); } catch (e) {}
try { HTML_PAGES['cadr-lab.html'] = fs.readFileSync(path.join(__dirname, 'cadr-lab.html'), 'utf8'); } catch (e) {}
try { HTML_PAGES['diurnal-radar.html'] = fs.readFileSync(path.join(__dirname, 'diurnal-radar.html'), 'utf8'); } catch (e) {}
try { HTML_PAGES['community.html'] = fs.readFileSync(path.join(__dirname, 'community.html'), 'utf8'); } catch (e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --------------------------------------------------------------------------
  // API Route: GET /api/forecast
  // --------------------------------------------------------------------------
  if (pathname === '/api/forecast' && req.method === 'GET') {
    const lat = parsedUrl.query.lat || '28.65195';
    const lon = parsedUrl.query.lon || '77.23149';
    const city = parsedUrl.query.city || parsedUrl.query.station || 'Delhi';

    try {
      const apiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&hourly=pm2_5,us_aqi&timezone=auto&forecast_days=1`;
      const r = await fetch(apiUrl);
      if (!r.ok) throw new Error(`Open-Meteo returned status ${r.status}`);
      const data = await r.json();
      const current = data.current || {};
      const hourly = data.hourly || { time: [], pm2_5: [], us_aqi: [] };

      let minPm25 = Infinity;
      let maxPm25 = -Infinity;
      let safeWindowHour = 14;
      let peakInversionHour = 7;
      const hourlyData = [];
      const count = Math.min(24, hourly.time.length);

      for (let i = 0; i < count; i++) {
        const timeStr = hourly.time[i];
        const hour = new Date(timeStr).getHours();
        const pm = hourly.pm2_5[i] || 0;
        const aqi = hourly.us_aqi[i] || 0;
        if (pm < minPm25) { minPm25 = pm; safeWindowHour = hour; }
        if (pm > maxPm25) { maxPm25 = pm; peakInversionHour = hour; }
        hourlyData.push({
          time: timeStr,
          hour,
          pm2_5: pm,
          us_aqi: aqi,
          isSafeSolarWindow: (hour >= 13 && hour <= 15),
          isInversionTrap: (hour >= 6 && hour <= 9) || (hour >= 19 && hour <= 23)
        });
      }

      const baselineCigs = ((current.pm2_5 || 300) / 22.0).toFixed(1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        city,
        current: {
          aqi: current.us_aqi || 384,
          pm2_5: current.pm2_5 || 326.4,
          pm10: current.pm10 || 485.2,
          no2: current.nitrogen_dioxide || 68.1,
          o3: current.ozone || 22.4,
          cigsEquivalent: baselineCigs
        },
        diurnalAnalysis: {
          peakInversionHour,
          safeSolarWindow: "13:00 - 15:30",
          minPm25,
          maxPm25,
          inversionSeverity: (maxPm25 / (minPm25 || 1)).toFixed(1) + "x diurnal variation"
        },
        hourly: hourlyData
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        city: `${city} (Modeled)`,
        status: 'fallback',
        current: { aqi: 384, pm2_5: 326.4, pm10: 485.2, no2: 68.1, o3: 22.4, cigsEquivalent: "14.8" },
        diurnalAnalysis: { peakInversionHour: 7, safeSolarWindow: "13:00 - 15:30", minPm25: 180.2, maxPm25: 412.5, inversionSeverity: "2.3x diurnal variation" },
        hourly: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          pm2_5: Math.round(320 * (h >= 5 && h <= 9 ? 1.3 : (h >= 13 && h <= 15 ? 0.58 : 1.0))),
          us_aqi: Math.min(500, Math.round(320 * (h >= 5 && h <= 9 ? 1.3 : 1.0) * 1.15)),
          isSafeSolarWindow: (h >= 13 && h <= 15),
          isInversionTrap: (h >= 6 && h <= 9) || (h >= 19 && h <= 23)
        }))
      }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // API Route: GET /api/status (Health & Key Diagnosis)
  // --------------------------------------------------------------------------
  if (pathname === '/api/status' && req.method === 'GET') {
    const key = resolveApiKey(parsedUrl.query?.apiKey);
    let manifest = null;
    if (key) {
      manifest = await fetchGoogleModelManifest(key);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      geminiConfigured: Boolean(key),
      keyPrefix: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
      platform: process.env.VERCEL ? 'Vercel Edge' : 'Full-Stack Server',
      manifest: manifest
    }));
    return;
  }

  // --------------------------------------------------------------------------
  // API Route: POST /api/chat
  // --------------------------------------------------------------------------
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const q = payload.q || '';
        const context = payload.context || {};
        const apiKey = resolveApiKey(payload.apiKey);

        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing question parameter' }));
          return;
        }

        const city = context.city || 'Delhi NCR';
        const aqi = context.aqi || 384;
        const band = context.band || 'Severe';

        const systemPrompt = `You are AirLoop Clinical Smog Coach, an expert environmental pulmonology and urban air quality AI assistant for families navigating severe winter smog.
Context: City=${city}, AQI=${aqi} (${band}), Baseline PM2.5=${context.pm25 || 326} µg/m³.
Rules:
1. Format output cleanly in HTML: <b>header: City · AQI (level)</b>, a <ul> with 3-4 specific, actionable steps, and a <div class="imp">Impact: …</div> with quantified metrics (% dose cut, cigarette-equivalents, or kg CO2).
2. Tailor strictly to profile: kids/asthma/elderly require immediate indoor isolation, certified pediatric N95 respirators, and continuous HEPA filtration.
3. Include diurnal awareness: highlight the solar purge window (13:00 - 15:30) when the inversion boundary opens, and warn against morning exercise during nocturnal traps (06:00 - 09:00).
4. Never give formal medical diagnosis. If chest pain or severe breathlessness is mentioned, issue an immediate emergency clinical alert.`;

        let lastError = null;

        // 1. Google Gemini via Live Model Discovery & Execution
        if (apiKey) {
          const manifest = await fetchGoogleModelManifest(apiKey);

          let modelsToTry = [];
          if (manifest.success && manifest.models && manifest.models.length > 0) {
            modelsToTry = manifest.models.map(m => ({ ver: m.version, model: m.name }));
          } else {
            if (manifest.error) {
              lastError = manifest.error;
            }
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
            const url = `https://generativelanguage.googleapis.com/${item.ver}/${cleanModel}:generateContent?key=${apiKey}`;

            try {
              const geminiRes = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey
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

              const geminiData = await geminiRes.json();
              if (geminiData.error) {
                lastError = geminiData.error.message || `Error code ${geminiData.error.code}`;
                continue; // Try next model from manifest
              }

              const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (rawText) {
                const cleanHtml = rawText.replace(/^```html\s*|\s*```$/gi, '').trim();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  html: cleanHtml,
                  engine: cleanModel.replace('models/', ''),
                  apiVersion: item.ver,
                  provider: 'Google Gemini',
                  geminiSuccess: true
                }));
                return;
              }
            } catch (e) {
              lastError = e.message;
            }
          }
        }

        // 2. High-Fidelity Clinical Heuristics Fallback
        const qLow = q.toLowerCase();
        let fallbackHtml = '';

        if (qLow.includes('chest') || qLow.includes('breath') || qLow.includes('pain') || qLow.includes('emergency')) {
          fallbackHtml = `
            <b style="color:var(--red-light, #f87171);">EMERGENCY CLINICAL TRIAGE · ${city} · AQI ${aqi}</b>
            <ul>
              <li><strong>Immediate Medical Attention:</strong> Symptoms of acute respiratory distress or chest tightness in AQI >300 require immediate medical evaluation.</li>
              <li><strong>Emergency Contact:</strong> Dial 112 (National Emergency) or 102 (Ambulance Service) immediately.</li>
              <li><strong>Acute Indoor Triage:</strong> Administer prescribed rescue inhaler (e.g. Salbutamol via spacer), remain seated upright in an air-purified room, and avoid any physical exertion.</li>
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          html: fallbackHtml,
          engine: 'clinical-heuristics',
          provider: 'Deployment Engine',
          geminiConfigured: Boolean(apiKey),
          geminiError: lastError
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Static HTML Pages (Instant In-Memory Resolution for both clean & .html URLs)
  // --------------------------------------------------------------------------
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

  let htmlContent = null;
  if (!cleanPath || cleanPath === 'index' || cleanPath === 'index.html') {
    htmlContent = HTML_PAGES['index.html'];
  } else if (cleanPath === 'assistant' || cleanPath === 'assistant.html') {
    htmlContent = HTML_PAGES['assistant.html'];
  } else if (cleanPath === 'cadr-lab' || cleanPath === 'cadr-lab.html') {
    htmlContent = HTML_PAGES['cadr-lab.html'];
  } else if (cleanPath === 'diurnal-radar' || cleanPath === 'diurnal-radar.html') {
    htmlContent = HTML_PAGES['diurnal-radar.html'];
  } else if (cleanPath === 'community' || cleanPath === 'community.html') {
    htmlContent = HTML_PAGES['community.html'];
  }

  if (htmlContent) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
    res.end(htmlContent);
    return;
  }

  // --------------------------------------------------------------------------
  // Static File Fallback (CSS, JS, Images, etc.)
  // --------------------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // If still not found, return index.html as single-page fallback
      if (HTML_PAGES['index.html']) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_PAGES['index.html']);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// Start listening if executed directly or in standalone mode
if (require.main === module || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`AirLoop Full-Stack Server running at http://localhost:${PORT}`);
  });
}

// Export server instance for Vercel Serverless / Lambda runtime
module.exports = server;
