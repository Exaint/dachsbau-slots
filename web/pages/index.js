/**
 * Web Pages Module Index
 *
 * This module provides shared utilities, constants, and template functions
 * for the HTML page generators.
 *
 * ARCHITECTURE:
 * - utils.js - escapeHtml, formatNumber
 * - constants.js - CATEGORY_ICONS, ROLE_BADGES, PRESTIGE_RANK_NAMES
 * - template.js - baseTemplate, htmlResponse (with all client-side JS)
 *
 * The main page renderers remain in ../pages.js to avoid excessive
 * file fragmentation. They import these shared modules.
 */

// Re-export utilities
export { escapeHtml, formatNumber } from './utils.js';

// Re-export constants
export {
  CATEGORY_ICONS,
  CATEGORY_NAMES,
  PRESTIGE_RANK_NAMES,
  ROLE_BADGES
} from './constants.js';

// Re-export template functions
export { baseTemplate, htmlResponse } from './template.js';
