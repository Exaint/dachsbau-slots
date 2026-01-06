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
// --------------------------------------------
const ADMINS = [
  'exaint_',
  'frechhdachs'
];

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
// EXPORTS
// --------------------------------------------
export {
  ADMINS,
  CUSTOM_MESSAGES
};
