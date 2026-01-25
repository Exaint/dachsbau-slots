/**
 * Utility functions for HTML page generation
 */

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: unknown): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format numbers with thousand separators (German format)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('de-DE').format(num);
}
