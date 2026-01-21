/**
 * Message Constants - All text strings and messages
 * Centralized location for user-facing messages
 */

// ============================================================================
// Spin Messages
// ============================================================================

// Spin loss messages (random selection)
export const SPIN_LOSS_MESSAGES = ['Leider verloren! 😢', 'Nächstes Mal!', 'Fast! Versuch es nochmal!', 'Kein Glück diesmal...'];

// ============================================================================
// Error Messages - User facing
// ============================================================================

export const ERROR_MESSAGES = {
  // Security
  BLACKLISTED: 'Du bist vom Slots-Spiel ausgeschlossen.',
  FROZEN: 'Dein Account ist eingefroren. Kontaktiere einen Admin.',
  MAINTENANCE: 'Wartungsmodus aktiv! Nur Admins können spielen.',
  SELF_BANNED: 'Du hast dich selbst vom Spielen ausgeschlossen',

  // Balance
  INSUFFICIENT_BALANCE: (required, current) => `Nicht genug DachsTaler! Du brauchst ${required} (Aktuell: ${current}) 🦡`,
  MIN_BALANCE_REQUIRED: (min) => `Du brauchst mindestens ${min} DachsTaler!`,

  // Slots
  SLOT_MIN: (min) => `Minimum ist !slots ${min}! Verfügbar: 10, 20, 30, 50, 100, all 💡`,
  SLOT_MAX: 'Maximum ist !slots 100! Verfügbar: 10, 20, 30, 50, 100, all 💡',
  SLOT_NOT_EXISTS: (amount) => `!slots ${amount} existiert nicht! Verfügbar: 10, 20, 30, 50, 100, all`,
  SLOT_NOT_UNLOCKED: (amount, price) => `!slots ${amount} nicht freigeschaltet! Du musst es für ${price} DachsTaler im Shop kaufen!`,
  SPIN_ERROR: 'Fehler beim Spin.',

  // Cooldown
  COOLDOWN: (seconds) => `Cooldown: Noch ${seconds} Sekunden!`,

  // Admin
  NO_PERMISSION: 'Du hast keine Berechtigung für diesen Command!',
  TARGET_MISSING: 'Target fehlt!',
  TARGET_INVALID: 'Ungültiger Username!',
  AMOUNT_INVALID: 'Ungültiger Betrag!',

  // Transfer
  TRANSFER_SELF: 'Du kannst dir selbst nichts überweisen!',
  TRANSFER_MIN: (min) => `Minimum ist ${min} DachsTaler!`,
  TRANSFER_MAX: (max) => `Maximum ist ${max} DachsTaler pro Transfer!`,

  // Duel
  DUEL_SELF: 'Du kannst dich nicht selbst herausfordern!',
  DUEL_OPTED_OUT: (user) => `${user} möchte keine Duelle.`,
  DUEL_NO_PENDING: 'Du hast keine offenen Duel-Anfragen.',
  DUEL_COOLDOWN: (seconds) => `Du musst noch ${seconds} Sekunden warten bevor du wieder duellieren kannst.`,

  // Shop
  ITEM_NOT_FOUND: 'Item nicht gefunden!',
  ALREADY_OWNED: 'Du besitzt dieses Item bereits!',
  WEEKLY_LIMIT: 'Du hast das wöchentliche Limit für dieses Item erreicht!',
  REQUIRES_UNLOCK: (required) => `Du brauchst erst: ${required}`,

  // Auth
  NOT_LOGGED_IN: 'Nicht eingeloggt',
  INVALID_ORIGIN: 'Invalid origin'
};

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  DISCLAIMER_ACCEPTED: 'Disclaimer akzeptiert! Viel Spaß beim Spielen! 🦡🎰 Nutze !slots zum Spinnen!',
  DISCLAIMER_ALREADY: 'Du hast den Disclaimer bereits akzeptiert! Nutze einfach !slots zum Spielen 🎰',
  TRANSFER_COMPLETE: (amount, target, newBalance) => `${amount} DachsTaler an ${target} überwiesen! Dein neuer Kontostand: ${newBalance}`,
  PURCHASE_COMPLETE: (item) => `${item} erfolgreich gekauft!`,
  SELF_BAN_COMPLETE: 'Du wurdest vom Slots spielen ausgeschlossen.'
};

// ============================================================================
// Info Messages
// ============================================================================

export const INFO_MESSAGES = {
  WELCOME: 'Willkommen! Dachsbau Slots ist nur zur Unterhaltung - Hier geht es NICHT um Echtgeld!',
  DISCLAIMER: 'Dachsbau Slots dient nur zur Unterhaltung! Es werden keine Echtgeld-Beträge eingesetzt oder gewonnen.',
  LOW_BALANCE_DAILY: (amount) => `Niedriger Kontostand! Nutze !slots daily für +${amount} DachsTaler`
};

// Loss streak warnings
export const LOSS_MESSAGES = {
  10: ' 😔 10 Losses in Folge - Möchtest du vielleicht eine Pause einlegen?',
  11: ' 🦡 11 Losses - Der Dachs versteckt sich noch... vielleicht eine kurze Pause?',
  12: ' 🦡💤 12 Losses - Der Dachs macht ein Nickerchen... Pause könnte helfen!',
  13: ' 🦡🌙 13 Losses - Der Dachs träumt vom Gewinn... Morgen vielleicht?',
  14: ' 🦡🍂 14 Losses - Der Dachs sammelt Wintervorräte... Zeit für eine Pause!',
  15: ' 🦡❄️ 15 Losses - Der Dachs überwintert... Komm später wieder!',
  16: ' 🦡🏔️ 16 Losses - Der Dachs ist tief im Bau... Vielleicht morgen mehr Glück?',
  17: ' 🦡🌌 17 Losses - Der Dachs philosophiert über das Leben... Pause empfohlen!',
  18: ' 🦡📚 18 Losses - Der Dachs liest ein Buch... Du auch? Pause! 📖',
  19: ' 🦡🎮 19 Losses - Der Dachs zockt was anderes... Du auch? 🎮',
  20: ' 🦡☕ 20 Losses - Der Dachs trinkt Kaffee und entspannt... Pause seriously! ☕'
};

export const ROTATING_LOSS_MESSAGES = [
  ' 🦡🛌 Der Dachs schläft fest... Lass ihn ruhen! 😴',
  ' 🦡🧘 Der Dachs meditiert... Innere Ruhe finden! 🧘‍♂️',
  ' 🦡🎨 Der Dachs malt ein Bild... Kreative Pause! 🎨',
  ' 🦡🏃 Der Dachs macht Sport... Beweg dich auch! 🏃',
  ' 🦡🌳 Der Dachs genießt die Natur... Geh raus! 🌳'
];
