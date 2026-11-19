# Contributing to AirLoop

Thank you for your interest in contributing to **AirLoop — Atmospheric Health Defense Platform**, developed for Hackathon Challenge 6 by **Kishan Nishad**.

## 1. Development Principles

- **Zero-Build Architecture**: Core pages run natively in modern evergreen browsers without compilation overhead.
- **Strict Repository Size**: The total repository size must remain strictly **under 10 MB** (currently ~1 MB). Do not commit large binary assets, large video files, or unminified dependencies.
- **Defensive Security**: Never commit API keys, secrets, or credential tokens. Inference requests must route through backend proxies.
- **Accessibility (WCAG 2.1 AA)**: All interactive controls must include `aria-label`, visible focus indicators, and semantic landmarks.

## 2. Setting Up Locally

```bash
# Clone repository
git clone https://github.com/Pikachu0004/air.git
cd air

# Start development server
node server.js
```

Open [http://localhost:3000](http://localhost:3000) to view the interface.

## 3. Testing & Verification

Before submitting changes, run the automated quality checks:

```bash
# Run automated unit tests with coverage
npm test

# Run syntax and linter checks
npm run lint
```

All tests must pass 100% with zero syntax errors.

## 4. Pull Request Checklist

1. Verify tests pass: `npm test`.
2. Verify lint clean: `npm run lint`.
3. Check repository size: `du -sh .` must be `< 10 MB`.
4. Ensure new pages include `LICENSE`, `SECURITY`, and `ACCESSIBILITY` compliance links.
