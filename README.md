# 🦡 Dachsbau Slots

Ein vollwertiges Slot-Machine-Spiel für den Twitch-Chat von [twitch.tv/frechhdachs](https://twitch.tv/frechhdachs), betrieben als Cloudflare Worker mit KV-Storage und D1-Datenbank.

**Website:** [Link](https://dachsbau-slots.exaint.workers.dev)

---

## Features

### Spielmechaniken
- 🎰 **Slot Machine** mit virtueller Währung (DachsTaler)
- 🎁 **Daily Bonus** mit monatlichen Meilenstein-Belohnungen
- 🏆 **60+ Achievements** in 7 Kategorien
- 🛍️ **39 Shop-Items** (Buffs, Boosts, Unlocks, Prestige-Ränge)
- ⚔️ **Duel-System** für 1v1 Herausforderungen
- 🏅 **Prestige-Ränge** (Bronze → Silber → Gold → Platin → Legendary)
- 💰 **DachsBank** Community-Konto
- 🎡 **Glücksrad**, **Chaos Spin**, **Mystery Box** und mehr

### Web-Features
- 📊 Interaktive Profilseiten mit Achievement-Tracking
- 📈 Leaderboard und globale Statistiken
- 🛒 Shop mit Web-Kaufoption (mit Twitch-Login)
- 🔐 Twitch OAuth Integration
- 📱 Responsive Design für Mobile & Desktop

### Technologie
- ⚡ Cloudflare Workers (Edge Computing)
- 💾 Cloudflare KV (Key-Value Storage)
- 🗄️ Cloudflare D1 (SQL-Datenbank für Leaderboard & Analytics)
- 🔄 Automatisches Deployment via GitHub Actions

---

## Chat Commands

### Spielen

| Command | Beschreibung |
|---------|-------------|
| `!slots` | Spiele einen Spin (10 DT) |
| `!slots [Betrag]` | Spiele mit Multiplikator (z.B. `!slots 50`) |
| `!slots [1-∞]` | Freie Beträge (benötigt !slots all Unlock) |
| `!slots all` | Setze gesamtes Guthaben (benötigt Unlock) |
| `!slots accept` | Akzeptiere die Spielbedingungen (einmalig) |

### Informationen

| Command | Beschreibung |
|---------|-------------|
| `!slots balance` | Zeige Kontostand und Free Spins |
| `!slots stats` | Zeige persönliche Statistiken |
| `!slots buffs` | Zeige aktive Buffs und Items |
| `!slots bank` | Zeige DachsBank-Kontostand |
| `!slots daily` | Hole täglichen Bonus (100-150 DT) |
| `!leaderboard` | Top 5 Spieler |

### Shop

| Command | Beschreibung |
|---------|-------------|
| `!shop` | Zeige Shop-Übersicht |
| `!shop buy [Nummer]` | Kaufe Item (z.B. `!shop buy 14`) |

### Duelle

| Command | Beschreibung |
|---------|-------------|
| `!duel @user [Betrag]` | Fordere Spieler heraus (min. 100 DT) |
| `!duelaccept` | Akzeptiere Duell |
| `!dueldecline` | Lehne Duell ab |
| `!slots duelopt` | Aktiviere/Deaktiviere Duelle |

### Transfers

| Command | Beschreibung |
|---------|-------------|
| `!transfer @user [Betrag]` | Sende DachsTaler an Spieler |
| `!transfer dachsbank [Betrag]` | Spende an DachsBank |

---

## Shop-Items (39 Items)

### Symbol-Boosts (2-8)
Verdoppeln den nächsten Gewinn mit dem jeweiligen Symbol.

| # | Item | Preis |
|---|------|-------|
| 2-7 | Frucht-Boosts (🍒🍋🍊🍇🍉⭐) | 50 DT |
| 8 | Dachs-Boost 🦡 | 150 DT (1x/Woche) |

### Sofort-Items
| # | Item | Preis | Effekt |
|---|------|-------|--------|
| 1 | Peek Token 👁️ | 75 DT | Vorschau des nächsten Spins |
| 11 | Chaos Spin 🌀 | 250 DT | Zufällig ±200-400 DT |
| 12 | Glücksrad 🎡 | 300 DT | Drehe das Rad |
| 16 | Mystery Box 📦 | 1000 DT | Zufälliges Item |
| 31 | Reverse Chaos 🔄 | 150 DT | Garantiert +100-300 DT |
| 36 | Diamond Mine 💎 | 2500 DT | 5-15 Free Spins |
| 37 | Guaranteed Pair 🎯 | 180 DT | Garantiertes Paar |
| 38 | Wild Card 🃏 | 250 DT | Wild-Symbol im nächsten Spin |

### Timed Buffs
| # | Item | Preis | Dauer | Effekt |
|---|------|-------|-------|--------|
| 14 | Happy Hour ⚡ | 800 DT | 1h | Halbe Spin-Kosten |
| 20 | Lucky Charm 🍀 | 2000 DT | 1h | 2x Dachs-Chance |
| 24 | Golden Hour ✨ | 3500 DT | 1h | 2x alle Gewinne |
| 32 | Star Magnet 🌟 | 1200 DT | 1h | 33% Stern-Konvertierung |
| 33 | Dachs Locator 🦡 | 1500 DT | 10 Uses | 3x Dachs-Chance |
| 34 | Rage Mode 🔥 | 4000 DT | 30m | +5% Dachs pro Verlust |
| 35 | Profit Doubler 📈 | 5000 DT | 24h | 2x alle Gewinne |
| 39 | Diamond Rush 💎 | 2000 DT | 1h | 33% Diamant-Konvertierung |

### Unlocks (Permanent)
| # | Item | Preis | Voraussetzung |
|---|------|-------|---------------|
| 13 | !slots 20 | 500 DT | - |
| 19 | !slots 30 | 2000 DT | slots_20 |
| 21 | !slots 50 | 2500 DT | slots_30 |
| 23 | !slots 100 | 3250 DT | slots_50 |
| 25 | Freie Einsätze (!slots 1-∞) | 4444 DT | slots_100 |
| 27 | Daily Interest Boost | 10000 DT | - |
| 28 | Custom Win Message | 10000 DT | - |

### Prestige-Ränge
| # | Rang | Preis | Voraussetzung |
|---|------|-------|---------------|
| 17 | 🥉 Bronze | 1200 DT | - |
| 22 | 🥈 Silber | 3000 DT | Bronze |
| 26 | 🥇 Gold | 8000 DT | Silber |
| 29 | 💎 Platin | 25000 DT | Gold |
| 30 | 👑 Legendary | 44444 DT | Platin |

---

## Achievements

### Kategorien

| Kategorie | Achievements | Beispiele |
|-----------|-------------|-----------|
| 🎰 Spinning | 6 | Erster Dreh, 100/500/1000/5000/10000 Spins |
| 🏆 Winning | 11 | Erster Gewinn, Big Wins, Hot Streak, Comeback King |
| 💰 Sammeln | 7 | Dachs-Finder, Dachs-Trio, Obstkorb, Triple-Meister |
| 👥 Social | 9 | Transfers, Duelle gewonnen |
| 📅 Hingabe | 11 | Daily-Streaks, Kontostand-Meilensteine |
| 🛒 Shopping | 5 | Shop-Käufe, Alle Slots freigeschaltet |
| ⭐ Spezial | 10 | Versteckte Achievements |

### Versteckte Achievements
- Perfektes Timing (Mitternacht UTC)
- Lucky 777 (genau 777 DT)
- Zero Hero (Gewinn mit 0 DT)
- Chaos-Meister (1000+ DT Chaos-Gewinn)
- Glücksrad-Champion (5x Dachs Jackpot)

---

## Gewinn-Tabelle

### Triple (3 gleiche Symbole)
| Symbol | Gewinn |
|--------|--------|
| 🦡 Dachs | 1000 DT |
| 💎 Diamant | 500 DT |
| ⭐ Stern | 250 DT |
| 🍒🍋🍊🍇🍉 Früchte | 50-75 DT |

### Paare (2 gleiche Symbole)
50% des Triple-Gewinns

### Dachs-Spezial
| Kombination | Gewinn |
|-------------|--------|
| 🦡🦡🦡 Triple | 1000 DT |
| 🦡🦡 Paar | 100 DT |
| 🦡 Single | 10 DT |

---

## Monatliche Login-Belohnungen

| Tage | Belohnung |
|------|-----------|
| 7 Tage | 100 DT |
| 14 Tage | 200 DT |
| 20 Tage | 300 DT |

---

## Admin-Commands

Nur für Moderatoren verfügbar:

```
!slots give @user [amount]     - DachsTaler geben
!slots setbalance @user [amt]  - Kontostand setzen
!slots givebuff @user [shop#]  - Item geben
!slots removebuff @user [shop#]- Item entfernen
!slots ban @user               - Spieler sperren
!slots unban @user             - Entsperren
!slots blocklb @user           - Vom Leaderboard verstecken
```

---

## Deployment

Das Repository ist mit Cloudflare Workers verbunden und deployed automatisch bei jedem Push auf `main`.

### Umgebung

- **Runtime:** Cloudflare Workers
- **Storage:** Cloudflare KV + D1
- **Auth:** Twitch OAuth
- **CDN:** Cloudflare R2 (für Assets)

### Lokale Entwicklung

```bash
npm install
npx wrangler dev
```

---

## Links

- **Website:** [Link](https://dachsbau-slots.exaint.workers.dev)
- **Twitch:** [Link](https://twitch.tv/frechhdachs)
- **Info-Seite:** [Link](https://dachsbau-slots.exaint.workers.dev/?page=info)
