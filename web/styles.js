/**
 * CSS Styles for Achievement Website
 * Dark theme optimized for Twitch-style appearance
 */

export const CSS = `
:root {
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

.profile-name {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
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

.profile-rank {
  font-size: 1rem;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 20px;
  color: var(--dachs-gold);
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.stat-box {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
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
  transition: transform 0.2s, box-shadow 0.2s;
}

.achievement:hover {
  transform: translateX(4px);
}

.achievement.unlocked {
  border-left: 3px solid var(--success);
}

.achievement.locked {
  opacity: 0.6;
  border-left: 3px solid var(--border);
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

.achievement-reward {
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
  transition: background 0.2s;
}

.leaderboard-item:hover {
  background: var(--bg-tertiary);
}

.leaderboard-rank {
  font-size: 1.3rem;
  width: 40px;
  text-align: center;
}

.leaderboard-user {
  flex: 1;
}

.leaderboard-username {
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
}

.leaderboard-username:hover {
  color: var(--accent);
}

.leaderboard-balance {
  font-weight: 600;
  color: var(--dachs-gold);
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

/* Symbol Table */
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

.shop-category-title {
  font-size: 1.1rem;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shop-item {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px 16px;
}

.shop-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.shop-item-id {
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.shop-item-name {
  flex: 1;
  font-weight: 500;
}

.shop-item-price {
  color: var(--dachs-gold);
  font-weight: 600;
}

.shop-item-command {
  font-size: 0.8rem;
  color: var(--text-muted);
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

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-wrap: wrap;
  }

  .nav-bar {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 8px;
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
    flex-direction: column;
    align-items: stretch;
  }

  .logo {
    justify-content: center;
  }

  .logo .logo-text {
    display: inline;
  }

  .nav-bar {
    flex-wrap: wrap;
    justify-content: center;
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
}
`;
