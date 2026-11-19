# AirLoop Security Policy

## 1. Supported Versions

Security updates and critical patches are actively maintained for the following versions:

| Version | Supported | Status |
| :--- | :--- | :--- |
| **3.x.x** | ✅ Yes | Current Production & Hackathon Release |
| **2.x.x** | ❌ No | Legacy Prototype |
| **< 2.0** | ❌ No | Deprecated |

---

## 2. Security Architecture & Threat Model

AirLoop is designed according to strict defense-in-depth principles:

### A. Zero-Credential Client Boundary
- **No Client Secrets**: API keys (such as `GEMINI_API_KEY`) are never delivered to, stored in, or readable by client-side browser scripts.
- **Serverless Edge Isolation**: All Generative AI inference is performed through backend serverless proxies (`/api/chat.js` and `server.js`).
- **Session Privacy**: When a user inputs an optional session test key, it is held strictly in temporary browser `sessionStorage` and never persisted to databases or transmitted to third parties other than the authenticated endpoint.

### B. Payload Sanitization & Clinical Safety Guardrails
- **Input Validation**: All incoming requests to `/api/chat` and `/api/forecast` are type-checked, bounds-tested, and sanitized against injection attacks.
- **HTML Sanitization**: All Generative AI responses are stripped of unauthorized script blocks and dangerous tags before rendering into the DOM.
- **Emergency Medical Safeguards**: Queries mentioning acute respiratory distress, severe chest pain, or clinical emergencies trigger immediate hardcoded triage warnings directing users to national emergency numbers (112 / 102).

### C. Network & Transport Security
- **HTTPS Enforcement**: All production traffic on Vercel is strictly routed over TLS 1.3.
- **CORS Policies**: Explicit Access-Control-Allow-Origin headers limit API exposure.
- **Public Datasets Only**: Real-time atmospheric telemetry is ingested from authenticated or public scientific APIs (Open-Meteo, CPCB) containing no personally identifiable information (PII).

---

## 3. Reporting a Vulnerability

If you discover a potential security vulnerability within AirLoop, please report it privately:

1. **Primary Contact**: Kishan Nishad ([@Pikachu0004](https://github.com/Pikachu0004))
2. **Repository Issues**: Open a private security advisory on GitHub or email via developer profile.
3. **Response Timeline**: All security reports will be acknowledged within 24 hours with an initial assessment and patch timeline.

Please do not disclose potential vulnerabilities publicly until a patch has been released.
