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
// CUSTOM WIN/LOSS MESSAGES
// --------------------------------------------
// Spieler die "Custom Win Message" im Shop
// gekauft haben, können hier ihre eigenen
// Nachrichten bekommen.
//
// Format:
//   'username': {
//     win: 'Nachricht bei Gewinn',
//     loss: 'Nachricht bei Verlust'
//   }
//
// Platzhalter:
//   {username} - Spielername
//   {amount}   - Gewinn/Verlust Betrag
//   {balance}  - Neuer Kontostand
//   {grid}     - Slot-Ergebnis (Emojis)
//
// Beispiel:
//   'coolerusername': {
//     win: '🎉 {username} räumt ab! +{amount} DT!',
//     loss: '😢 {username} hat {amount} DT verloren...'
//   }
// --------------------------------------------
const CUSTOM_MESSAGES = {
  // ---- EXAINT_ ----
  // 'exaint_': {
  //   win: '🦡 Der Oberdachs {username} gräbt +{amount} DT aus seinem Bau! Der Bau wächst auf {balance} DT!',
  //   loss: '🕳️ {username} ist in ein fremdes Dachsloch gefallen... -{amount} DT futsch!'
  // },

  // ---- FRECHHDACHS ----
  // 'frechhdachs': {
  //   win: '😏 Der freche Dachs schnappt sich +{amount} DT! Typisch {username}... jetzt {balance} DT im Bau!',
  //   loss: '🦡💨 {username} war zu frech - der Förster hat {amount} DT konfisziert!'
  // }
};

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

  // Validate CUSTOM_MESSAGES
  if (typeof CUSTOM_MESSAGES !== 'object' || CUSTOM_MESSAGES === null) {
    errors.push('CUSTOM_MESSAGES must be an object');
  } else {
    for (const [username, messages] of Object.entries(CUSTOM_MESSAGES)) {
      if (username !== username.toLowerCase()) {
        errors.push(`Custom message username must be lowercase: ${username}`);
      }
      if (typeof messages !== 'object' || messages === null) {
        errors.push(`Custom messages for ${username} must be an object`);
        continue;
      }
      if (messages.win && typeof messages.win !== 'string') {
        errors.push(`Custom win message for ${username} must be a string`);
      }
      if (messages.loss && typeof messages.loss !== 'string') {
        errors.push(`Custom loss message for ${username} must be a string`);
      }
      if (!messages.win && !messages.loss) {
        errors.push(`Custom messages for ${username} must have at least one of: win, loss`);
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
  ADMINS,
  CUSTOM_MESSAGES
};
