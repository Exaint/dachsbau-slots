/**
 * CSS Styles for Achievement Website
 * Dark theme optimized for Twitch-style appearance
 */

export const CSS = `
:root {
  /* Dark theme (default) - WCAG AA compliant */
  --bg-primary: #0e0e10;
  --bg-secondary: #18181b;
  --bg-tertiary: #1f1f23;
  --bg-card: #26262c;
  --text-primary: #efeff1;
  --text-secondary: #adadb8;
  --text-muted: #9494a4;
  --accent: #a855f7;
  --accent-hover: #9333ea;
  --success: #00f593;
  --warning: #ffb800;
  --error: #f87171;
  --border: #3d3d44;
  --dachs-gold: #ffd700;

  /* Category colors */
  --cat-spinning: #a855f7;
  --cat-winning: #00f593;
  --cat-collecting: #ffb800;
  --cat-social: #ff6b9d;
  --cat-dedication: #00bfff;
  --cat-shopping: #ff7f50;
  --cat-special: #e040fb;
}

/* Light theme - inspired by Tailwind CSS Slate palette */
[data-theme="light"] {
  --bg-primary: #e4e5f1;
  --bg-secondary: #fafafa;
  --bg-tertiary: #f1f5f9;
  --bg-card: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --border: #cbd5e1;
  /* Adjusted colors for light mode readability */
  --dachs-gold: #92400e;
  --warning: #b45309;
  --success: #059669;
  --error: #dc2626;
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
  /* Category colors adjusted for light mode */
  --cat-spinning: #7c3aed;
  --cat-winning: #059669;
  --cat-collecting: #b45309;
  --cat-social: #db2777;
  --cat-dedication: #0284c7;
  --cat-shopping: #ea580c;
  --cat-special: #c026d3;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Global focus styles for accessibility */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}

/* Header */
.header {
  border-bottom: 1px solid var(--border);
  padding: 12px 0;
  margin-bottom: 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  background: rgba(24, 24, 27, 0.95);
}

[data-theme="light"] .header {
  background: rgba(241, 245, 249, 0.95);
  border-bottom-color: var(--border);
}

/* Light theme specific overrides for better readability */
[data-theme="light"] .btn-secondary {
  color: var(--text-primary);
  background: #ffffff;
  border-color: var(--border);
}

[data-theme="light"] .btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

[data-theme="light"] .leaderboard-balance {
  color: #92400e;
  background: rgba(146, 64, 14, 0.12);
}

[data-theme="light"] .stat-value {
  color: #92400e;
}

[data-theme="light"] .logo:hover {
  color: #7c3aed;
}

[data-theme="light"] .footer-link:hover {
  color: #7c3aed;
}

[data-theme="light"] .footer {
  background: var(--bg-tertiary);
  border-top-color: var(--border);
}

[data-theme="light"] .legal-footer {
  background: var(--bg-tertiary);
  border-top-color: var(--border);
}

[data-theme="light"] .complete-badge {
  background: linear-gradient(135deg, #92400e, #b45309);
  color: white;
}

[data-theme="light"] .achievement-card.unlocked {
  border-color: #92400e;
}

[data-theme="light"] .achievement-icon.unlocked {
  background: rgba(146, 64, 14, 0.12);
  color: #92400e;
}

[data-theme="light"] .progress-fill {
  background: linear-gradient(90deg, var(--accent), #8b5cf6);
}

[data-theme="light"] .nav-item.active {
  background: rgba(124, 58, 237, 0.12);
}

[data-theme="light"] .search-input:focus {
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
}

[data-theme="light"] .admin-panel {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(219, 39, 119, 0.08));
  border-color: rgba(124, 58, 237, 0.25);
}

[data-theme="light"] .admin-panel-header:hover {
  background: rgba(124, 58, 237, 0.08);
}

[data-theme="light"] .shop-item:hover {
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

[data-theme="light"] .category-badge {
  background: rgba(124, 58, 237, 0.1);
}

[data-theme="light"] .stat-box:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

[data-theme="light"] .profile-header.complete {
  border-color: #92400e;
  box-shadow: 0 0 20px rgba(146, 64, 14, 0.12);
}

[data-theme="light"] .global-stat-card {
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.logo:hover {
  color: var(--dachs-gold);
  transform: scale(1.02);
}

.logo-img {
  height: 44px;
  width: auto;
  max-width: 60px;
  object-fit: contain;
  object-position: center;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* Search Form */
.search-form {
  display: flex;
  gap: 6px;
}

.search-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 0.85rem;
  width: 140px;
  height: 38px;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s, width 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(145, 71, 255, 0.15);
  width: 180px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.btn-search {
  padding: 8px 14px;
  min-width: auto;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  height: 38px;
  box-sizing: border-box;
}

.search-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
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
  text-decoration: none;
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

/* Twitch Login Button */
.btn-twitch-login {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #9147ff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-twitch-login:hover {
  background: #772ce8;
}

.btn-twitch-login .twitch-icon {
  flex-shrink: 0;
}

/* User Section in Header */
.user-section {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  height: 38px;
  box-sizing: border-box;
}

.user-profile-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--text-primary);
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.2s;
}

.user-profile-link:hover {
  background: var(--bg-card);
}

.user-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--accent);
}

.user-display-name {
  font-weight: 600;
  font-size: 0.85rem;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

/* Shop User Info */
.shop-user-info {
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.shop-user-balance {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shop-user-balance .balance-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.shop-user-balance .balance-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dachs-gold);
}

.shop-login-prompt {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  text-align: center;
}

.shop-login-prompt p {
  margin-bottom: 12px;
  color: var(--text-secondary);
}

/* Profile Header */
.profile-header {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 28px;
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

.profile-prestige-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--prestige-color, var(--dachs-gold));
  color: var(--prestige-color, var(--dachs-gold));
}

/* Profile Role Badges */
.profile-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--role-color, var(--accent));
  color: var(--role-color, var(--accent));
}

.profile-role-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.profile-duel-status {
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: 20px;
}

.profile-duel-status.opted-in {
  background: var(--bg-tertiary);
  border: 1px solid #00ad03;
  color: #00ad03;
}

.profile-duel-status.opted-out {
  background: var(--bg-tertiary);
  border: 1px solid #ef4444;
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

.profile-duel-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  width: 100%;
  margin-top: 4px;
}

.profile-duel-hint code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
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
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 24px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.leaderboard-title {
  font-size: 1.3rem;
  font-weight: 700;
}

.leaderboard-info {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.leaderboard-info code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
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

.leaderboard-item:nth-child(odd) {
  background: var(--bg-card);
}

.leaderboard-item:hover {
  background: rgba(145, 71, 255, 0.1);
}

.leaderboard-rank {
  font-size: 1.3rem;
  width: 40px;
  text-align: center;
  flex-shrink: 0;
}

.leaderboard-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.leaderboard-avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
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
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--dachs-gold);
  flex-shrink: 0;
  background: rgba(255, 215, 0, 0.1);
  padding: 6px 14px;
  border-radius: 8px;
}

/* Admin Filter (Leaderboard) */
.admin-filter {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(145, 71, 255, 0.1);
  border: 1px solid rgba(145, 71, 255, 0.3);
  border-radius: 8px;
}

.admin-filter-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.admin-filter-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}

.admin-filter-label {
  user-select: none;
}

.no-disclaimer-badge {
  margin-left: 4px;
  font-size: 0.9rem;
}

.leaderboard-item.no-disclaimer {
  background: rgba(255, 165, 0, 0.08);
  border-left: 3px solid orange;
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
  max-width: 500px;
  margin: 0 auto;
}

.hero-search .search-form {
  justify-content: center;
  flex-wrap: nowrap;
}

.hero-search .search-input {
  width: 250px;
  flex-shrink: 1;
  min-width: 150px;
}

.hero-search .btn {
  white-space: nowrap;
  flex-shrink: 0;
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

.footer-disclaimer {
  margin-top: 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

/* Theme Toggle in Footer */
.theme-toggle-footer {
  margin-top: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.theme-toggle-footer:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--accent);
}

.theme-toggle-footer .theme-toggle-icon {
  font-size: 1rem;
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

/* Header Right Section */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Navigation Bar (inline in header) */
.nav-bar {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.nav-item {
  padding: 8px 12px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s, transform 0.15s ease;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

.nav-item.active {
  color: var(--accent);
  background: rgba(145, 71, 255, 0.15);
  font-weight: 600;
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

/* Disclaimer Warning for logged-in users */
.disclaimer-warning {
  background: rgba(235, 4, 0, 0.1);
  border: 2px solid var(--error);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.disclaimer-warning-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.disclaimer-warning-content {
  flex: 1;
}

.disclaimer-warning-content strong {
  color: var(--error);
  font-size: 1.1rem;
  display: block;
  margin-bottom: 8px;
}

.disclaimer-warning-content p {
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.disclaimer-warning-content p:last-child {
  margin-bottom: 0;
}

.disclaimer-warning-content code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.disclaimer-warning-content a {
  color: var(--accent);
  text-decoration: none;
}

.disclaimer-warning-content a:hover {
  text-decoration: underline;
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

.stats-profile-link {
  margin-bottom: 24px;
  text-align: center;
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
  min-width: 260px;
  flex-shrink: 0;
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.shop-item {
  background: var(--bg-tertiary);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  border: 1px solid transparent;
}

.shop-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-color: var(--accent);
}

.shop-item-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.shop-item-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
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

/* Shop Item Owned Status */
.shop-item-owned {
  font-size: 0.75rem;
  color: var(--success);
  background: rgba(0, 245, 147, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: auto;
  margin-right: 8px;
}

.shop-item-is-owned {
  border-color: var(--success);
  background: linear-gradient(135deg, var(--bg-card), rgba(0, 245, 147, 0.05));
}

.shop-item-is-owned .shop-item-icon {
  opacity: 0.7;
}

.shop-item-is-owned .shop-item-price {
  text-decoration: line-through;
  opacity: 0.5;
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

.global-stat-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
  font-style: italic;
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

.stat-ach-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-ach-name {
  font-weight: 500;
}

.stat-ach-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
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

  /* Header right section on tablet */
  .header-right {
    gap: 8px;
  }

  .search-input {
    width: 120px;
  }

  /* Hide login button text on smaller screens */
  .btn-twitch-login span {
    display: none;
  }

  .btn-twitch-login {
    padding: 8px 10px;
  }

  /* User section on mobile */
  .user-section {
    gap: 6px;
  }

  .user-display-name {
    display: none;
  }

  .btn-logout {
    padding: 6px 8px;
    font-size: 0.8rem;
  }

  /* Shop user info on mobile */
  .shop-user-info {
    flex-direction: column;
    text-align: center;
  }

  /* Stats 3 columns on tablet */
  .profile-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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

  /* Hide search on very small screens - use mobile nav */
  .header-right .search-form {
    display: none;
  }

  .header-right {
    gap: 8px;
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

  /* Shop grid mobile */
  .shop-items {
    grid-template-columns: 1fr;
  }

  /* Container padding mobile */
  .container {
    padding: 16px;
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

/* Admin Panel */
.admin-panel {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  margin-bottom: 24px;
  overflow: hidden;
}

.admin-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s ease;
  user-select: none;
}

.admin-panel-header:hover {
  background: rgba(139, 92, 246, 0.1);
}

.admin-panel-header h3 {
  margin: 0;
  color: var(--accent);
  font-size: 1.1rem;
}

.admin-panel-user {
  font-size: 0.9rem;
  color: var(--text-muted);
  flex: 1;
  text-align: center;
}

.admin-panel-toggle {
  color: var(--accent);
  font-size: 0.9rem;
  transition: transform 0.3s ease;
}

.admin-panel-content {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(139, 92, 246, 0.2);
  transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
  max-height: 600px;
  opacity: 1;
}

.admin-panel.collapsed .admin-panel-content {
  max-height: 0;
  padding: 0 20px;
  opacity: 0;
  overflow: hidden;
  border-top: none;
}

.admin-panel.collapsed .admin-panel-header {
  border-bottom: none;
}

.admin-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding-top: 16px;
}

.admin-control {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.admin-control label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.admin-input-group {
  display: flex;
  gap: 8px;
}

.admin-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.admin-input:focus {
  outline: none;
  border-color: var(--accent);
}

.admin-select {
  cursor: pointer;
  min-width: 200px;
}

.admin-control-wide {
  grid-column: 1 / -1;
}

.admin-control-wide .admin-input-group {
  flex-wrap: wrap;
}

.admin-control-wide .admin-select {
  flex: 2;
  min-width: 250px;
}

.admin-toggle-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-status {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.admin-status.active {
  color: var(--success);
}

.admin-status.danger {
  color: var(--error);
}

.admin-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  min-width: auto;
}

.admin-btn.success {
  background: var(--success);
}

.admin-btn.success:hover {
  background: #00c77b;
}

.admin-btn.danger {
  background: var(--error);
}

.admin-btn.danger:hover {
  background: #dc2626;
}

.admin-message {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  display: none;
}

.admin-message.success {
  display: block;
  background: rgba(0, 245, 147, 0.15);
  color: var(--success);
  border: 1px solid rgba(0, 245, 147, 0.3);
}

.admin-message.error {
  display: block;
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

@media (max-width: 600px) {
  .admin-panel-grid {
    grid-template-columns: 1fr;
  }

  .admin-panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .admin-toggle-group {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;
