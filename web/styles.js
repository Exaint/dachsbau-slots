/**
 * CSS Styles for Achievement Website
 * Dark theme optimized for Twitch-style appearance
 */

export const CSS = `
:root {
  /* Dark theme (default) */
  --bg-primary: #0e0e10;
  --bg-secondary: #18181b;
  --bg-tertiary: #1f1f23;
  --bg-card: #26262c;
  --text-primary: #efeff1;
  --text-secondary: #adadb8;
  --text-muted: #848494;
  --accent: #9147ff;
  --accent-hover: #772ce8;
  --success: #00f593;
  --warning: #ffb800;
  --error: #eb0400;
  --border: #3d3d44;
  --dachs-gold: #ffd700;

  /* Category colors */
  --cat-spinning: #9147ff;
  --cat-winning: #00f593;
  --cat-collecting: #ffb800;
  --cat-social: #ff6b9d;
  --cat-dedication: #00bfff;
  --cat-shopping: #ff7f50;
  --cat-special: #e040fb;
}

/* Light theme */
[data-theme="light"] {
  --bg-primary: #f7f7f8;
  --bg-secondary: #ffffff;
  --bg-tertiary: #efeff1;
  --bg-card: #e5e5e8;
  --text-primary: #0e0e10;
  --text-secondary: #53535f;
  --text-muted: #848494;
  --border: #d2d2d7;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.5;
  transition: background 0.3s ease, color 0.3s ease;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes confettiFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

@keyframes celebratePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
  50% { transform: scale(1.02); box-shadow: 0 0 30px 10px rgba(255, 215, 0, 0.2); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Confetti */
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  animation: confettiFall 4s linear forwards;
}

.profile-header.complete {
  animation: celebratePulse 2s ease-in-out infinite;
  border-color: var(--dachs-gold);
}

.complete-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--dachs-gold), #ffaa00);
  color: #000;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-left: 12px;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 16px 0;
  margin-bottom: 24px;
}

.header-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo:hover {
  color: var(--dachs-gold);
}

.logo-emoji {
  font-size: 1.8rem;
}

/* Search Form */
.search-form {
  display: flex;
  gap: 8px;
}

.search-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.95rem;
  width: 200px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* Search Suggestions */
.search-wrapper {
  position: relative;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-top: 4px;
  z-index: 100;
  display: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.suggestion-item:hover {
  background: var(--bg-tertiary);
}

.suggestion-item:first-child {
  border-radius: 6px 6px 0 0;
}

.suggestion-item:last-child {
  border-radius: 0 0 6px 6px;
}

.btn {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 18px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-card);
}

/* Profile Header */
.profile-header {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid var(--border);
}

.profile-top {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  object-fit: cover;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.profile-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.profile-badge {
  width: 18px;
  height: 18px;
  vertical-align: middle;
  margin-left: 8px;
}

.profile-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--accent);
  margin-left: 8px;
}

.profile-last-active {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.profile-rank {
  font-size: 1rem;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 20px;
  color: var(--dachs-gold);
}

.profile-duel-status {
  font-size: 0.9rem;
  padding: 4px 12px;
  border-radius: 20px;
}

.profile-duel-status.opted-in {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.profile-duel-status.opted-out {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.profile-selfban-status {
  font-size: 0.9rem;
  padding: 4px 12px;
  border-radius: 20px;
}

.profile-selfban-status.banned {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.info-tooltip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  font-size: 0.85rem;
  cursor: help;
  vertical-align: middle;
  position: relative;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.info-tooltip:hover {
  opacity: 1;
}

.info-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
  pointer-events: none;
  margin-bottom: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.info-tooltip:hover::after {
  opacity: 1;
  visibility: visible;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.stat-box {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: fadeIn 0.4s ease-out;
  animation-fill-mode: both;
}

.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Achievement Progress */
.achievement-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.achievement-count {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.achievement-count strong {
  color: var(--success);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--success));
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Achievement Filter & Sort Controls */
.achievement-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;
}

.achievement-filter,
.achievement-sort {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-right: 4px;
}

.filter-btn,
.sort-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover,
.sort-btn:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.sort-btn.active {
  background: var(--dachs-gold);
  border-color: var(--dachs-gold);
  color: #000;
}

/* Sorted achievements list */
.sorted-achievements {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Achievement Categories */
.categories {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.category {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
  animation: fadeIn 0.4s ease-out;
  animation-fill-mode: both;
}

.category-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.2s;
}

.category-header:hover {
  background: var(--bg-tertiary);
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.category-header:hover .category-icon {
  transform: scale(1.15) rotate(5deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.category-spinning .category-icon { background: var(--cat-spinning); }
.category-winning .category-icon { background: var(--cat-winning); }
.category-collecting .category-icon { background: var(--cat-collecting); }
.category-social .category-icon { background: var(--cat-social); }
.category-dedication .category-icon { background: var(--cat-dedication); }
.category-shopping .category-icon { background: var(--cat-shopping); }
.category-special .category-icon { background: var(--cat-special); }

.category-progress {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.category-content {
  padding: 0 20px 20px;
}

/* Achievement Items */
.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.achievement {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease, padding 0.25s ease;
  animation: fadeIn 0.3s ease-out;
  animation-fill-mode: both;
  cursor: pointer;
}

.achievement:hover {
  transform: translateX(6px) scale(1.01);
  background: var(--bg-card);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  padding: 16px 18px;
}

.achievement.unlocked {
  border-left: 3px solid var(--success);
}

.achievement.unlocked:hover {
  box-shadow: 0 4px 12px rgba(0, 245, 147, 0.15);
}

.achievement.locked {
  opacity: 0.6;
  border-left: 3px solid var(--border);
}

.achievement.locked:hover {
  opacity: 0.8;
}

.achievement.hidden {
  background: repeating-linear-gradient(
    45deg,
    var(--bg-tertiary),
    var(--bg-tertiary) 10px,
    var(--bg-card) 10px,
    var(--bg-card) 20px
  );
}

.achievement-icon {
  font-size: 1.5rem;
  width: 40px;
  text-align: center;
}

.achievement-info {
  flex: 1;
}

.achievement-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.achievement-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.achievement-rarity {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.achievement-rarity::before {
  content: '👥';
  font-size: 0.7rem;
}

/* Rarity color coding */
.achievement-rarity.rarity-legendary {
  color: #ff8c00;
  font-weight: 600;
}
.achievement-rarity.rarity-legendary::before {
  content: '💎';
}

.achievement-rarity.rarity-epic {
  color: #a855f7;
  font-weight: 600;
}
.achievement-rarity.rarity-epic::before {
  content: '⭐';
}

.achievement-rarity.rarity-rare {
  color: #3b82f6;
}
.achievement-rarity.rarity-rare::before {
  content: '🔹';
}

.achievement-rarity.rarity-common {
  color: var(--text-muted);
}
.achievement-rarity.rarity-common::before {
  content: '👥';
}

.achievement-reward {
  display: none; /* Hidden for now - rewards still work in backend */
  background: var(--bg-card);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  color: var(--dachs-gold);
  white-space: nowrap;
}

.achievement-progress {
  width: 80px;
}

.achievement-progress .progress-bar {
  height: 6px;
  margin-bottom: 4px;
}

.achievement-progress-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

/* Leaderboard */
.leaderboard {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.leaderboard-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
}

.leaderboard-title {
  font-size: 1.3rem;
  font-weight: 700;
}

.leaderboard-list {
  padding: 12px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  transition: background 0.2s ease;
  animation: slideIn 0.3s ease-out;
  animation-fill-mode: both;
}

.leaderboard-item:hover {
  background: var(--bg-tertiary);
}

.leaderboard-rank {
  font-size: 1.3rem;
  width: 40px;
  text-align: center;
  flex-shrink: 0;
}

.leaderboard-user {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.leaderboard-username-link {
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.leaderboard-username-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

.leaderboard-role {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  font-size: 0.75rem;
}

.leaderboard-badge {
  width: 16px;
  height: 16px;
  vertical-align: middle;
}

.leaderboard-role-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.leaderboard-balance {
  font-weight: 600;
  color: var(--dachs-gold);
  flex-shrink: 0;
}

/* Home Page */
.hero {
  text-align: center;
  padding: 60px 20px;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
}

.hero-subtitle {
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.hero-search {
  max-width: 400px;
  margin: 0 auto;
}

.hero-search .search-form {
  justify-content: center;
}

.hero-search .search-input {
  width: 250px;
}

/* Not Found */
.not-found {
  text-align: center;
  padding: 60px 20px;
}

.not-found-emoji {
  font-size: 4rem;
  margin-bottom: 16px;
}

.not-found-title {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.not-found-text {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* Footer */
.footer {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 40px;
  border-top: 1px solid var(--border);
}

.footer-link {
  color: var(--accent);
  text-decoration: none;
}

.footer-link:hover {
  color: var(--dachs-gold);
  text-decoration: underline;
}

.footer-legal {
  margin-top: 8px;
  font-size: 0.8rem;
}

.footer-legal a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-legal a:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

/* Legal Pages */
.legal-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.legal-page h1 {
  font-size: 2rem;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.legal-subtitle {
  color: var(--text-muted);
  margin-bottom: 32px;
  font-size: 0.9rem;
}

.legal-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.legal-section:last-of-type {
  border-bottom: none;
}

.legal-section h2 {
  font-size: 1.3rem;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.legal-section h3 {
  font-size: 1.1rem;
  margin: 20px 0 12px 0;
  color: var(--text-secondary);
}

.legal-section p {
  margin-bottom: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.legal-section address {
  font-style: normal;
  line-height: 1.8;
  color: var(--text-secondary);
}

.legal-section ul {
  margin: 12px 0;
  padding-left: 24px;
}

.legal-section li {
  margin-bottom: 8px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.legal-section a {
  color: var(--accent);
  text-decoration: none;
}

.legal-section a:hover {
  text-decoration: underline;
}

.legal-section code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

.legal-footer {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.legal-footer a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.legal-footer a:hover {
  text-decoration: underline;
}

/* Theme Toggle */
.theme-toggle {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.theme-toggle:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  transform: scale(1.05);
}

.theme-toggle-icon {
  font-size: 1rem;
  transition: transform 0.3s ease;
}

.theme-toggle:hover .theme-toggle-icon {
  transform: rotate(20deg);
}

/* Navigation Bar (inline in header) */
.nav-bar {
  display: flex;
  gap: 4px;
  flex: 1;
}

.nav-item {
  padding: 8px 12px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.nav-item.active {
  color: var(--accent);
  background: var(--bg-tertiary);
}

/* Mobile Hamburger Menu */
.hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 1001;
}

.hamburger span {
  width: 22px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(4px, 4px);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
}

.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(4px, -4px);
}

.mobile-nav {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary);
  z-index: 1000;
  padding-top: 70px;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mobile-nav.active {
  display: flex;
}

.mobile-nav .nav-item {
  font-size: 1.1rem;
  padding: 12px 24px;
}

/* Disclaimer */
.disclaimer {
  background: var(--bg-secondary);
  border: 1px solid var(--warning);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.disclaimer-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.disclaimer-content {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.disclaimer-content p {
  margin-bottom: 8px;
}

.disclaimer-content p:last-child {
  margin-bottom: 0;
}

.disclaimer-content strong {
  color: var(--text-primary);
}

/* Content Pages */
.content-page {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 24px;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.page-subtitle {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.page-subtitle code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.content-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.content-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.content-section h2 {
  font-size: 1.3rem;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.content-section h3 {
  font-size: 1.1rem;
  margin: 16px 0 12px;
  color: var(--text-secondary);
}

/* Info Table */
.info-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: grid;
  grid-template-columns: 120px 150px 1fr;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  align-items: center;
}

.info-step {
  font-weight: 600;
  color: var(--accent);
}

.info-row code {
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* Command List */
.command-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-item {
  display: flex;
  gap: 16px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  align-items: center;
}

.command-item code {
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  white-space: nowrap;
  min-width: 200px;
}

.command-item span {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Section Intro */
.section-intro {
  color: var(--text-secondary);
  margin-bottom: 16px;
  font-size: 0.95rem;
}

/* Symbol Grid */
.symbol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.symbol-card {
  background: var(--bg-tertiary);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  border: 1px solid var(--border);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: fadeIn 0.4s ease-out;
  animation-fill-mode: both;
}

.symbol-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.symbol-card.jackpot {
  border-color: var(--dachs-gold);
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(255, 215, 0, 0.1) 100%);
}

.symbol-card.special {
  border-color: var(--accent);
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(145, 71, 255, 0.1) 100%);
}

.symbol-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.symbol-name {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 4px;
}

.symbol-rarity {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.symbol-card.jackpot .symbol-rarity {
  color: var(--dachs-gold);
  font-weight: 600;
}

.symbol-card.special .symbol-rarity {
  color: var(--accent);
  font-weight: 600;
}

.symbol-wins {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.win-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  padding: 4px 8px;
  background: var(--bg-card);
  border-radius: 4px;
}

.win-combo {
  letter-spacing: 2px;
}

.win-amount {
  font-weight: 600;
  color: var(--text-primary);
}

.win-amount.gold {
  color: var(--dachs-gold);
}

/* Legacy Symbol Table (kept for compatibility) */
.symbol-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.symbol-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.symbol-row.header {
  background: var(--bg-card);
  font-weight: 600;
  color: var(--text-secondary);
}

.symbol-row .gold {
  color: var(--dachs-gold);
  font-weight: 600;
}

/* Help Table */
.help-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-row {
  display: grid;
  grid-template-columns: 140px 160px 1fr;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  align-items: center;
}

.help-row a {
  color: var(--accent);
  text-decoration: none;
}

.help-row a:hover {
  text-decoration: underline;
}

/* Shop */
.shop-category {
  margin-bottom: 24px;
}

.shop-category:last-child {
  margin-bottom: 0;
}

.shop-category-header {
  margin-bottom: 16px;
}

.shop-category-title {
  font-size: 1.2rem;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.shop-category-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
}

.shop-tip {
  background: var(--bg-tertiary);
  border-left: 3px solid var(--dachs-gold);
  padding: 12px 16px;
  margin-bottom: 24px;
  border-radius: 0 8px 8px 0;
  font-size: 0.9rem;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shop-item {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.shop-item:hover {
  transform: translateX(4px);
  box-shadow: -4px 0 0 var(--accent);
}

.shop-item-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.shop-item-content {
  flex: 1;
  min-width: 0;
}

.shop-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.shop-item-name {
  font-weight: 600;
  color: var(--text-primary);
}

.shop-item-price {
  color: var(--dachs-gold);
  font-weight: 700;
  margin-left: auto;
}

.shop-item-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.shop-item-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.shop-item-id {
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
}

.shop-item-requires {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: rgba(239, 68, 68, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

.shop-item-limit {
  font-size: 0.75rem;
  color: var(--accent);
  background: rgba(0, 217, 255, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

.shop-item-cmd {
  font-size: 0.75rem;
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--success);
  font-family: monospace;
}

/* Changelog */
.changelog-entry {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.changelog-entry:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.changelog-entry h2 {
  font-size: 1.2rem;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.changelog-date {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--text-muted);
}

.changelog-content {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
}

.changelog-content h3 {
  font-size: 1rem;
  margin: 0 0 8px;
  color: var(--text-primary);
}

.changelog-content ul {
  margin: 0 0 16px 20px;
  color: var(--text-secondary);
}

.changelog-content ul:last-child {
  margin-bottom: 0;
}

.changelog-content li {
  margin-bottom: 4px;
}

.changelog-content code {
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}

/* Global Stats Page */
.global-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.global-stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.global-stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--dachs-gold);
  margin-bottom: 8px;
}

.global-stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.stats-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.stats-section h2 {
  font-size: 1.3rem;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.stat-achievement-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-achievement {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.stat-rank {
  font-weight: 700;
  color: var(--dachs-gold);
  width: 30px;
}

.stat-ach-name {
  flex: 1;
  font-weight: 500;
}

.stat-ach-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.stat-category-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-category {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.stat-cat-icon {
  font-size: 1.5rem;
}

.stat-cat-name {
  flex: 1;
  font-weight: 500;
}

.stat-cat-value {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .global-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-category-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .global-stats-grid {
    grid-template-columns: 1fr;
  }

  .global-stat-value {
    font-size: 1.5rem;
  }
}

/* Achievement Detail Modal */
.modal-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  justify-content: center;
  align-items: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-overlay.active {
  display: flex;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
  max-width: 450px;
  width: 100%;
  position: relative;
  animation: slideIn 0.3s ease-out;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.modal-icon {
  font-size: 2.5rem;
}

.modal-header h2 {
  font-size: 1.4rem;
  color: var(--text-primary);
  margin: 0;
}

.modal-desc {
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.modal-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-detail {
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.modal-detail strong {
  color: var(--text-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-wrap: wrap;
  }

  .nav-bar {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .logo .logo-text {
    display: none;
  }

  .search-form {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    justify-content: flex-start;
  }

  .logo .logo-text {
    display: none;
  }

  .nav-bar {
    display: none;
  }

  .search-form {
    flex-direction: column;
  }

  .search-input {
    width: 100%;
  }

  .hero-title {
    font-size: 1.8rem;
  }

  .hero-search .search-input {
    width: 100%;
  }

  .profile-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .profile-title {
    display: block;
    margin-left: 0;
    margin-top: 4px;
    font-size: 0.8rem;
  }

  .achievement {
    flex-wrap: wrap;
  }

  .achievement-progress {
    width: 100%;
    margin-top: 8px;
  }

  /* Profile mobile fixes */
  .profile-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-avatar {
    width: 70px;
    height: 70px;
  }

  .profile-name {
    flex-wrap: wrap;
    font-size: 1.4rem;
    gap: 8px;
    justify-content: center;
  }

  .profile-badges {
    justify-content: center;
  }

  .profile-last-active {
    text-align: center;
  }

  .profile-rank,
  .profile-duel-status {
    font-size: 0.8rem;
    padding: 3px 10px;
  }

  .info-tooltip::after {
    white-space: normal;
    width: 200px;
    left: auto;
    right: 0;
    transform: none;
  }

  /* Command list mobile fixes */
  .command-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .command-item code {
    min-width: auto;
    width: 100%;
  }

  /* Info table mobile fixes */
  .info-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .info-row > *:first-child {
    font-weight: 600;
  }
}

/* Skeleton Loading */
.skeleton {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-card) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-header {
  height: 120px;
  margin-bottom: 24px;
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.skeleton-stat {
  height: 80px;
}

.skeleton-category {
  margin-bottom: 24px;
}

.skeleton-category-header {
  height: 40px;
  margin-bottom: 12px;
}

.skeleton-achievement {
  height: 60px;
  margin-bottom: 8px;
}

.skeleton-text {
  height: 20px;
  width: 60%;
}

.skeleton-text-sm {
  height: 14px;
  width: 40%;
  margin-top: 8px;
}

@media (max-width: 600px) {
  .skeleton-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;
