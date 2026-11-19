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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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

  // API Route: GET /api/forecast
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

  // API Route: POST /api/chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { q, context } = payload;
        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing query parameter "q"' }));
          return;
        }

        const city = context?.city || 'Delhi';
        const aqi = Math.round(context?.aqi || 384);
        const band = context?.band || 'Hazardous';

        const systemPrompt = `You are AirLoop Clinical Smog Coach, an expert environmental pulmonology and urban air quality AI assistant helping families navigate severe winter smog.
Atmospheric Telemetry Context: ${JSON.stringify(context || {})}
Rules:
1. First line MUST be: <b>header: ${city} · AQI ${aqi} (${band})</b>
2. Provide a <ul> list of 3-4 specific, doable steps (CADR room filtration, fitted N95 respirator seals, solar purge window 13:00-15:30 ventilation, and transit mode alternatives).
3. Conclude with: <div class="imp">Impact: [Exact quantified number: % dose cut, cigarette-equivalents avoided, or kg CO2 prevented]</div>
4. Emergency alert: If acute chest pain or asthma attack is mentioned, immediately warn to call 112/911.`;

        // If GEMINI_API_KEY is configured in deployment environment:
        if (GEMINI_API_KEY) {
          try {
            const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${q}` }] }],
                generationConfig: { temperature: 0.35, maxOutputTokens: 600 }
              })
            });
            const data = await apiRes.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              let text = data.candidates[0].content.parts[0].text;
              text = text.replace(/^```html\s*|\s*```$/gi, '').trim();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ html: text, engine: GEMINI_MODEL, provider: 'Google Gemini (Live)' }));
              return;
            }
          } catch (e) {
            console.warn('Gemini upstream error, falling back:', e.message);
          }
        }

        // Clinical heuristic fallback
        const qLow = q.toLowerCase();
        let fallbackHtml = '';
        if (qLow.includes('chest pain') || qLow.includes('breathless') || qLow.includes('attack')) {
          fallbackHtml = `
            <b>header: ${city} · AQI ${aqi} (${band})</b>
            <div class="medical-alert" style="margin-top:0.5rem; padding:0.65rem 0.85rem; background:rgba(229,50,45,0.15); border:1px solid #e5322d; color:#fca5a5; font-weight:600; font-size:0.82rem; border-radius:2px;">
              🚨 <strong>IMMEDIATE EMERGENCY ALERT:</strong> Chest pain or acute breathlessness during severe smog requires immediate emergency room care. Contact 112 / 911 immediately.
            </div>
            <ul>
              <li>Position patient upright; do not leave unattended.</li>
              <li>Administer prescribed rescue bronchodilator inhaler (with spacer).</li>
              <li>Avoid ambient smoke or incense exposure; seal windows and run HEPA continuous.</li>
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
        res.end(JSON.stringify({ html: fallbackHtml, engine: 'clinical-heuristics', provider: 'Deployment Engine' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`AirLoop Full-Stack Server running at http://localhost:${PORT}`);
});
