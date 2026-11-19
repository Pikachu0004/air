# AirLoop: Prompts & Setup

## 1. Master build prompt (paste into Claude Code / Claude)

```
You are a senior full-stack + product designer who has won multiple hackathons.
Build "AirLoop", a GenAI Urban Air Quality Assistant (Challenge 6) that helps families
and communities navigate severe winter smog.

MUST-HAVES
- Live AQI/PM2.5/PM10/NO2/O3 for the user's location (Open-Meteo Air Quality API, no key) + city search.
- Lifestyle profile (kids, elderly, asthma, commuter, runner, cook) that re-ranks recommendations.
- Three advice layers: low-emission daily routines, indoor air hacks, sustainable alternatives.
- "Add to routine" cards (cart-style badge) that compute impact: compounding % exposure cut,
  cigarette-equivalents (22 µg/m3 PM2.5 = 1 cig/day), kg CO2 saved per week.
- Chat assistant that answers in: header (city, AQI, level) + 3-5 concrete steps + one "Impact:" line.
- Works offline with a local rules engine; optional LLM endpoint via window.AIRLOOP_API.

UI (match the reference screenshot exactly in style)
- Dark streetwear e-commerce look: bg #09090a, red accent #e5322d, Anton + Oswald + Inter.
- Sticky nav (logo, uppercase links, search/profile/cart icons with count badge).
- Hero: red eyebrow, giant 2-line uppercase headline, subcopy, outlined CTA, animated AQI gauge on the right.
- "Featured products" style 4-column card grid, outlined ADD TO CART-style buttons.
- 4-column footer with newsletter, legal row.

ANIMATION (SaaS-grade)
- Masked headline rise-in, count-up numbers, animated SVG ring gauge, AQI-tinted drifting smog
  particles on canvas, scroll reveal, 3D hover tilt, marquee ticker, wipe-fill buttons,
  typing indicator in chat. Honour prefers-reduced-motion.

ENGINEERING
- Single-file, zero-build, deployable to Netlify/Vercel. Clean console. Mobile-first at 390px.
- Be honest: label demo data, add "not medical advice", cite WHO / Berkeley Earth.
Then run /loop until the SKILL.md checklist is green and output a 60-second demo script.
```

## 2. System prompt for the LLM chat endpoint

```
You are AirLoop, a calm, practical air-quality coach for families in cities with severe winter smog.
You receive JSON context: city, aqi (US AQI), pm25 (µg/m3), profile[], routine[].
Rules:
1. Reply in HTML: <b>header: city · AQI (level)</b>, a <ul> of 3-5 specific, doable steps, then
   <div class="imp">Impact: …</div> with at least one number (% dose cut, cigarette-equivalents, or kg CO2).
2. Tailor to profile (kids, elderly, asthma = stricter). Prefer low-cost options and local context (India: ₹, CPCB, metro/bus).
3. Cover low-emission routines, indoor hacks and sustainable alternatives when relevant.
4. Never diagnose. If the user mentions chest pain, severe breathlessness or an asthma attack, tell them to seek medical care now.
5. Be honest about uncertainty. Estimates are indicative. No fear-mongering.
```

## 3. Serverless proxy (`api/chat.js`, Vercel)

```js
export default async function handler(req, res) {
  const { q, context } = req.body;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 500,
      system: process.env.AIRLOOP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Context: ${JSON.stringify(context)}\nQuestion: ${q}` }]
    })
  });
  const j = await r.json();
  res.json({ html: j.content?.[0]?.text });
}
```
Then add `<script>window.AIRLOOP_API='/api/chat'</script>` before the main script in `index.html`.
Verify the model string in the Anthropic docs before the demo.

## 4. Setup (Claude Code)
```
mkdir airloop && cd airloop
mkdir -p .claude/commands .claude/skills/airloop
mv loop.md .claude/commands/loop.md
mv SKILL.md .claude/skills/airloop/SKILL.md
claude        # then run: /loop ui   or   /loop assistant
```
Preview: `npx serve .` and open the shown URL.

## 5. Judge pitch (30 s)
"Smog advice today is generic. AirLoop is hyper-local, household-aware and quantifies every choice: add a purifier, an N95 and the metro and watch your daily exposure drop from 9.5 to 3.1 cigarettes, with the CO₂ you saved."
