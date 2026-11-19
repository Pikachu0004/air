# AirLoop Accessibility Statement (WCAG 2.1 AA Compliance)

AirLoop is committed to ensuring digital accessibility for all users, including individuals with visual, motor, auditory, or cognitive impairments. As an emergency atmospheric defense platform, accessible delivery of critical health information during severe smog events is a top architectural priority.

---

## 1. Compliance Standards

AirLoop is designed to conform to the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standards.

### Core Accessibility Implementations:

| WCAG Principle | AirLoop Implementation |
| :--- | :--- |
| **1. Perceivable** | - **High-Contrast Dark Theme**: All text maintains a contrast ratio exceeding **4.5:1** against backgrounds, with large headings exceeding **7:1**.<br>- **Color Independence**: Health hazard categories (Good, Moderate, Severe, Hazardous) are identified by numerical AQI values, descriptive labels, and icons, never by color alone.<br>- **Text Alternatives**: All UI controls, SVGs, and interactive widgets provide descriptive `aria-label` or `title` attributes. |
| **2. Operable** | - **Full Keyboard Navigation**: Every link, button, input field, and modal is fully accessible via `Tab`, `Enter`, `Space`, and `Escape` keys.<br>- **Visible Focus Rings**: Active interactive elements display distinct, high-contrast focus outlines.<br>- **Skip Navigation Links**: Primary content areas can be reached directly via keyboard shortcuts. |
| **3. Understandable** | - **Predictable Layouts**: Unified navigation bar, status indicators, and footer structures across all 5 modules (`index.html`, `diurnal-radar.html`, `cadr-lab.html`, `community.html`, `assistant.html`).<br>- **Plain Language Warnings**: Emergency pulmonology triage alerts are written in clear, concise language free of medical jargon. |
| **4. Robust** | - **Semantic HTML5**: Native elements (`<header>`, `<main>`, `<nav>`, `<article>`, `<aside>`, `<footer>`) ensure compatibility with modern assistive technologies.<br>- **Screen Reader Live Regions**: Real-time chat replies and telemetry updates use `aria-live="polite"` to notify screen readers without interrupting user workflow. |

---

## 2. Reduced Motion & Sensory Accommodations

AirLoop strictly respects user operating system preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

When reduced motion is requested, background particle canvas simulations, counter animations, and hover transitions are immediately deactivated to prevent vestibular discomfort.

---

## 3. Assistive Technology Testing

AirLoop has been verified across:
- **VoiceOver** (macOS and iOS)
- **NVDA & JAWS** (Windows)
- **Chrome Accessibility DevTools** & **Lighthouse Accessibility Audit** (Targeting a 100/100 score).

---

## 4. Feedback & Contact

If you encounter any accessibility barrier or have suggestions for improvement, please open an issue on the GitHub repository or contact:
- **Author**: Kishan Nishad ([@Pikachu0004](https://github.com/Pikachu0004))
- **Repository**: [github.com/Pikachu0004/air](https://github.com/Pikachu0004/air)
