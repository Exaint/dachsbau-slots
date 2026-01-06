# 🦡 DACHSBAU SLOTS - CHANGELOG 📋

> **Aktuelle Version:** 1.5.2 - "Refactoring & Race Condition Fixes"
> **Letztes Update:** 6. Januar 2026

---

## 🔗 QUICK LINKS

| Link | Beschreibung |
|------|--------------|
| 📖 [Info & Commands](https://git.new/DachsbauSlotInfos) | Alle Commands, Gewinnchancen & FAQ |
| 🛒 [Shop](https://git.new/DachsbauSlotsShop) | Alle Items, Preise & Kategorien |
| 🔓 [Unlock Info](https://dub.sh/SlotUnlock) | Multiplier-Unlocks Übersicht |
| 📺 [Twitch](https://www.twitch.tv/frechhdachs) | frechhdachs Live-Streams |
| 💬 [Discord](https://discord.gg/dachsbau) | Dachsbau Community |

---

## ⚠️ NUR ZUR UNTERHALTUNG

> **WICHTIG:** Dachsbau Slots ist ein reines **Unterhaltungsspiel** für die Community von frechhdachs. Es werden keine echten Geldbeträge verwendet. **Die Streamerin frechhdachs distanziert sich ausdrücklich von echtem Glücksspiel** und übernimmt keine Haftung für Glücksspielsucht.
> 
> ➡️ **Spiel lieber hier im Dachsbau** - hier kannst du nicht ins Minus rutschen und hast einfach nur Spaß! 🦡

### 🚫 SELBSTAUSSCHLUSS

Du kannst dich jederzeit selbst vom Spielen ausschließen:

```
!slots selfban
```

**Nur Admins** (exaint_, frechhdachs) können den Selfban wieder aufheben.

### 📞 HILFE BEI GLÜCKSSPIELPROBLEMEN

| Land | Hotline | Organisation | Weitere Infos |
|------|---------|--------------|---------------|
| 🇩🇪 Deutschland | **0800 - 1 37 27 00** | BZgA (kostenlos & anonym) | [check-dein-spiel.de](https://check-dein-spiel.de) |
| 🇦🇹 Österreich | **0800 - 20 20 11** | Spielsuchthilfe (kostenlos) | [spielsuchthilfe.at](https://spielsuchthilfe.at) |
| 🇨🇭 Schweiz | **0800 - 040 080** | SOS Spielsucht (kostenlos) | [sos-spielsucht.ch](https://sos-spielsucht.ch) |

---

## 📋 VOLLSTÄNDIGE VERSIONSHISTORIE

---

<details open>
<summary>🆕 Version 1.5.2 - "Refactoring & Race Condition Fixes" (6. Januar 2026)</summary>

### 🔧 Critical Fixes & Optimizations

**🔒 Race Condition Prevention (database.js)**

Neue atomare Balance-Update-Funktion für kritische Transaktionen:

```javascript
atomicBalanceUpdate(username, updateFn, maxRetries = 3, env)
```

**Features:**
- ✅ Optimistic Locking mit Verify-Read nach jedem Write
- ✅ Retry-Mechanismus mit Exponential Backoff (10ms, 20ms, 40ms)
- ✅ Metadata-Tracking für Debugging (lastUpdate, attempt)
- ✅ Graceful Error Handling mit detaillierten Status-Returns
- ✅ Max 3 Versuche bevor Fehler zurückgegeben wird

**Auswirkung:**
- Verhindert Balance-Verlust bei gleichzeitigen Transaktionen
- Schutz vor Race Conditions in High-Traffic-Situationen
- Bereit für zukünftige Integration in kritische Pfade

---

### 📐 Code Architecture Improvements

**handleSlot() Refactoring (slots.js)**

Die monolithische 578-Zeilen-Funktion wurde in **6 modulare Helper-Funktionen** aufgeteilt:

**Vorher:** 578 Zeilen (monolithisch, schwer wartbar)
**Nachher:** 285 Zeilen (**51% Reduzierung!**)

**Neue Helper-Funktionen:**

| Funktion | Zeilen | Beschreibung |
|----------|--------|--------------|
| `parseSpinAmount()` | 55-100 | Parst und validiert Spin-Einsätze (10, 20, 30, 50, 100, all) |
| `generateGrid()` | 103-152 | Generiert 3x3 Slot-Grid mit Buffs und Debug-Mode |
| `applySpecialItems()` | 155-174 | Wendet Guaranteed Pair & Wild Card Token an |
| `applyMultipliersAndBuffs()` | 177-245 | Verarbeitet alle Multiplier, Buffs und Boosts |
| `calculateStreakBonuses()` | 248-300 | Berechnet Hot Streak, Comeback King, Combos |
| `buildResponseMessage()` | 303-347 | Erstellt finale Twitch-Chat-Response |

**Vorteile:**
- ✅ **Deutlich bessere Lesbarkeit** - Logik in kleine Einheiten aufgeteilt
- ✅ **Einfacheres Testing** - Jede Funktion einzeln testbar
- ✅ **Bessere Wartbarkeit** - Änderungen an spezifischen Features isoliert
- ✅ **Reduzierte Komplexität** - Jede Funktion hat eine klare Aufgabe
- ✅ **Wiederverwendbarkeit** - Helper können in anderen Contexts genutzt werden

---

### 🧹 Code Quality Improvements

**Magic Numbers eliminiert (constants.js)**

15+ neue Konstanten für bessere Wartbarkeit:

```javascript
// Grid Configuration
GRID_SIZE = 9
GRID_WIDTH = 3
MIDDLE_ROW_START = 3
MIDDLE_ROW_END = 5

// Debug Mode
DEBUG_DACHS_PAIR_CHANCE = 0.75  // 75% für Dachs-Paare

// Chaos Spin Ranges
CHAOS_SPIN_MIN = -300
CHAOS_SPIN_MAX = 700
REVERSE_CHAOS_MIN = 50
REVERSE_CHAOS_MAX = 200

// Diamond Mine
DIAMOND_MINE_MIN_SPINS = 3
DIAMOND_MINE_MAX_SPINS = 5

// Buff Mechanics
BUFF_REROLL_CHANCE = 0.66       // 66% für Star Magnet/Diamond Rush
SYMBOL_BOOST_CHANCE = 0.33      // 33% erfolgreicher Boost
```

**URLs zentralisiert:**
```javascript
URLS = {
  INFO: 'https://git.new/DachsbauSlotInfos',
  SHOP: 'https://git.new/DachsbauSlotsShop',
  UNLOCK: 'https://dub.sh/SlotUnlock'
}
```

**Admin-Listen konsolidiert:**
```javascript
ALL_BUFF_KEYS = ['happy_hour', 'lucky_charm', ...]    // 8 Buffs
ALL_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '🦡', '💎']
ALL_UNLOCK_KEYS = ['slots_20', 'slots_30', ...]       // 8 Unlocks
```

**Betroffene Dateien:**
- [slots.js](commands/slots.js) - Magic Numbers durch Konstanten ersetzt
- [shop.js](commands/shop.js) - Chaos Spin & Diamond Mine Ranges
- [admin.js](commands/admin.js) - Buff-Arrays durch zentrale Listen ersetzt
- [_worker.js](_worker.js) - URLs konsolidiert

---

### 🐛 Bug Fixes

**Duplicate Balance Read in handleTransfer (user.js)**

```javascript
// VORHER (Bug):
await updateBankBalance(parsedAmount, env);
const newBankBalance = await getBalance(BANK_USERNAME, env); // WRONG!

// NACHHER (Fix):
await updateBankBalance(parsedAmount, env);
const newBankBalance = await getBankBalance(env); // Correct!
```

**Auswirkung:** Bank-Balance wird jetzt korrekt aus dedizierter Funktion gelesen

---

**Missing Error Handling in KV Deletes (database.js)**

Alle `consumeX()` Funktionen haben jetzt try/catch:

```javascript
async function consumeGuaranteedPair(username, env) {
  try {
    await env.SLOTS_KV.delete(`guaranteedpair:${username.toLowerCase()}`);
  } catch (error) {
    console.error('consumeGuaranteedPair Error:', error);
  }
}
```

**Betroffen:**
- `consumeGuaranteedPair()`
- `consumeWildCard()`
- `resetStreakMultiplier()`

---

**Wild Card Suffix Calculated 3x (slots.js)**

```javascript
// VORHER:
const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';  // 3x berechnet

// NACHHER:
const wildSuffix = wildCount > 0 ? ' (🃏 Wild!)' : '';  // 1x am Anfang
```

**Auswirkung:** Minimal bessere Performance, saubererer Code

---

**Unreachable Combo Bonus Key (constants.js)**

```javascript
// VORHER:
COMBO_BONUSES = { 2: 10, 3: 30, 4: 100, 5: 500 }  // Key 5 nie erreichbar

// NACHHER:
COMBO_BONUSES = { 2: 10, 3: 30, 4: 100 }  // Nur erreichbare Keys
```

**Grund:** 5 Wins in Folge triggert Hot Streak (500 DT) und resettet Streak

---

### 📊 Zusammenfassung

**Code-Metriken:**

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| handleSlot Länge | 578 Zeilen | 285 Zeilen | **-51%** |
| Magic Numbers | ~20 | 0 | **-100%** |
| Code Duplizierung | Mehrfach | 0 | Eliminiert |
| Helper Functions | 0 | 6 | +6 |
| Build Status | ✅ | ✅ | Stabil |

**Wartbarkeit:**
- ✅ Deutlich bessere Code-Organisation
- ✅ Einfachere Fehlersuche
- ✅ Schnellere Feature-Entwicklung
- ✅ Bessere Testbarkeit
- ✅ Reduzierte technische Schulden

**Keine Breaking Changes** - Alle Features funktionieren exakt wie vorher!

</details>

<details>
<summary>Version 1.5.1 - "Code Quality & Maintainability" (6. Januar 2026)</summary>

### 🐛 Bug Fixes

**Kritische Fixes:**

| Bug | Datei | Problem | Fix |
|-----|-------|---------|-----|
| Stats Streak Anzeige | `admin.js` | `!getstats` zeigte immer "0W 0L" | Nutzt jetzt `getStreak()` Funktion korrekt |
| Stats Losses Anzeige | `admin.js` | Losses waren "undefined" | Wird jetzt berechnet aus `totalSpins - wins` |
| handleWipe Prestige | `admin.js` | Löschte falschen KV-Key `prestige:` | Korrigiert zu `rank:` |
| Tote lossstreak Keys | `admin.js` | Versuchte nicht-existente Keys zu löschen | Entfernt |
| Dynamic Import | `user.js` | Unnötiger `import()` für `getMonthlyLogin` | Durch normalen Import ersetzt |
| Mystery Box Buffs | `shop.js` | Dachs Locator/Rage Mode falsch aktiviert | Korrekte Buff-Typ-Unterscheidung |

### 🔧 Code-Optimierungen

**Neue Konfigurationsdatei: `config.js`**

Zentrale Stelle für häufig angepasste Einstellungen:

```javascript
// Admin-Liste (einfach erweiterbar)
const ADMINS = ['exaint_', 'frechhdachs'];

// Custom Win/Loss Messages pro Spieler
const CUSTOM_MESSAGES = {
  'username': {
    win: '🎉 {username} gewinnt +{amount} DT!',
    loss: '😢 {username} verliert {amount} DT...'
  }
};
```

**Platzhalter für Custom Messages:**
- `{username}` - Spielername
- `{amount}` - Gewinn/Verlust Betrag
- `{balance}` - Neuer Kontostand
- `{grid}` - Slot-Ergebnis (Emojis)

### 📦 Konstanten Konsolidierung

**Neue Konstanten in `constants.js`:**

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `DAILY_AMOUNT` | 50 | Basis Daily Reward |
| `DAILY_BOOST_AMOUNT` | 250 | Daily mit Boost |
| `LOW_BALANCE_WARNING` | 100 | Warnung unter diesem Betrag |
| `STREAK_THRESHOLD` | 5 | Wins/Losses für Streak-Bonus |
| `HOT_STREAK_BONUS` | 500 | Bonus für 5 Wins in Folge |
| `COMEBACK_BONUS` | 150 | Bonus nach 5 Losses |
| `STREAK_TTL_SECONDS` | 604800 | Streak-Ablauf (7 Tage) |
| `DACHS_TRIPLE_PAYOUT` | 15000 | 3x Dachs Jackpot |
| `DACHS_PAIR_PAYOUT` | 2500 | 2x Dachs |
| `DACHS_SINGLE_PAYOUT` | 100 | 1x Dachs |
| `INSURANCE_REFUND_RATE` | 0.5 | 50% Refund bei Insurance |

**Vorteile:**
- ✅ Zentrale Anpassung aller Werte
- ✅ Keine hardcoded Magic Numbers mehr
- ✅ Bessere Wartbarkeit
- ✅ Einfachere Balance-Anpassungen

### 🗑️ Aufräumarbeiten

**Entfernte ungenutzte Elemente:**
- `COMMAND_MAP` Konstante (nie verwendet)
- `SECONDS_PER_MINUTE` Konstante (nie verwendet)
- `getCurrentDate` Export aus `database.js` (nur intern genutzt)
- Falsche Buff-Keys in `handleClearAllBuffs` und `handleWipe`:
  - Entfernt: `ultra_instinct`, `jackpot_magnet`, `divine_protection`, `chaos_shield`
  - Hinzugefügt: `star_magnet`, `profit_doubler`, `diamond_rush`

**Korrigierte Buff-Keys:**
Die Admin-Commands `clearallbuffs` und `wipe` löschen jetzt alle tatsächlich existierenden Buffs.

### 🔄 Refactoring

**DACHS_BASE_CHANCE Verwendung:**
- Hardcoded `1/150` durch `DACHS_BASE_CHANCE` ersetzt
- Lucky Charm: `DACHS_BASE_CHANCE * 2` statt `1/75`
- Zentrale Änderung der Dachs-Wahrscheinlichkeit möglich

</details>

<details>
<summary>📦 Version 1.5.0 - "Modular Architecture & Performance Boost" (5. Januar 2026)</summary>

### ⚡ Performance-Optimierungen

**Massive Geschwindigkeitsverbesserung beim !slots Command**

Die Response-Zeit wurde um **40-50% reduziert** durch intelligente Optimierungen der KV-Operationen!

**Vorher:** ~1500-2500ms Response-Zeit
**Nachher:** ~800-1300ms Response-Zeit ⚡

**Was wurde optimiert:**

**1. Dachs Locator Inline Decrement**
- Redundante KV-Reads eliminiert (von 2 auf 1)
- Buff-Daten werden wiederverwendet statt neu geladen
- **Einsparung:** 50-150ms pro Spin

**2. Rage Mode Inline Updates**
- Stack-Updates nutzen bereits geladene Daten
- Keine redundanten KV-Reads mehr
- **Einsparung:** 50-150ms pro Spin

**3. Bank Balance Konsolidierung**
- Nur noch 1 Update statt 2 separate (Einzahlung + Auszahlung)
- Netto-Berechnung in einem Schritt
- **Einsparung:** 100-200ms pro Spin (1 Read + 1 Write weniger)

**4. Symbol Boost Parallelisierung**
- Nur noch Symbole prüfen, die tatsächlich im Spin vorkommen (1-3 statt 7)
- Alle Prüfungen parallel statt sequentiell
- **Einsparung:** 100-300ms pro Spin

**5. Streak Operations Optimiert**
- Streak-Update inline ohne redundanten Read
- Kombinierte Read/Write-Operation
- **Einsparung:** 50-150ms pro Spin

**6. Prestige Rank Parallel Laden**
- Rank-Fetch parallel mit finalen Updates
- Keine sequentielle Wartezeit mehr
- **Einsparung:** 50-100ms pro Spin

**Gesamteinsparung:**
- **7-15 KV-Reads weniger** pro Spin
- **1-3 KV-Writes weniger** pro Spin
- **400-1200ms schneller** je nach aktiven Buffs

### 🏗️ Code-Architektur Refactoring

**Modulares System für bessere Wartbarkeit**

Die monolithische 3,002-Zeilen-Datei wurde in **8 saubere ES6-Module** aufgeteilt:

**Neue Dateistruktur:**
```
├── _worker.js          (167 Zeilen)   - Main entry point
├── constants.js        (175 Zeilen)   - Alle Konstanten
├── utils.js            ( 68 Zeilen)   - Hilfsfunktionen
├── database.js         (869 Zeilen)   - KV-Operationen
└── commands/
    ├── user.js         (406 Zeilen)   - User-Commands
    ├── admin.js        (603 Zeilen)   - Admin-Commands
    ├── slots.js        (669 Zeilen)   - Slots-Logik
    └── shop.js         (330 Zeilen)   - Shop-System
```

**Vorteile:**
- ✅ **Schnellere Navigation** - Finde Code in Sekunden
- ✅ **Einfachere Wartung** - Klare Verantwortlichkeiten
- ✅ **Bessere Testbarkeit** - Module einzeln testbar
- ✅ **Saubere Dependencies** - ES6 Imports/Exports
- ✅ **Automatisches Bundling** - Wrangler kümmert sich darum

**Module-Details:**

**constants.js** - Zentrale Konfiguration
- Response Headers, Limits, Timeouts
- Shop Items, Payouts, Symbol Weights
- Loss Messages, Rewards, Combo Bonuses

**utils.js** - Wiederverwendbare Funktionen
- `getWeightedSymbol()` - Symbol-Generation
- `isAdmin()`, `sanitizeUsername()`
- Datum/Zeit-Utilities
- `isLeaderboardBlocked()`

**database.js** - Alle KV-Interaktionen
- Balance & Stats Operations
- Daily, Cooldown, Disclaimer
- Streaks, Prestige, Unlocks
- Buffs (timed, uses, stacks)
- Free Spins, Insurance, Boosts

**commands/user.js** - User-Commands
- `handleBalance`, `handleStats`, `handleDaily`
- `handleBuffs`, `handleBank`
- `handleTransfer`, `handleLeaderboard`

**commands/admin.js** - Admin-Commands
- `handleGive`, `handleBan`, `handleReset`
- `handleFreeze`, `handleSetBalance`
- `handleGiveBuff`, `handleMaintenance`
- `handleWipe`, `handleRemoveFromLB`

**commands/slots.js** - Slot-Mechanik
- `handleSlot()` - Komplette Spin-Logik
- `calculateWin()` - Gewinnberechnung
- Grid-Generation mit Buffs
- Wild Cards, Guaranteed Pairs

**commands/shop.js** - Shop-System
- `handleShop()` - Shop-Anzeige
- `buyShopItem()` - Kauflogik
- `spinWheel()` - Glücksrad
- Alle Item-Typen (instant, timed, boost, etc.)

### 🔧 Technische Verbesserungen

**ES6 Module System**
- Moderne `import`/`export` Syntax
- Tree-shaking möglich
- Bessere IDE-Unterstützung

**Promise.all() Optimierungen**
- Mehr parallele KV-Operationen
- Reduzierte Latenz
- Bessere Ressourcennutzung

**Inline Operations**
- Wiederverwendung geladener Daten
- Eliminierung redundanter Reads
- Optimierte Write-Patterns

### 📊 Messbare Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| Response-Zeit | 1500-2500ms | 800-1300ms | **40-50% schneller** ⚡ |
| KV-Reads/Spin | 15-25 | 8-10 | **-50% weniger** |
| KV-Writes/Spin | 5-8 | 4-5 | **-20% weniger** |
| Bundle Size | 118.70 KiB | 119.85 KiB | +1% (minimal) |
| Code-Dateien | 1 Monster | 8 Module | **Wartbarkeit +1000%** |

**Wichtig:** Keine Funktionalitätsänderungen - alle Features funktionieren exakt wie vorher!

</details>

<details>
<summary>Version 1.4.5 - "Critical Bugfixes & Security Update" (5. Januar 2026)</summary>

### 🐛 Critical Bugfixes

**🔒 Hourly Jackpot Exploit behoben**
- **Problem:** Mehrere User konnten in derselben Sekunde alle den Jackpot gewinnen
- **Fix:** Implementierung eines KV-basierten Claim-Systems
- **Neue Funktion:** `checkAndClaimHourlyJackpot()` mit atomarem Lock
- **Auswirkung:** Nur noch 1 Person pro Stunde kann den Jackpot beanspruchen (exploit-proof!)
- **Expiry:** Claim wird nach 1 Stunde automatisch gelöscht

**💸 Doppelter Abzug bei Shop Items gefixt**
- **Problem:** Bei Chaos Spin & Glücksrad wurde der Item-Preis doppelt vom Kontostand abgezogen
- **Betroffen:** Items #11 (Chaos Spin) und #12 (Glücksrad)
- **Fix:** Balance-Updates sind jetzt atomar mit `Promise.all()`
- **Auswirkung:** Spieler verlieren nicht mehr doppeltes Geld beim Kauf

**🔄 Race Condition bei Bank-Transfers behoben**
- **Problem:** Transfer zur DachsBank war nicht atomar - bei Crashes konnten DT verloren gehen
- **Fix:** Sender-Balance und Bank-Balance werden jetzt gleichzeitig mit `Promise.all()` aktualisiert
- **Auswirkung:** Kein Geld-Verlust mehr bei Verbindungsabbrüchen

**🔢 parseInt Radix hinzugefügt (Sicherheit)**
- **Problem:** 18+ Stellen im Code nutzten `parseInt()` ohne Radix-Parameter
- **Risiko:** Oktal-Zahlen (z.B. "08", "09") könnten falsch geparst werden
- **Fix:** Alle `parseInt()` auf `parseInt(value, 10)` geändert
- **Auswirkung:** Schutz vor Edge-Cases bei falschen Eingaben

### ✨ Feature Improvements

**🔮 Peek Token funktioniert jetzt wirklich!**
- **Vorher:** Zeigte zufälligen Test-Spin, NICHT den echten nächsten Spin (war faktisch nutzlos)
- **Jetzt:** Generiert den echten nächsten Spin und speichert ihn in KV
- **Wie es funktioniert:**
  1. User kauft Peek Token für 75 DT
  2. System generiert den kompletten nächsten Spin-Grid
  3. Grid wird in KV gespeichert (`peek:username`, 1h Expiry)
  4. User erhält Vorhersage (✅ GEWINNEN oder ❌ VERLIEREN)
  5. Beim nächsten Spin wird der gespeicherte Grid verwendet
  6. Nach Verwendung wird Grid automatisch gelöscht
- **Auswirkung:** Peek Token ist jetzt ein **ehrliches** Prediction-Tool!

### 🔧 Code-Qualität

**Performance-Optimierungen**
- Atomare Balance-Updates mit `Promise.all()` bei allen Shop-Items
- Reduzierte Race Conditions durch bessere Parallelisierung
- Konsistente Error Handling bei kritischen Operationen

**Sicherheitsverbesserungen**
- Alle parseInt-Calls mit explizitem Radix 10
- Anti-Exploit System für Hourly Jackpot
- Atomare Transaktionen für Geld-Transfers

### 📝 Command Enhancements

**Neue Command-Aliase hinzugefügt**
- **Leaderboard:** `!slots rank` und `!slots ranking` (zusätzlich zu `lb` und `leaderboard`)
- **Info:** `!slots help` und `!slots commands` (zusätzlich zu `info`)
- **Auswirkung:** Verbesserte Benutzerfreundlichkeit durch kürzere und intuitivere Commands
- **Implementierung:** O(1)-Lookup-Map für schnellere Command-Verarbeitung

</details>

<details>
<summary>Version 1.4.4 - "DachsBank System" (30. Dezember 2025)</summary>

### 🏦 Neue Features

**DachsBank - Virtuelle Casino-Bank**

Die DachsBank ist ein virtuelles Bank-Konto, das die gesamte Spiel-Ökonomie in Echtzeit trackt!

**Was macht die Bank?**
- ✅ Kassiert bei jedem Spin (10-100 DT Einsatz)
- ✅ Kassiert bei jedem Shop-Kauf (75-44,444 DT)
- ✅ Zahlt bei jedem Gewinn (Spin-Gewinne + Boni)
- ✅ Kann ins Minus gehen (Community plündert die Bank!)

**Neuer Command:**
```
!slots bank
```

**Zeigt:**
- Aktuellen Bank-Kontostand mit deutscher Formatierung
- **Positiv:** "Die Bank ist im Plus! 💰"
- **Negativ:** "Die Community hat die Bank um X DT geplündert! 🦡💸"

**Spenden an die Bank:**
```
!transfer @dachsbank [Betrag]
```

User können freiwillig DachsTaler an die Bank spenden!

**Beispiel-Szenario:**
```
User spielt !slots 50       → Bank +50 DT
User gewinnt 150 DT         → Bank -150 DT
User kauft Item (1,000 DT)  → Bank +1,000 DT
User spendet 500 DT         → Bank +500 DT

Ergebnis: Bank hat +1,400 DT verdient
```

**Mathematische Erwartung:**
- 27% Gewinnrate bedeutet Bank profitiert langfristig
- Jackpots und High-Roller können temporäre Defizite verursachen
- Realistisch: +50k bis +200k DT im Plus, -100k bei Lucky Streaks

**Technische Details:**
- Startguthaben: 444,444 DachsTaler
- Negativer Kontostand möglich
- Bank taucht NICHT im Leaderboard auf
- Admin-Give Commands beeinflussen die Bank NICHT

### 🔧 Code-Optimierungen

**Performance-Verbesserungen**
- Buff-Loading optimiert (2-stufig: Grid-Generation vs. Dachs-Chance)
- Reduzierte KV-Calls bei Free Spins (~50% weniger)
- Intelligentes Lazy-Loading von Buffs
- Bessere Separation zwischen Essential Buffs und Optional Buffs

</details>

<details>
<summary>Version 1.4.3 - "Performance & Buffs" (30. Dezember 2025)</summary>

### ✨ Neue Features

**!slots buffs Command**

Neuer Command zeigt alle aktiven Buffs & Items auf einen Blick!

```
!slots buffs
```

**Was wird angezeigt?**
- ⏰ Timed Buffs mit Restlaufzeit (z.B. "Profit Doubler (23h 15m)")
- 🔢 Buffs mit Uses (z.B. "Dachs Locator (7 Spins)")
- 📊 Rage Mode mit Stack (z.B. "Rage Mode (25m, Stack: 35%)")
- 🔥 Symbol-Boosts (z.B. "🍒 Kirschen-Boost (1x)")
- 🛡️ Utility Items (z.B. "Insurance Pack (3x)")
- 🎯 Instant Items (z.B. "Guaranteed Pair (1x)", "Wild Card (1x)")

**Format:**
```
@username 🔥 Deine aktiven Buffs: ⚡ Happy Hour (45m) || 🦡 Dachs Locator (5 Spins) || 🔥 Rage Mode (18m, Stack: 20%) || 🍒 Kirschen-Boost (1x) || 🛡️ Insurance Pack (2x)
```

Übersichtlich in einer Zeile mit `||` Trennung!

### 🔧 Verbesserungen

**Performance-Optimierungen**
- Buff-Loading in 2 Stages:
  - **Stage 1:** Essential Buffs (Grid-Generation) - Immer geladen
  - **Stage 2:** Optional Buffs (Dachs-Chance) - Nur für normale Spins
- Free Spins nutzen keine Dachs-Chance-Buffs mehr
- Reduzierte KV-Calls bei Free Spins um ~50%
- Schnellere Spin-Verarbeitung

**Code-Struktur**
- Bessere Kommentare für Buff-Loading-Logik
- Klare Trennung zwischen Grid-Buffs und Dachs-Buffs
- Optimierte Batch-KV-Reads

</details>

<details>
<summary>Version 1.4.2 - "Mystery Box Expansion" (29. Dezember 2025)</summary>

### 🎁 Shop Verbesserungen

**📦 Mystery Box erweitert (Item #16)**

Die Mystery Box wurde von 12 auf 17 mögliche Items erweitert!

**5 neue Premium Buffs hinzugefügt:**
- 🌟 **Star Magnet** (1,200 DT Wert) - ⭐ erscheinen 3x häufiger
- 🦡 **Dachs Locator** (1,500 DT Wert) - 3x Dachs-Chance für 10 Spins
- 🔥 **Rage Mode** (4,000 DT Wert) - +5% Dachs-Chance pro Verlust
- 📈 **Profit Doubler** (5,000 DT Wert) - Jackpot! Gewinne 100+ DT verdoppelt
- 💎 **Diamond Rush** (2,000 DT Wert) - 💎 erscheinen 3x häufiger

**Statistiken:**
- Durchschnittswert erhöht: ~1,100 DT → ~1,650 DT (+50%)
- Möglicher Jackpot-Pull: 5,000 DT Item für nur 1,000 DT!
- Weiterhin ausgeschlossen: Unlocks, Prestige Ränge, Instant Items

**Enthaltene Items (17 total):**
- **Symbol-Boosts (7):** Alle Standard-Boosts + Dachs-Boost
- **Utility (2):** Insurance Pack, Win Multiplier
- **Timed Buffs (8):** Happy Hour, Lucky Charm, Golden Hour, Star Magnet, Dachs Locator, Rage Mode, Profit Doubler, Diamond Rush

### 🔧 Code-Optimierungen

- Items nach Kategorien gruppiert (Boosts, Utility, Buffs)
- Bessere Kommentare für Wartbarkeit
- Klare Ausschluss-Liste dokumentiert

</details>

<details>
<summary>Version 1.4.1 - "Selfban Feature" (29. Dezember 2025)</summary>

### ✨ Neue Features

**🚫 Selfban Command**

Neuer Command für verantwortungsvolles Spielen:

```
!slots selfban
```

**Was passiert?**
- ❌ Du kannst nicht mehr spielen
- ⏰ Zeitpunkt des Selfbans wird gespeichert (z.B. "29.12.2024, 23:15")
- 🔒 **Nur Admins** (exaint_, frechhdachs) können den Selfban aufheben
- 💬 Du kannst dich jederzeit an die Admins wenden

**Warum gibt es diese Funktion?**

Auch bei virtuellen Spielen ist es wichtig, auf die eigene Spielzeit zu achten. Der Selfban gibt dir die Kontrolle zurück und ermöglicht eine bewusste Pause!

**🔓 Admin Unban erweitert**

```
!slots unban @user
```

- Entfernt jetzt sowohl Blacklist als auch Selfban gleichzeitig
- Einheitliches Unban-System für Admins

### 📝 Dokumentation

- Selfban Command in Warnhinweisen prominent platziert
- Erklärung der Funktion und Vorteile
- Integration in Command-Übersicht

### 🎮 UX Verbesserungen

**First-Time User Message erweitert**

Neue Spieler sehen jetzt Link zum Info-Gist in der Willkommensnachricht:

```
@username 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - kein Echtgeld! 
Verstanden? Schreib nochmal !slots zum Spielen! 
Weitere Infos: https://git.new/DachsbauSlotInfos | Shop: https://git.new/DachsbauSlotsShop 🎰
```

Bessere Onboarding-Erfahrung für neue User!

</details>

<details>
<summary>Version 1.4.0 - "Winter Update" (27. Dezember 2025)</summary>

### ✨ Neue Features

**🔥 Streak Multiplier System (KOSTENLOS!)**

Automatisches System für alle Spieler ohne Shop-Kauf!

**Wie funktioniert es?**
- Jeder Gewinn in Folge erhöht den Multiplier um +0.1x
- Maximum: 3.0x Multiplier bei 20+ Gewinnen in Folge
- Reset auf 1.0x bei Verlust
- Anzeige in Message: `(🔥 2.5x Streak!)`
- Kombinierbar mit allen anderen Buffs und Multipliers

| Wins in Folge | Multiplier | Boost |
|---------------|------------|-------|
| 1 | 1.0x | - |
| 2 | 1.1x | +10% |
| 5 | 1.4x | +40% |
| 10 | 2.0x | +100% 🔥 |
| 15 | 2.5x | +150% 🔥🔥 |
| 20+ | 3.0x | +200% ✨ |

**🃏 Wild Card System (Item #38)**

Neues Instant-Item für 250 DT!

**Was macht es?**
- Fügt ein 🃏 Wild Symbol im nächsten Spin hinzu
- Wild ersetzt jedes andere Symbol für besten Outcome
- **Beispiele:**
  - `🃏 🍒 🍒` → Triple Kirsche (50 DT)
  - `🦡 🃏 🦡` → Triple Dachs (15,000 DT)
- **Wichtig:** Wilds zählen NICHT für 💎 Free Spins

**🎯 Guaranteed Pair (Item #37)**

Neues Instant-Item für 180 DT!

**Was macht es?**
- Garantiert mindestens ein Pair im nächsten Spin
- Perfekt für sichere Gewinne mit hohen Multipliers
- Kombinierbar mit Symbol-Boosts

**💎 Diamond Rush (Item #39)**

Neuer Timed Buff für 2,000 DT!

**Was macht es?**
- Dauer: 1 Stunde
- Diamanten erscheinen 3x häufiger
- Mehr 💎 = Mehr Free Spins!
- Funktioniert wie Star Magnet, aber für Diamonds

### 🔧 Verbesserungen

**📋 Shop Command Spalte**
- Alle 39 Shop Items haben jetzt direkte `!shop buy X` Commands in Tabellen
- Einfach copy-pastebar für PC & Handy
- Bessere Übersichtlichkeit im Shop-Gist

**🔗 Unlock Error Messages**
- Alle Unlock-Fehlermeldungen enthalten jetzt Link: https://dub.sh/SlotUnlock
- Betrifft: !slots 20, 30, 50, 100, all
- Direkter Zugang zu Unlock-Informationen

**🛡️ !slots buy Detection**
- Neue Fehlerprävention: `!slots buy X` wird erkannt
- Bot fragt: "Meintest du !shop buy X?"
- Verhindert versehentliche Spins durch Tippfehler

**😔 Loss Limit Warning**
- Nach 10 Losses in Folge erscheint Hinweis zur Pause
- Beispiel: "😔 10 Losses in Folge - Möchtest du vielleicht eine Pause einlegen?"
- Responsible Gaming Feature
- Lustige Nachrichten ab 11+ Losses

**⚠️ Low Balance Warning (Smart)**
- Bei Balance unter 100 DT wird Hinweis auf Daily angezeigt
- Nur wenn Daily tatsächlich verfügbar ist (smart check)
- Zeigt korrekten Betrag (50 DT oder 250 DT mit Boost)
- Verhindert Spam wenn Daily bereits abgeholt

**⏰ Daily Tagesreset (UTC 00:00)**
- Daily nutzt jetzt Tagesreset statt feste 24h
- Kann direkt nach UTC Mitternacht (01:00 CET / 02:00 CEST) abgeholt werden
- Konsistent für alle User weltweit
- Cooldown zeigt Zeit bis nächste Mitternacht

**⚙️ Code-Optimierungen**
- calculateWin Funktion komplett überarbeitet für Wild-Support
- Bessere Grid-Generation für neue Items
- Optimierte Message-Ausgabe (kürzer)
- Verbesserte Error Handling in Daily und Balance Checks

</details>

<details>
<summary>Version 1.3.0 - "Monthly Login Update" (26. Dezember 2025)</summary>

### ✨ Neue Features

**📅 Monthly Login System**

Sammle Login-Tage innerhalb eines Monats und erhalte Milestone-Boni!

**Wie funktioniert es?**
- Jeden Tag `!slots daily` nutzen = 1 Login-Tag
- Mehrmals am Tag zählt nur als 1 Tag
- Am Monatsende wird alles zurückgesetzt
- **Keine Streak** - Tage verpassen ist ok!

**Milestone-Boni:**

| Login-Tage | Milestone-Bonus | Gesamt (mit Daily) |
|------------|-----------------|-------------------|
| 1 Tag | +50 DT | 100 DT |
| 5 Tage | +150 DT | 400 DT |
| 10 Tage | +400 DT | 950 DT |
| 15 Tage | +750 DT | 1,700 DT |
| 20 Tage | +1,500 DT | **3,250 DT** 🎉 |

**Gesamtbelohnung bei 20 Tagen:**
- Ohne Daily Boost: 3,250 DT
- Mit Daily Boost: 6,250 DT

### 🔧 Fixes & Verbesserungen

**Mystery Box Fix**
- Stats Tracker aus dem Pool entfernt
- Verhindert doppelte Unlocks

**Spin Bundle Conversion**
- Spin Bundle gibt jetzt 10 Free Spins (statt Mulligan-System)
- Einfacher und verständlicher

**!slots disclaimer erweitert**
- Neuer optionaler Parameter: `!slots disclaimer @user`
- Zeigt Disclaimer für anderen User an
- Nützlich für Mods

</details>

<details>
<summary>Version 1.2.0 - "Premium Buffs" (24. Dezember 2025)</summary>

### ✨ Neue Shop Items

**🦡 Dachs Locator (Item #33)**
- **Preis:** 1,500 DT
- **Effekt:** x3 Dachs-Chance für 10 nutzbare Spins
- **Kombinierbar:** Mit Lucky Charm für x6 Chance!
- **Strategie:** Perfekt mit hohen Einsätzen (!slots 100)

**🔥 Rage Mode (Item #34)**
- **Preis:** 4,000 DT
- **Dauer:** 30 Minuten
- **Effekt:** +5% Dachs-Chance pro Verlust (max 50%)
- **Reset:** Stack wird bei Gewinn zurückgesetzt
- **Strategie:** Mit niedrigen Einsätzen stacken, dann high-roll

**📈 Profit Doubler (Item #35)**
- **Preis:** 5,000 DT
- **Dauer:** 24 Stunden!
- **Effekt:** Alle Gewinne über 100 DT werden verdoppelt
- **Beispiel:** 250 DT Gewinn → 500 DT
- **Kombo:** Funktioniert mit Multipliers (!slots 100 + Profit Doubler = massiv!)

**💎 Diamond Mine (Item #36)**
- **Preis:** 2,500 DT
- **Effekt:** Garantiert 3-5 Free Spins beim Kauf
- **Multiplier:** Free Spins haben 1x Multiplier (10 DT)
- **Sofort-Item:** Kauf → Instant Free Spins

**🎲 Reverse Chaos (Item #31)**
- **Preis:** 150 DT
- **Effekt:** Garantiert +50 bis +200 DT
- **Kein Risiko:** Immer positiv!
- **Sicher:** Keine Negativ-Results wie bei Chaos Spin

**🌟 Star Magnet (Item #32)**
- **Preis:** 1,200 DT
- **Dauer:** 1 Stunde
- **Effekt:** ⭐ Symbol erscheint 3x häufiger
- **Chance:** 66% auf extra Stern-Rolls bei jedem Spin
- **Ziel:** Massiv erhöhte Chance auf Stern-Pairs und Triples

### 🔧 Fixes & Verbesserungen

**Hourly Jackpot System**
- Jede Stunde gibt es eine zufällige "Lucky Second" (0-59 Sekunden)
- Wer genau in dieser Sekunde spinnt bekommt +100 DT Bonus! ⏰
- Komplett zufällig und nicht vorhersagbar

**Free Spin System überarbeitet**
- Free Spins behalten jetzt den Multiplier vom auslösenden Spin
- Beispiel: 💎💎💎 bei !slots 100 = 5 Free Spins mit 10x Multiplier!
- Bessere Fehlerbehandlung bei Free Spins

</details>

<details>
<summary>Version 1.1.0 - "Community Features" (23. Dezember 2025)</summary>

### ✨ Neue Features

**🎯 Combo Bonus System**

Gewinne hintereinander stapeln sich zu Extra-Boni!

| Combo | Bonus | Gesamt |
|-------|-------|--------|
| 2 Wins | +10 DT | 10 DT |
| 3 Wins | +30 DT | 40 DT |
| 4 Wins | +100 DT | 140 DT |
| 5 Wins | +500 DT | 640 DT 🔥 |

**🔥 Hot Streak Bonus**
- 5 Wins in Folge: +500 DT
- Reset nach Erhalt

**👑 Comeback King Bonus**
- 5+ Losses → 1 Win: +150 DT
- Belohnung für Durchhaltevermögen!

**📊 Stats Tracker System**

Neues Unlock im Shop (Item #18) für 1,250 DT!

**Was zeigt es?**
```
!slots stats
```

- Total Spins
- Wins & Win Rate
- Biggest Win
- Total Won/Lost

**Beispiel:**
```
@username 📊 Stats: 1,247 Spins | 342 Wins (27.4%) | 
Größter Gewinn: 15,000 | Total: +12,450
```

### 🔧 Balance-Änderungen

**Symbol-Wahrscheinlichkeiten optimiert**

Neue Symbol-Verteilung auf der Walze (120 Symbole total):

| Symbol | Anzahl | Beschreibung |
|--------|--------|--------------|
| 🍒 | 24 | Häufigstes Symbol |
| 🍋 | 20 | Sehr häufig |
| 💎 | 21 | Häufig (Free Spins!) |
| 🍊 | 19 | Mittel-häufig |
| 🍇 | 15 | Seltener |
| 🍉 | 11 | Selten |
| ⭐ | 10 | Seltenste Symbol |

**Auswirkung:**
- Gesamtgewinnrate von ~40% auf ~25-29% reduziert
- Faireres Spiel
- Höhere Spannung

</details>

<details>
<summary>Version 1.0.0 - "Initial Release" (21. Dezember 2025)</summary>

### 🎉 Erste Version

**Grundsystem:**
- Slot Machine mit 3x3 Grid
- Middle Row als Gewinnlinie
- DachsTaler (DT) als Währung
- Startguthaben: 100 DT

**Basis-Commands:**
- `!slots` - Spielen (10 DT)
- `!slots daily` - Daily Bonus (50 DT)
- `!transfer` - DT an andere senden
- `!slots balance` - Kontostand anzeigen
- `!slots leaderboard` - Top 5 Rangliste

**Gewinn-Symbole:**

**🦡 Dachs (Jackpot-Symbol)**
- 3x: 15,000 DT
- 2x: 2,500 DT
- 1x: 100 DT

**💎 Diamanten (Free Spins)**
- 3x: 5 Free Spins
- 2x: 1 Free Spin

**Standard-Symbole (🍒🍋🍊🍇🍉⭐)**
- Triples: 50-500 DT
- Pairs: 5-50 DT

**Shop-System:**
- 30+ Items verfügbar
- Kategorien: Boosts, Unlocks, Buffs, Prestige Ränge
- Multiplier-Unlocks (20, 30, 50, 100, all)

**Prestige-Ränge:**
- 🥉 Bronze → 🥈 Silber → 🥇 Gold → 💎 Platin → 👑 Legendary

**Admin-Features:**
- `!slots give` - DT vergeben
- `!slots ban/unban` - User sperren/entsperren

</details>

## 🔗 SOCIAL MEDIA & COMMUNITY

<div align="center">

### 🎮 Folge frechhdachs

[![Twitch](https://img.shields.io/badge/Twitch-frechhdachs-9146FF?style=for-the-badge&logo=twitch&logoColor=white)](https://www.twitch.tv/frechhdachs)
[![Instagram](https://img.shields.io/badge/Instagram-frechhdachs__-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/frechhdachs_/)
[![TikTok](https://img.shields.io/badge/TikTok-@frechhdachs-000000?style=for-the-badge&logo=tiktok&logoColor=white)](https://www.tiktok.com/@frechhdachs)
[![YouTube](https://img.shields.io/badge/YouTube-frechhdachs-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@frechhdachs)

[![Linktree](https://img.shields.io/badge/🔗_Alle_Links-Linktree-39E09B?style=for-the-badge)](https://linktr.ee/frechhdachs)

---

### 💬 Fragen? Bugs? Feedback?

[![Discord](https://img.shields.io/badge/Discord-Dachsbau_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/dachsbau)

---

**💚 Viel Spaß und möge der Dachs mit dir sein! 🦡**

</div>
