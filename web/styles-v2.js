/**
 * CSS Styles V2 - "Luxury Woodland Lodge" Aesthetic
 * Modern, sophisticated design inspired by the Dachsbau (badger den) theme
 */

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/;\}/g, '}')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\n+/g, '')
    .trim();
}

export const CSS_V2 = minifyCSS(`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --v2-bg-deep: #121010;
  --v2-bg-primary: #1a1714;
  --v2-bg-secondary: #221f1b;
  --v2-bg-card: #2a2520;
  --v2-bg-card-hover: #332d26;
  --v2-bg-elevated: #3a332b;
  --v2-bg-input: #1e1b17;

  --v2-text-primary: #f2ede8;
  --v2-text-secondary: #b8aea2;
  --v2-text-muted: #7a7068;
  --v2-text-inverse: #1a1714;

  --v2-gold: #c9a84c;
  --v2-gold-light: #dbb960;
  --v2-gold-dim: #8a7235;
  --v2-gold-bg: rgba(201, 168, 76, 0.08);
  --v2-gold-border: rgba(201, 168, 76, 0.2);

  --v2-green: #4a7c59;
  --v2-green-light: #6b9e7a;
  --v2-green-dim: #3a6148;

  --v2-error: #c75050;
  --v2-error-dim: rgba(199, 80, 80, 0.15);
  --v2-warning: #d4a853;
  --v2-success: #5a9e6a;
  --v2-success-dim: rgba(90, 158, 106, 0.15);

  --v2-border: #2d2822;
  --v2-border-light: #3d362e;
  --v2-border-accent: #4a4238;

  --v2-font-heading: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --v2-font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  --v2-radius-sm: 8px;
  --v2-radius-md: 14px;
  --v2-radius-lg: 22px;
  --v2-radius-xl: 32px;
  --v2-radius-full: 50%;

  --v2-space-xs: 4px;
  --v2-space-sm: 8px;
  --v2-space-md: 16px;
  --v2-space-lg: 24px;
  --v2-space-xl: 32px;
  --v2-space-2xl: 48px;
  --v2-space-3xl: 72px;

  --v2-shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
  --v2-shadow-md: 0 4px 24px rgba(0,0,0,0.4);
  --v2-shadow-lg: 0 8px 40px rgba(0,0,0,0.5);
  --v2-shadow-gold: 0 0 24px rgba(201, 168, 76, 0.08);
  --v2-shadow-glow: 0 0 40px rgba(201, 168, 76, 0.12);

  --v2-container-max: 1140px;
  --v2-header-height: 72px;

  /* Category colors */
  --v2-cat-spinning: #b89d5a;
  --v2-cat-winning: #5a9e6a;
  --v2-cat-losing: #c75050;
  --v2-cat-collecting: #d4a853;
  --v2-cat-social: #b86b8a;
  --v2-cat-dedication: #5a8ab8;
  --v2-cat-shopping: #c78050;
  --v2-cat-items: #5ab8a8;
  --v2-cat-special: #a85ab8;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

:focus-visible {
  outline: 2px solid var(--v2-gold);
  outline-offset: 2px;
}

body {
  font-family: var(--v2-font-body);
  background: var(--v2-bg-deep);
  color: var(--v2-text-primary);
  min-height: 100vh;
  line-height: 1.6;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Subtle background texture */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(201, 168, 76, 0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(74, 124, 89, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Animations */
@keyframes v2FadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes v2SlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes v2ScaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes v2Shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes v2GoldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.2); }
  50% { box-shadow: 0 0 20px 4px rgba(201, 168, 76, 0.1); }
}

@keyframes v2ConfettiFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* Container */
.v2-container {
  max-width: var(--v2-container-max);
  margin: 0 auto;
  padding: var(--v2-space-xl) var(--v2-space-lg);
  position: relative;
  z-index: 1;
}

/* Header */
.v2-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(18, 16, 16, 0.92);
  backdrop-filter: blur(16px) saturate(1.2);
  border-bottom: 1px solid var(--v2-border);
  padding: 0;
}

.v2-header-inner {
  max-width: var(--v2-container-max);
  margin: 0 auto;
  padding: 0 var(--v2-space-lg);
  display: flex;
  align-items: center;
  height: var(--v2-header-height);
  gap: var(--v2-space-xl);
}

.v2-logo {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  text-decoration: none;
  color: var(--v2-text-primary);
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.v2-logo:hover {
  opacity: 0.85;
}

.v2-logo-img {
  width: 36px;
  height: 36px;
  border-radius: var(--v2-radius-sm);
}

.v2-logo-text {
  font-family: var(--v2-font-heading);
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--v2-gold);
}

.v2-nav {
  display: flex;
  align-items: center;
  gap: var(--v2-space-xs);
  flex: 1;
}

.v2-nav-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--v2-radius-sm);
  text-decoration: none;
  color: var(--v2-text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s, background 0.2s;
  white-space: nowrap;
}

.v2-nav-item:hover {
  color: var(--v2-text-primary);
  background: var(--v2-bg-card);
}

.v2-nav-item.active {
  color: var(--v2-gold);
  background: var(--v2-gold-bg);
}

.v2-header-right {
  display: flex;
  align-items: center;
  gap: var(--v2-space-md);
  flex-shrink: 0;
}

/* Search */
.v2-search-form {
  position: relative;
  display: flex;
  align-items: center;
}

.v2-search-input {
  background: var(--v2-bg-input);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  padding: 8px 14px;
  padding-right: 36px;
  color: var(--v2-text-primary);
  font-family: var(--v2-font-body);
  font-size: 0.875rem;
  width: 180px;
  transition: border-color 0.2s, width 0.3s, box-shadow 0.2s;
}

.v2-search-input::placeholder {
  color: var(--v2-text-muted);
}

.v2-search-input:focus {
  outline: none;
  border-color: var(--v2-gold-dim);
  box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.1);
  width: 220px;
}

.v2-search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  padding: 4px;
  display: flex;
}

.v2-search-btn:hover {
  opacity: 1;
}

.v2-search-icon {
  width: 16px;
  height: 16px;
  filter: brightness(0.8) sepia(0.3);
}

/* Search suggestions */
.v2-search-wrapper {
  position: relative;
}

.v2-search-suggestions {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border-light);
  border-radius: var(--v2-radius-sm);
  margin-top: 4px;
  box-shadow: var(--v2-shadow-md);
  z-index: 200;
  max-height: 240px;
  overflow-y: auto;
}

.v2-suggestion-item {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--v2-text-secondary);
  transition: background 0.15s, color 0.15s;
  border-bottom: 1px solid var(--v2-border);
}

.v2-suggestion-item:last-child {
  border-bottom: none;
}

.v2-suggestion-item:hover {
  background: var(--v2-bg-elevated);
  color: var(--v2-text-primary);
}

/* User section */
.v2-user-section {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
}

.v2-user-profile-link {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  text-decoration: none;
  color: var(--v2-text-primary);
  padding: 6px 12px;
  border-radius: var(--v2-radius-sm);
  transition: background 0.2s;
}

.v2-user-profile-link:hover {
  background: var(--v2-bg-card);
}

.v2-user-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: var(--v2-radius-full);
  border: 1px solid var(--v2-border-light);
}

.v2-user-display-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.v2-btn-logout {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: var(--v2-radius-sm);
  transition: color 0.2s, background 0.2s;
}

.v2-btn-logout:hover {
  color: var(--v2-error);
  background: var(--v2-error-dim);
}

/* Twitch login */
.v2-btn-twitch-login {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  padding: 8px 16px;
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border-light);
  border-radius: var(--v2-radius-sm);
  color: var(--v2-text-primary);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s, border-color 0.2s;
}

.v2-btn-twitch-login:hover {
  background: var(--v2-bg-elevated);
  border-color: var(--v2-border-accent);
}

.v2-twitch-icon {
  width: 16px;
  height: 16px;
}

/* Hamburger */
.v2-hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  z-index: 101;
}

.v2-hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--v2-text-secondary);
  border-radius: 2px;
  transition: transform 0.3s, opacity 0.3s;
}

.v2-hamburger.active span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.v2-hamburger.active span:nth-child(2) {
  opacity: 0;
}

.v2-hamburger.active span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* Mobile nav overlay */
.v2-mobile-nav-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 98;
  opacity: 0;
  transition: opacity 0.3s;
}

.v2-mobile-nav-overlay.active {
  display: block;
  opacity: 1;
}

.v2-mobile-nav {
  display: none;
  position: fixed;
  top: 0;
  right: -100%;
  width: 280px;
  height: 100%;
  background: var(--v2-bg-primary);
  border-left: 1px solid var(--v2-border);
  z-index: 99;
  transition: right 0.3s ease;
  padding: var(--v2-space-3xl) var(--v2-space-lg) var(--v2-space-lg);
  overflow-y: auto;
}

.v2-mobile-nav.active {
  right: 0;
}

.v2-mobile-nav .v2-nav-item {
  display: block;
  padding: 14px 16px;
  font-size: 1rem;
  border-bottom: 1px solid var(--v2-border);
}

.v2-mobile-nav-divider {
  height: 1px;
  background: var(--v2-border);
  margin: var(--v2-space-md) 0;
}

/* Main content */
main.v2-main {
  animation: v2FadeIn 0.4s ease;
}

/* Typography */
.v2-page-title {
  font-family: var(--v2-font-heading);
  font-size: 2rem;
  font-weight: 600;
  color: var(--v2-text-primary);
  letter-spacing: -0.02em;
  margin-bottom: var(--v2-space-lg);
}

.v2-page-subtitle {
  font-size: 1rem;
  color: var(--v2-text-secondary);
  margin-bottom: var(--v2-space-xl);
  max-width: 600px;
}

.v2-section-title {
  font-family: var(--v2-font-heading);
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--v2-text-primary);
  margin-bottom: var(--v2-space-md);
  letter-spacing: -0.01em;
}

.v2-section-subtitle {
  font-size: 0.9rem;
  color: var(--v2-text-muted);
  margin-bottom: var(--v2-space-lg);
}

/* Cards */
.v2-card {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
  transition: border-color 0.2s, box-shadow 0.3s, transform 0.2s;
}

.v2-card:hover {
  border-color: var(--v2-border-light);
  box-shadow: var(--v2-shadow-gold);
}

.v2-card-elevated {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
  box-shadow: var(--v2-shadow-sm);
}

.v2-card-gold {
  border-color: var(--v2-gold-border);
  background: linear-gradient(135deg, var(--v2-bg-card) 0%, rgba(201, 168, 76, 0.04) 100%);
}

.v2-card-gold:hover {
  box-shadow: var(--v2-shadow-glow);
}

/* Buttons */
.v2-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--v2-space-sm);
  padding: 10px 20px;
  border-radius: var(--v2-radius-sm);
  font-family: var(--v2-font-body);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: none;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}

.v2-btn:active {
  transform: scale(0.97);
}

.v2-btn-primary {
  background: var(--v2-gold);
  color: var(--v2-text-inverse);
}

.v2-btn-primary:hover {
  background: var(--v2-gold-light);
  box-shadow: 0 4px 16px rgba(201, 168, 76, 0.25);
}

.v2-btn-secondary {
  background: var(--v2-bg-elevated);
  color: var(--v2-text-primary);
  border: 1px solid var(--v2-border-light);
}

.v2-btn-secondary:hover {
  background: var(--v2-bg-card-hover);
  border-color: var(--v2-border-accent);
}

.v2-btn-ghost {
  background: transparent;
  color: var(--v2-text-secondary);
  padding: 8px 14px;
}

.v2-btn-ghost:hover {
  color: var(--v2-text-primary);
  background: var(--v2-bg-card);
}

.v2-btn-danger {
  background: var(--v2-error);
  color: white;
}

.v2-btn-danger:hover {
  background: #d65858;
}

.v2-btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.v2-btn-lg {
  padding: 14px 28px;
  font-size: 1rem;
  border-radius: var(--v2-radius-md);
}

.v2-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Stat/Value displays */
.v2-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--v2-space-md);
  margin-bottom: var(--v2-space-xl);
}

.v2-stat-card {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-md) var(--v2-space-lg);
  text-align: center;
}

.v2-stat-value {
  font-family: var(--v2-font-heading);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--v2-gold);
  margin-bottom: 4px;
}

.v2-stat-label {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Balance display */
.v2-balance {
  font-family: var(--v2-font-heading);
  color: var(--v2-gold);
  font-weight: 700;
}

.v2-balance-lg {
  font-size: 2rem;
}

/* Progress bar */
.v2-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--v2-bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.v2-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--v2-gold-dim), var(--v2-gold));
  border-radius: 3px;
  transition: width 0.5s ease;
}

.v2-progress-fill-green {
  background: linear-gradient(90deg, var(--v2-green-dim), var(--v2-green));
}

/* Tags/Badges */
.v2-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.v2-badge-gold {
  background: var(--v2-gold-bg);
  color: var(--v2-gold);
  border: 1px solid var(--v2-gold-border);
}

.v2-badge-green {
  background: var(--v2-success-dim);
  color: var(--v2-success);
}

.v2-badge-red {
  background: var(--v2-error-dim);
  color: var(--v2-error);
}

/* Grids */
.v2-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--v2-space-md);
}

.v2-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--v2-space-md);
}

.v2-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--v2-space-md);
}

/* Hero section */
.v2-hero {
  text-align: center;
  padding: var(--v2-space-3xl) var(--v2-space-lg);
  position: relative;
}

.v2-hero::before {
  content: '';
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(201, 168, 76, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.v2-hero-logo {
  width: 80px;
  height: 80px;
  margin: 0 auto var(--v2-space-lg);
  border-radius: var(--v2-radius-lg);
  box-shadow: var(--v2-shadow-glow);
  animation: v2ScaleIn 0.5s ease;
}

.v2-hero-title {
  font-family: var(--v2-font-heading);
  font-size: 2.8rem;
  font-weight: 700;
  color: var(--v2-text-primary);
  letter-spacing: -0.03em;
  margin-bottom: var(--v2-space-md);
  animation: v2FadeIn 0.5s ease 0.1s both;
}

.v2-hero-title-gold {
  color: var(--v2-gold);
}

.v2-hero-subtitle {
  font-size: 1.1rem;
  color: var(--v2-text-secondary);
  margin-bottom: var(--v2-space-xl);
  animation: v2FadeIn 0.5s ease 0.2s both;
}

.v2-hero-search {
  max-width: 440px;
  margin: 0 auto;
  animation: v2FadeIn 0.5s ease 0.3s both;
}

.v2-hero-search .v2-search-input {
  width: 100%;
  padding: 14px 18px;
  font-size: 1rem;
  border-radius: var(--v2-radius-md);
}

.v2-hero-search .v2-search-input:focus {
  width: 100%;
}

.v2-hero-actions {
  margin-top: var(--v2-space-xl);
  display: flex;
  justify-content: center;
  gap: var(--v2-space-md);
  animation: v2FadeIn 0.5s ease 0.4s both;
}

/* Footer */
.v2-footer {
  border-top: 1px solid var(--v2-border);
  padding: var(--v2-space-xl) var(--v2-space-lg);
  text-align: center;
  margin-top: var(--v2-space-3xl);
  position: relative;
  z-index: 1;
}

.v2-footer p {
  font-size: 0.85rem;
  color: var(--v2-text-muted);
  margin-bottom: var(--v2-space-sm);
}

.v2-footer a {
  color: var(--v2-text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.v2-footer a:hover {
  color: var(--v2-gold);
}

.v2-footer-legal {
  font-size: 0.8rem;
}

.v2-footer-legal a {
  margin: 0 8px;
}

/* Design toggle (admin only) */
.v2-design-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--v2-space-md);
  padding: 6px 12px;
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  color: var(--v2-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.v2-design-toggle:hover {
  border-color: var(--v2-gold-dim);
  color: var(--v2-gold);
}

/* Toast */
.v2-toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v2-toast {
  padding: 12px 20px;
  border-radius: var(--v2-radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: var(--v2-shadow-md);
  transform: translateX(120%);
  transition: transform 0.3s ease;
  max-width: 320px;
}

.v2-toast.visible {
  transform: translateX(0);
}

.v2-toast-error {
  background: var(--v2-error);
  color: white;
}

.v2-toast-success {
  background: var(--v2-green);
  color: white;
}

.v2-toast-info {
  background: var(--v2-bg-elevated);
  color: var(--v2-text-primary);
  border: 1px solid var(--v2-border-light);
}

/* Confirm dialog */
.v2-confirm-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 500;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.v2-confirm-overlay.active {
  display: flex;
}

.v2-confirm-dialog {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border-light);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-xl);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--v2-shadow-lg);
  animation: v2ScaleIn 0.2s ease;
}

.v2-confirm-message {
  font-size: 0.95rem;
  color: var(--v2-text-primary);
  margin-bottom: var(--v2-space-lg);
  line-height: 1.5;
}

.v2-confirm-actions {
  display: flex;
  gap: var(--v2-space-sm);
  justify-content: flex-end;
}

/* Disclaimer */
.v2-disclaimer {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-left: 3px solid var(--v2-warning);
  border-radius: var(--v2-radius-sm);
  padding: var(--v2-space-lg);
  margin-bottom: var(--v2-space-xl);
  display: flex;
  gap: var(--v2-space-md);
  font-size: 0.875rem;
  color: var(--v2-text-secondary);
  line-height: 1.6;
}

.v2-disclaimer-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.v2-disclaimer-content p {
  margin-bottom: var(--v2-space-sm);
}

.v2-disclaimer-content a {
  color: var(--v2-warning);
  text-decoration: underline;
}

.v2-disclaimer-warning {
  background: var(--v2-error-dim);
  border: 1px solid rgba(199, 80, 80, 0.3);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
  margin-bottom: var(--v2-space-xl);
  display: flex;
  gap: var(--v2-space-md);
  align-items: flex-start;
}

.v2-disclaimer-warning strong {
  color: var(--v2-error);
}

/* Not found / Error pages */
.v2-not-found {
  text-align: center;
  padding: var(--v2-space-3xl) var(--v2-space-lg);
}

.v2-not-found-icon {
  font-size: 4rem;
  margin-bottom: var(--v2-space-lg);
  opacity: 0.6;
}

.v2-not-found-title {
  font-family: var(--v2-font-heading);
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: var(--v2-space-md);
}

.v2-not-found-text {
  color: var(--v2-text-secondary);
  margin-bottom: var(--v2-space-xl);
  font-size: 1rem;
}

/* Tables */
.v2-table-wrap {
  overflow-x: auto;
  border-radius: var(--v2-radius-md);
  border: 1px solid var(--v2-border);
}

.v2-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.v2-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--v2-bg-elevated);
  color: var(--v2-text-muted);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--v2-border);
}

.v2-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--v2-border);
  color: var(--v2-text-primary);
}

.v2-table tr:last-child td {
  border-bottom: none;
}

.v2-table tr:hover td {
  background: var(--v2-bg-card-hover);
}

/* Leaderboard */
.v2-leaderboard-entry {
  display: flex;
  align-items: center;
  padding: var(--v2-space-md) var(--v2-space-lg);
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  margin-bottom: var(--v2-space-sm);
  transition: border-color 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
}

.v2-leaderboard-entry:hover {
  border-color: var(--v2-border-accent);
  box-shadow: var(--v2-shadow-sm);
}

.v2-leaderboard-rank {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.v2-leaderboard-rank-img {
  width: 32px;
  height: 32px;
}

.v2-leaderboard-rank-num {
  font-family: var(--v2-font-heading);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--v2-text-muted);
}

.v2-leaderboard-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--v2-radius-full);
  margin: 0 var(--v2-space-md);
  border: 1px solid var(--v2-border);
  flex-shrink: 0;
}

.v2-leaderboard-name {
  flex: 1;
  font-weight: 600;
  font-size: 0.95rem;
}

.v2-leaderboard-badges {
  display: flex;
  gap: 4px;
  margin-left: var(--v2-space-sm);
}

.v2-leaderboard-badges img {
  width: 18px;
  height: 18px;
}

.v2-leaderboard-balance {
  font-family: var(--v2-font-heading);
  font-weight: 700;
  color: var(--v2-gold);
  font-size: 0.95rem;
  margin-left: auto;
  padding-left: var(--v2-space-md);
}

.v2-leaderboard-prestige {
  margin-left: var(--v2-space-sm);
  font-size: 1.1rem;
}

/* Profile */
.v2-profile-header {
  display: flex;
  align-items: center;
  gap: var(--v2-space-xl);
  margin-bottom: var(--v2-space-xl);
  padding: var(--v2-space-xl);
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-lg);
}

.v2-profile-header.complete {
  border-color: var(--v2-gold-border);
  animation: v2GoldPulse 3s ease-in-out infinite;
}

.v2-profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--v2-radius-full);
  border: 3px solid var(--v2-border-light);
  flex-shrink: 0;
}

.v2-profile-info {
  flex: 1;
}

.v2-profile-name {
  font-family: var(--v2-font-heading);
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.v2-profile-role-badges {
  display: flex;
  gap: var(--v2-space-sm);
  margin-bottom: var(--v2-space-sm);
}

.v2-profile-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.v2-profile-role-badge img {
  width: 14px;
  height: 14px;
}

.v2-profile-meta {
  font-size: 0.85rem;
  color: var(--v2-text-muted);
}

.v2-complete-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--v2-gold), var(--v2-gold-light));
  color: var(--v2-text-inverse);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

/* Achievements */
.v2-achievements-controls {
  display: flex;
  gap: var(--v2-space-sm);
  flex-wrap: wrap;
  margin-bottom: var(--v2-space-lg);
}

.v2-filter-btn,
.v2-sort-btn {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--v2-border);
  background: var(--v2-bg-card);
  color: var(--v2-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.v2-filter-btn:hover,
.v2-sort-btn:hover {
  border-color: var(--v2-border-accent);
  color: var(--v2-text-primary);
}

.v2-filter-btn.active,
.v2-sort-btn.active {
  background: var(--v2-gold-bg);
  border-color: var(--v2-gold-border);
  color: var(--v2-gold);
}

.v2-category {
  margin-bottom: var(--v2-space-xl);
  animation: v2SlideUp 0.4s ease both;
}

.v2-category-title {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  font-family: var(--v2-font-heading);
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--v2-space-md);
  padding-bottom: var(--v2-space-sm);
  border-bottom: 1px solid var(--v2-border);
  cursor: pointer;
}

.v2-category-title .category-icon-img {
  width: 24px;
  height: 24px;
}

.v2-category-title .v2-collapse-arrow {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  transition: transform 0.2s;
}

.v2-category.collapsed .v2-collapse-arrow {
  transform: rotate(-90deg);
}

.v2-category.collapsed .v2-achievements-grid {
  display: none;
}

.v2-achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--v2-space-sm);
}

.v2-achievement {
  display: flex;
  align-items: center;
  gap: var(--v2-space-md);
  padding: var(--v2-space-md);
  background: var(--v2-bg-secondary);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.v2-achievement:hover {
  border-color: var(--v2-border-accent);
  background: var(--v2-bg-card);
}

.v2-achievement.unlocked {
  border-color: var(--v2-gold-border);
}

.v2-achievement.locked {
  opacity: 0.55;
}

.v2-achievement-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.v2-achievement-info {
  flex: 1;
  min-width: 0;
}

.v2-achievement-name {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.v2-achievement-desc {
  font-size: 0.75rem;
  color: var(--v2-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.v2-achievement-status {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.v2-achievement.unlocked .v2-achievement-status {
  background: var(--v2-success-dim);
  color: var(--v2-success);
}

.v2-achievement.locked .v2-achievement-status {
  background: var(--v2-bg-elevated);
  color: var(--v2-text-muted);
}

/* Achievement Modal */
.v2-modal-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  z-index: 500;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.v2-modal-overlay.active {
  display: flex;
}

.v2-modal-content {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border-light);
  border-radius: var(--v2-radius-lg);
  padding: var(--v2-space-xl);
  max-width: 440px;
  width: 90%;
  box-shadow: var(--v2-shadow-lg);
  animation: v2ScaleIn 0.25s ease;
  position: relative;
}

.v2-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--v2-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.v2-modal-close:hover {
  color: var(--v2-text-primary);
}

.v2-modal-header {
  display: flex;
  align-items: center;
  gap: var(--v2-space-md);
  margin-bottom: var(--v2-space-md);
}

.v2-modal-icon {
  font-size: 2rem;
}

.v2-modal-header h2 {
  font-family: var(--v2-font-heading);
  font-size: 1.3rem;
  font-weight: 600;
}

.v2-modal-desc {
  color: var(--v2-text-secondary);
  font-size: 0.9rem;
  margin-bottom: var(--v2-space-lg);
}

.v2-modal-detail {
  display: flex;
  justify-content: space-between;
  padding: var(--v2-space-sm) 0;
  border-bottom: 1px solid var(--v2-border);
  font-size: 0.875rem;
}

.v2-modal-detail:last-child {
  border-bottom: none;
}

.v2-modal-detail strong {
  color: var(--v2-text-muted);
  font-weight: 500;
}

.v2-modal-progress-bar {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  margin-top: var(--v2-space-sm);
}

.v2-modal-progress-bar .v2-progress-bar {
  flex: 1;
}

.v2-modal-progress-bar span {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  white-space: nowrap;
}

/* Shop */
.v2-shop-categories-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--v2-space-sm);
  margin-bottom: var(--v2-space-xl);
  padding-bottom: var(--v2-space-md);
  border-bottom: 1px solid var(--v2-border);
}

.v2-shop-category {
  margin-bottom: var(--v2-space-xl);
}

.v2-shop-category-header {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  padding: var(--v2-space-md) 0;
  cursor: pointer;
  border-bottom: 1px solid var(--v2-border);
  margin-bottom: var(--v2-space-md);
}

.v2-shop-category-header h3 {
  font-family: var(--v2-font-heading);
  font-size: 1.2rem;
  font-weight: 600;
  flex: 1;
}

.v2-shop-category-count {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  padding: 2px 8px;
  background: var(--v2-bg-elevated);
  border-radius: 10px;
}

.v2-shop-category-arrow {
  color: var(--v2-text-muted);
  transition: transform 0.2s;
}

.v2-shop-category.v2-shop-cat-expanded .v2-shop-category-arrow {
  transform: rotate(90deg);
}

.v2-shop-category .v2-shop-items {
  display: none;
}

.v2-shop-category.v2-shop-cat-expanded .v2-shop-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--v2-space-md);
}

.v2-shop-item {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--v2-space-sm);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.v2-shop-item:hover {
  border-color: var(--v2-border-accent);
  box-shadow: var(--v2-shadow-sm);
}

.v2-shop-item-header {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
}

.v2-shop-item-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.v2-shop-item-emoji {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.v2-shop-item-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.v2-shop-item-desc {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  line-height: 1.4;
}

.v2-shop-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--v2-space-sm);
  border-top: 1px solid var(--v2-border);
}

.v2-shop-item-price {
  font-family: var(--v2-font-heading);
  font-weight: 700;
  color: var(--v2-gold);
  font-size: 0.95rem;
}

.v2-shop-item-owned {
  font-size: 0.75rem;
  color: var(--v2-success);
  font-weight: 600;
}

.v2-btn-buy {
  padding: 6px 14px;
  font-size: 0.8rem;
}

.v2-btn-buy-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Info page */
.v2-info-section {
  margin-bottom: var(--v2-space-2xl);
}

.v2-info-section h2 {
  font-family: var(--v2-font-heading);
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: var(--v2-space-md);
  padding-bottom: var(--v2-space-sm);
  border-bottom: 1px solid var(--v2-border);
}

.v2-info-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: var(--v2-space-lg) 0 var(--v2-space-sm);
  color: var(--v2-gold);
}

.v2-info-section p {
  color: var(--v2-text-secondary);
  margin-bottom: var(--v2-space-md);
  line-height: 1.7;
}

.v2-info-section ul,
.v2-info-section ol {
  color: var(--v2-text-secondary);
  padding-left: var(--v2-space-lg);
  margin-bottom: var(--v2-space-md);
}

.v2-info-section li {
  margin-bottom: var(--v2-space-sm);
  line-height: 1.6;
}

.v2-info-section a {
  color: var(--v2-gold);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Collapsible sections */
.v2-collapsible-section {
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  margin-bottom: var(--v2-space-md);
  overflow: hidden;
}

.v2-collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--v2-space-md) var(--v2-space-lg);
  background: var(--v2-bg-card);
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.v2-collapsible-header:hover {
  background: var(--v2-bg-card-hover);
}

.v2-collapsible-arrow {
  color: var(--v2-text-muted);
  font-size: 0.8rem;
  transition: transform 0.2s;
}

.v2-collapsible-section.expanded .v2-collapsible-arrow {
  transform: rotate(90deg);
}

.v2-collapsible-content {
  display: none;
  padding: var(--v2-space-lg);
  border-top: 1px solid var(--v2-border);
}

.v2-collapsible-section.expanded .v2-collapsible-content {
  display: block;
}

/* Payout table */
.v2-payout-section {
  margin-bottom: var(--v2-space-xl);
}

.v2-bet-toggle {
  display: flex;
  gap: var(--v2-space-xs);
  margin-bottom: var(--v2-space-md);
  flex-wrap: wrap;
}

.v2-bet-toggle-btn {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--v2-border);
  background: var(--v2-bg-card);
  color: var(--v2-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.v2-bet-toggle-btn.active {
  background: var(--v2-gold-bg);
  border-color: var(--v2-gold-border);
  color: var(--v2-gold);
}

/* Stats page */
.v2-global-stat-card {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
}

.v2-global-stat-card h3 {
  font-family: var(--v2-font-heading);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--v2-space-md);
  color: var(--v2-text-secondary);
}

/* Changelog */
.v2-changelog-entry {
  padding: var(--v2-space-lg) 0;
  border-bottom: 1px solid var(--v2-border);
}

.v2-changelog-entry:last-child {
  border-bottom: none;
}

.v2-changelog-date {
  font-size: 0.8rem;
  color: var(--v2-text-muted);
  margin-bottom: var(--v2-space-sm);
  font-weight: 500;
}

.v2-changelog-title {
  font-family: var(--v2-font-heading);
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--v2-space-sm);
}

.v2-changelog-content {
  font-size: 0.9rem;
  color: var(--v2-text-secondary);
  line-height: 1.6;
}

.v2-changelog-content ul {
  padding-left: var(--v2-space-lg);
  margin-top: var(--v2-space-sm);
}

.v2-changelog-content li {
  margin-bottom: 4px;
}

/* Admin panel */
.v2-admin-panel {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-error-dim);
  border-left: 3px solid var(--v2-error);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-lg);
  margin-top: var(--v2-space-xl);
}

.v2-admin-panel h3 {
  font-family: var(--v2-font-heading);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--v2-error);
  margin-bottom: var(--v2-space-md);
}

.v2-admin-row {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  margin-bottom: var(--v2-space-md);
  flex-wrap: wrap;
}

.v2-admin-row label {
  font-size: 0.85rem;
  color: var(--v2-text-secondary);
  min-width: 100px;
}

.v2-admin-input {
  background: var(--v2-bg-input);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  padding: 6px 12px;
  color: var(--v2-text-primary);
  font-family: var(--v2-font-body);
  font-size: 0.85rem;
  width: 140px;
}

.v2-admin-select {
  background: var(--v2-bg-input);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  padding: 6px 12px;
  color: var(--v2-text-primary);
  font-family: var(--v2-font-body);
  font-size: 0.85rem;
  max-width: 250px;
}

.v2-admin-message {
  font-size: 0.85rem;
  margin-top: var(--v2-space-sm);
  padding: 8px 12px;
  border-radius: var(--v2-radius-sm);
}

.v2-admin-message.success {
  background: var(--v2-success-dim);
  color: var(--v2-success);
}

.v2-admin-message.error {
  background: var(--v2-error-dim);
  color: var(--v2-error);
}

/* Refund items */
.v2-refund-groups {
  margin-top: var(--v2-space-md);
}

.v2-refund-group h4 {
  font-size: 0.9rem;
  font-weight: 600;
  margin: var(--v2-space-md) 0 var(--v2-space-sm);
  color: var(--v2-text-secondary);
}

.v2-refund-item {
  display: flex;
  align-items: center;
  gap: var(--v2-space-sm);
  padding: var(--v2-space-sm) var(--v2-space-md);
  border-radius: var(--v2-radius-sm);
  margin-bottom: 4px;
  font-size: 0.85rem;
}

.v2-refund-item.refundable {
  background: var(--v2-success-dim);
}

.v2-refund-item.blocked {
  background: var(--v2-bg-elevated);
}

.v2-refund-item.not-owned {
  opacity: 0.5;
}

.v2-refund-item-name {
  flex: 1;
}

.v2-refund-item-price {
  color: var(--v2-gold);
  font-weight: 600;
}

.v2-refund-blocked,
.v2-refund-not-owned {
  font-size: 0.75rem;
  color: var(--v2-text-muted);
}

/* Confetti */
.v2-confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.v2-confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  animation: v2ConfettiFall 4s linear forwards;
}

/* Keyboard shortcuts modal */
.v2-shortcuts-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 500;
  align-items: center;
  justify-content: center;
}

.v2-shortcuts-overlay.active {
  display: flex;
}

.v2-shortcuts-dialog {
  background: var(--v2-bg-card);
  border: 1px solid var(--v2-border-light);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-xl);
  max-width: 360px;
  width: 90%;
  box-shadow: var(--v2-shadow-lg);
}

.v2-shortcuts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--v2-space-lg);
}

.v2-shortcuts-header h3 {
  font-family: var(--v2-font-heading);
  font-size: 1.1rem;
  font-weight: 600;
}

.v2-shortcuts-grid {
  display: flex;
  flex-direction: column;
  gap: var(--v2-space-sm);
}

.v2-shortcut-item {
  display: flex;
  align-items: center;
  gap: var(--v2-space-md);
  font-size: 0.875rem;
}

.v2-shortcut-item kbd {
  background: var(--v2-bg-elevated);
  border: 1px solid var(--v2-border-light);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--v2-font-body);
  font-size: 0.8rem;
  min-width: 28px;
  text-align: center;
  color: var(--v2-gold);
}

.v2-shortcut-item span {
  color: var(--v2-text-secondary);
}

/* Offline banner */
.v2-offline-banner {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--v2-error);
  color: white;
  text-align: center;
  padding: 8px;
  font-size: 0.85rem;
  z-index: 1000;
}

/* Leaderboard search */
.v2-lb-search {
  margin-bottom: var(--v2-space-lg);
}

.v2-lb-search-input {
  background: var(--v2-bg-input);
  border: 1px solid var(--v2-border);
  border-radius: var(--v2-radius-sm);
  padding: 10px 16px;
  color: var(--v2-text-primary);
  font-family: var(--v2-font-body);
  font-size: 0.9rem;
  width: 100%;
  max-width: 360px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.v2-lb-search-input:focus {
  outline: none;
  border-color: var(--v2-gold-dim);
  box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.1);
}

/* Sorted achievements flat list */
.v2-sorted-achievements {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--v2-space-sm);
}

/* Staggered animations for lists */
.v2-stagger-1 { animation-delay: 0.05s; }
.v2-stagger-2 { animation-delay: 0.1s; }
.v2-stagger-3 { animation-delay: 0.15s; }
.v2-stagger-4 { animation-delay: 0.2s; }
.v2-stagger-5 { animation-delay: 0.25s; }

/* Responsive */
@media (max-width: 768px) {
  .v2-hamburger {
    display: flex;
  }

  .v2-nav {
    display: none;
  }

  .v2-mobile-nav {
    display: block;
  }

  .v2-header-inner {
    padding: 0 var(--v2-space-md);
  }

  .v2-header-right .v2-search-form {
    display: none;
  }

  .v2-container {
    padding: var(--v2-space-lg) var(--v2-space-md);
  }

  .v2-hero {
    padding: var(--v2-space-2xl) var(--v2-space-md);
  }

  .v2-hero-title {
    font-size: 2rem;
  }

  .v2-hero-logo {
    width: 60px;
    height: 60px;
  }

  .v2-profile-header {
    flex-direction: column;
    text-align: center;
    gap: var(--v2-space-md);
  }

  .v2-profile-role-badges {
    justify-content: center;
  }

  .v2-stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .v2-grid-2,
  .v2-grid-3,
  .v2-grid-4 {
    grid-template-columns: 1fr;
  }

  .v2-achievements-grid {
    grid-template-columns: 1fr;
  }

  .v2-shop-category.v2-shop-cat-expanded .v2-shop-items {
    grid-template-columns: 1fr;
  }

  .v2-leaderboard-entry {
    padding: var(--v2-space-sm) var(--v2-space-md);
  }

  .v2-leaderboard-avatar {
    width: 32px;
    height: 32px;
  }

  .v2-hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .v2-admin-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .v2-toast-container {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }

  .v2-toast {
    max-width: 100%;
  }

  .v2-user-display-name {
    display: none;
  }
}

@media (max-width: 480px) {
  .v2-logo-text {
    display: none;
  }

  .v2-stat-grid {
    grid-template-columns: 1fr;
  }

  .v2-hero-title {
    font-size: 1.6rem;
  }
}
`);
