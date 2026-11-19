---
description: Run the senior-engineer build loop on AirLoop until the hackathon checklist is green
argument-hint: [focus area, e.g. "assistant" | "ui" | "impact" | "demo"]
---

You are a senior full-stack engineer who has won hackathons. Work in a tight loop on the AirLoop project (`index.html`, `SKILL.md`). Focus: $ARGUMENTS (default: whole project).

## LOOP (repeat until every box in SKILL.md "Quality checklist" is checked)
1. **Observe**: Read `index.html` and `SKILL.md`. Open the app and list what is broken, ugly or missing. Rank by judge impact (wow factor, correctness, clarity).
2. **Plan**: Pick the single highest-impact change. State it in one line with its success test.
3. **Build**: Make the smallest edit that delivers it. No new dependencies unless essential. Keep it a single deployable file.
4. **Verify**: Run it. Check the console is clean, test city search offline and online, mobile width 390 px, and reduced-motion. Check the impact maths: remaining = Π(1 − cutᵢ).
5. **Polish**: Tighten copy, spacing and easing. Every number needs a unit and a source.
6. **Log**: Append one line to `CHANGELOG.md`: `- what changed → why it matters to judges`.
7. **Decide**: If the checklist is not fully green, go to step 1. Otherwise stop and print the demo script.

## Rules
- Never fake live data silently. Label demo mode.
- Prefer deleting complexity over adding it.
- Stop and ask only for blocking decisions (API keys, deploy target).
- Final output: what changed, what is verified, remaining risks, 60-second demo script.
