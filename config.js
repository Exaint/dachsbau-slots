// ============================================
// DACHSBAU SLOTS - KONFIGURATION
// ============================================
// Diese Datei enthält alle benutzerdefinierten
// Einstellungen die regelmäßig angepasst werden.
// ============================================

// --------------------------------------------
// ADMIN LISTE
// --------------------------------------------
// Füge hier Twitch-Usernames hinzu die Admin-
// Befehle nutzen dürfen (lowercase).
// OPTIMIZED: Set for O(1) lookup instead of Array.includes()
// --------------------------------------------
const ADMINS = new Set([
  'exaint_',
  'frechhdachs'
]);

// --------------------------------------------
// CONFIG VALIDATION
// --------------------------------------------
// Validates configuration at module load time.
// Throws errors early if config is invalid.
// --------------------------------------------
function validateConfig() {
  const errors = [];

  // Validate ADMINS
  if (!(ADMINS instanceof Set)) {
    errors.push('ADMINS must be a Set');
  } else if (ADMINS.size === 0) {
    errors.push('ADMINS must contain at least one admin');
  } else {
    for (const admin of ADMINS) {
      if (typeof admin !== 'string' || admin.length < 3) {
        errors.push(`Invalid admin username: ${admin}`);
      }
      if (admin !== admin.toLowerCase()) {
        errors.push(`Admin username must be lowercase: ${admin}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

// Run validation at module load
validateConfig();

// --------------------------------------------
// EXPORTS
// --------------------------------------------
export {
  ADMINS
};
