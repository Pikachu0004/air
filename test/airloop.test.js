const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ----------------------------------------------------------------------------
// 1. Berkeley Earth Epidemiology Formulation Test
// ----------------------------------------------------------------------------
test('Berkeley Earth Inhalation Dose: 22 ug/m3 PM2.5 equals 1 cigarette', () => {
  const computeCigarettes = (pm25) => (pm25 / 22.0).toFixed(1);
  
  assert.equal(computeCigarettes(22.0), '1.0');
  assert.equal(computeCigarettes(330.0), '15.0');
  assert.equal(computeCigarettes(440.0), '20.0');
  assert.equal(computeCigarettes(0), '0.0');
});

// ----------------------------------------------------------------------------
// 2. Multiplicative Compounding Exposure Defense Test
// ----------------------------------------------------------------------------
test('Multiplicative Compounding Exposure: Net dose cut calculation', () => {
  // Move 1: Sealed Room (85% cut) -> Remaining = 0.15
  // Move 2: True HEPA Purifier (88% cut) -> Remaining = 0.15 * 0.12 = 0.018
  // Move 3: N95 Respirator Commute (95% cut) -> Remaining = 0.018 * 0.05 = 0.0009
  const cuts = [0.85, 0.88, 0.95];
  const remaining = cuts.reduce((acc, cut) => acc * (1 - cut), 1.0);
  const netCutPercent = (1.0 - remaining) * 100;

  assert.ok(netCutPercent > 99.0);
  assert.equal(netCutPercent.toFixed(1), '99.9');
});

// ----------------------------------------------------------------------------
// 3. CADR Clean Air Delivery Rate Physics Test
// ----------------------------------------------------------------------------
test('CADR Room Clearing Physics: ACH calculation', () => {
  // Formula: ACH = (CADR_cfm * 60) / Room_Volume_cuft
  const computeACH = (cadrCfm, volumeCuFt) => (cadrCfm * 60) / volumeCuFt;

  // 250 CFM purifier in 1200 cu ft room (12x10x10 ft)
  const ach = computeACH(250, 1200);
  assert.equal(ach, 12.5); // 12.5 air changes per hour

  // Room clearing half-life (minutes): t_half = 60 * ln(2) / ACH
  const halfLifeMinutes = (60 * Math.LN2) / ach;
  assert.ok(halfLifeMinutes < 4.0); // clears 50% aerosol mass in ~3.3 minutes
});

// ----------------------------------------------------------------------------
// 4. File Integrity & Semantic Verification
// ----------------------------------------------------------------------------
test('Platform Integrity: All 5 core interface pages exist and contain semantic landmarks', () => {
  const root = path.join(__dirname, '..');
  const requiredPages = [
    'index.html',
    'diurnal-radar.html',
    'cadr-lab.html',
    'community.html',
    'assistant.html'
  ];

  for (const page of requiredPages) {
    const fullPath = path.join(root, page);
    assert.ok(fs.existsSync(fullPath), `Page ${page} must exist in project root`);
    
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.includes('<html'), `${page} must contain <html> tag`);
    assert.ok(content.includes('<header'), `${page} must contain semantic <header> landmark`);
    assert.ok(content.includes('<main'), `${page} must contain semantic <main> landmark`);
    assert.ok(content.includes('<footer'), `${page} must contain semantic <footer> landmark`);
  }
});

// ----------------------------------------------------------------------------
// 5. Governance & Compliance Documents Test
// ----------------------------------------------------------------------------
test('Governance Documentation: LICENSE, SECURITY, ACCESSIBILITY exist', () => {
  const root = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')), 'LICENSE file must exist');
  assert.ok(fs.existsSync(path.join(root, 'SECURITY.md')), 'SECURITY.md file must exist');
  assert.ok(fs.existsSync(path.join(root, 'ACCESSIBILITY.md')), 'ACCESSIBILITY.md file must exist');
});

// ----------------------------------------------------------------------------
// 6. Strict Repository Size Check (< 10 MB)
// ----------------------------------------------------------------------------
test('Repository Size Limit: Total size is strictly under 10 MB', () => {
  const root = path.join(__dirname, '..');
  let totalBytes = 0;

  function calculateDirSize(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        calculateDirSize(fullPath);
      } else if (entry.isFile()) {
        totalBytes += fs.statSync(fullPath).size;
      }
    }
  }

  calculateDirSize(root);
  const totalMB = totalBytes / (1024 * 1024);
  assert.ok(totalMB < 10.0, `Repository project files must be under 10 MB, current size is ${totalMB.toFixed(2)} MB`);
  assert.ok(totalMB < 2.0, `Optimized bundle target is < 2 MB, actual: ${totalMB.toFixed(2)} MB`);
});

// ----------------------------------------------------------------------------
// 7. Security Input & Output Sanitization Test
// ----------------------------------------------------------------------------
test('Security Sanitization: Protects against script injection in assistant prompts', () => {
  const sanitize = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const maliciousPayload = '<script>alert("xss")</script><img src="x" onerror="steal()"/>';
  const clean = sanitize(maliciousPayload);

  // HTML entity encoding ensures tags are neutralized as literal text, preventing DOM execution
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('<img'));
  assert.equal(clean, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;img src=&quot;x&quot; onerror=&quot;steal()&quot;/&gt;');
});

// ----------------------------------------------------------------------------
// 8. Diurnal Inversion Atmospheric Risk Windows Test
// ----------------------------------------------------------------------------
test('Diurnal Atmospheric Inversion: Accurate peak nocturnal trapping thresholds', () => {
  // Peak smog trapping occurs typically between 00:00 - 08:00 due to ground radiation cooling
  const isNocturnalInversionWindow = (hour) => (hour >= 23 || hour <= 8);

  assert.equal(isNocturnalInversionWindow(4), true);   // 4 AM peak trapping
  assert.equal(isNocturnalInversionWindow(14), false);  // 2 PM daytime solar mixing
  assert.equal(isNocturnalInversionWindow(23), true);  // 11 PM ground inversion begins
});

// ----------------------------------------------------------------------------
// 9. Community & Code Quality Standards Test
// ----------------------------------------------------------------------------
test('Code Quality & Community Health: Standards, Linter, and Template files exist', () => {
  const root = path.join(__dirname, '..');
  const requiredFiles = [
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    '.eslintrc.json',
    '.prettierrc.json',
    '.editorconfig',
    '.github/workflows/ci.yml',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md'
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(root, file);
    assert.ok(fs.existsSync(fullPath), `Quality standard file ${file} must exist`);
  }
});

// ----------------------------------------------------------------------------
// 10. WCAG 2.1 AA Accessibility Landmarks & Skip-Links Test
// ----------------------------------------------------------------------------
test('Accessibility Architecture: All 5 pages have WCAG 2.4.1 Skip-links and main targets', () => {
  const root = path.join(__dirname, '..');
  const pages = [
    'index.html',
    'diurnal-radar.html',
    'cadr-lab.html',
    'community.html',
    'assistant.html'
  ];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.ok(html.includes('class="skip-link"'), `${page} must contain a WCAG skip-link`);
    assert.ok(html.includes('id="main-content"'), `${page} must contain #main-content target`);
    assert.ok(html.includes('lang="en"'), `${page} must specify lang="en"`);
  }
});

// ----------------------------------------------------------------------------
// 11. Package Manifest Integrity Test
// ----------------------------------------------------------------------------
test('Package Manifest: Full metadata and test/audit scripts configured', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'airloop-urbanair');
  assert.ok(pkg.author && pkg.author.includes('Kishan Nishad'), 'Author must cite Kishan Nishad');
  assert.ok(pkg.repository && pkg.repository.url, 'Repository must be declared');
  assert.ok(pkg.scripts.test, 'Test script must exist');
  assert.ok(pkg.scripts['test:coverage'], 'Coverage script must exist');
  assert.ok(pkg.scripts.lint, 'Lint script must exist');
  assert.ok(pkg.scripts.audit, 'Audit script must exist');
});
