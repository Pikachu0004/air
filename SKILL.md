---
name: airloop-air-quality-assistant
description: Build, extend and polish AirLoop, a GenAI urban air-quality assistant for families and communities facing winter smog. Use for hackathon work on low-emission routines, indoor air hacks, location-aware advice and quantified impact.
---

# AirLoop: Urban Air Quality Assistant (Hackathon Skill)

## Mission
Help a household answer "What should we do today?" for their city and lifestyle. Every recommendation must show its **quantified impact**.

## Non-negotiables
1. **Location-aware**: live AQI/PM2.5 from Open-Meteo (no API key). Geocode city names. Fall back to demo data if offline.
2. **Lifestyle-aware**: profile chips (kids, elderly, asthma, commuter, runner, cook) re-rank advice.
3. **Impact-explained**: each action shows % dose reduction, cigarette-equivalents (22 µg/m³ PM2.5 ≈ 1 cigarette/day) and CO₂ saved.
4. **Compounding maths**: remaining = Π(1 − cutᵢ). Never add percentages.
5. **Honest**: indicative estimates, "not medical advice", cite WHO / Berkeley Earth / CPCB.
6. **Three advice layers**: (a) low-emission routines, (b) indoor air hacks, (c) sustainable community alternatives.

## Design system (match the reference screenshot)
- Background `#09090a`, panels `#111113`, borders `#26262a`, accent red `#e5322d`, AQI colour is dynamic.
- Fonts: Anton (display, uppercase), Oswald (labels/buttons, letter-spaced), Inter (body).
- Layout: sticky nav with logo and cart-style badge (routine count), left-aligned hero with a red eyebrow, outlined CTA, 4-column product-style cards with "ADD TO ROUTINE", 4-column footer with newsletter.
- Motion: masked headline rise-in, count-up numbers, animated SVG gauge, drifting smog particles tinted by AQI, scroll reveal, 3D card tilt, marquee ticker, button wipe-fill. Respect `prefers-reduced-motion`.

## Assistant behaviour
- Input: `{q, context:{city, aqi, pm25, profile[], routine[]}}`.
- Output: a header line (city, AQI, level), 3–5 concrete steps and one **Impact:** line with a number.
- Tone: calm, specific, non-alarmist. Say "N95/FFP2", "after 1 PM", "doors closed", not "be careful".
- Safety: for chest pain, breathlessness or asthma attacks tell the user to seek medical care. Never diagnose.

## AQI bands (US AQI)
0–50 Good · 51–100 Moderate · 101–150 Sensitive · 151–200 Unhealthy · 201–300 Very unhealthy · 301+ Hazardous.

## Quality checklist (run before demo)
- [ ] City search works, geolocation fallback works
- [ ] Gauge, colours and particles update on city change
- [ ] Adding or removing moves updates badge, % cut, cigarettes and CO₂
- [ ] Assistant answers 6+ intents; LLM endpoint is optional and degrades gracefully
- [ ] Mobile (390 px) and reduced-motion verified
- [ ] 60-second demo script rehearsed

## 60-second demo script
1. Search "Delhi" and the gauge turns red, ticker updates (5 s).
2. Toggle "Kids" and "Commuter": cards re-rank (10 s).
3. Add purifier, N95 and metro: impact drops from X to Y cigarettes (15 s).
4. Ask "Can my kids play outside?" and get a step list with an Impact line (15 s).
5. Close: "Every choice, quantified" (5 s).
