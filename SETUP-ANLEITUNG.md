# 📋 Setup-Anleitung für dachsbau-slots Repository

## Was du JETZT machen musst:

### Schritt 1: Dateien hochladen

Du bist gerade auf GitHub bei "Add file" → "Upload files". Jetzt:

1. **Lade diese 4 Dateien hoch:**
   - ✅ `worker.js` (dein kompletter Worker Code)
   - ✅ `wrangler.toml` (Konfiguration - MUSS ANGEPASST WERDEN!)
   - ✅ `.gitignore` (Git Ignore Datei)
   - ✅ `README.md` (Beschreibung - optional aber empfohlen)

2. **Commit Message eingeben:**
   ```
   Initial commit: Dachsbau Slots Worker Setup
   ```

3. **"Commit changes" klicken**

---

### Schritt 2: wrangler.toml ANPASSEN (WICHTIG!)

Die `wrangler.toml` Datei enthält diese Zeile:

```toml
kv_namespaces = [
  { binding = "SLOTS_KV", id = "DEINE_KV_NAMESPACE_ID_HIER_EINFÜGEN" }
]
```

**Du musst `DEINE_KV_NAMESPACE_ID_HIER_EINFÜGEN` ersetzen!**

#### Wo findest du die KV Namespace ID?

1. Gehe zu https://dash.cloudflare.com/
2. Klicke auf **Workers & Pages**
3. Klicke auf **KV**
4. Klicke auf dein KV Namespace (vermutlich heißt es "SLOTS_KV" oder ähnlich)
5. Auf der rechten Seite siehst du **"Namespace ID"**
6. Kopiere diese ID (z.B. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

#### Die ID in wrangler.toml eintragen:

**VORHER:**
```toml
{ binding = "SLOTS_KV", id = "DEINE_KV_NAMESPACE_ID_HIER_EINFÜGEN" }
```

**NACHHER:**
```toml
{ binding = "SLOTS_KV", id = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" }
```

**So änderst du die Datei auf GitHub:**
1. Gehe zu deinem Repository
2. Klicke auf `wrangler.toml`
3. Klicke auf das **Stift-Symbol** (Edit) oben rechts
4. Ersetze `DEINE_KV_NAMESPACE_ID_HIER_EINFÜGEN` mit deiner echten ID
5. Commit Message: `Fix: KV Namespace ID hinzugefügt`
6. **"Commit changes"** klicken

---

### Schritt 3: Cloudflare mit GitHub verbinden

1. Gehe zu https://dash.cloudflare.com/
2. Klicke auf **Workers & Pages**
3. Klicke auf **"Create application"**
4. Wähle **"Pages"** Tab
5. Klicke auf **"Connect to Git"**
6. Wähle **GitHub** aus
7. Autorisiere Cloudflare (falls noch nicht geschehen)
8. Wähle dein Repository **"dachsbau-slots"** aus
9. Klicke auf **"Begin setup"**

#### Build Settings:
- **Framework preset**: None
- **Build command**: (leer lassen)
- **Build output directory**: `/`
- **Root directory**: (leer lassen)

10. Klicke auf **"Save and Deploy"**

---

### Schritt 4: Testen

Nach ca. 2 Minuten ist dein Worker live!

1. Cloudflare zeigt dir eine URL (z.B. `dachsbau-slots.pages.dev`)
2. Teste in Twitch: `!slots`
3. Sollte funktionieren! 🎉

---

## Troubleshooting

### Problem: "KV Namespace not found"
❌ Die KV Namespace ID in `wrangler.toml` ist falsch
✅ Lösung: Prüfe die ID nochmal auf Cloudflare

### Problem: "Worker not responding"
❌ Worker wurde nicht richtig deployed
✅ Lösung: Cloudflare Dashboard → Pages → dachsbau-slots → Deployments prüfen

### Problem: "Deployment failed"
❌ Fehler im Code oder in der Konfiguration
✅ Lösung: Cloudflare Logs prüfen (Pages → dein Projekt → View build log)

---

## Nächste Schritte nach erfolgreichem Setup

1. ✅ Custom Domain hinzufügen (optional)
2. ✅ Fossabot Commands auf die neue URL umstellen
3. ✅ Backup der KV Daten machen
4. ✅ Testing im Twitch Chat

---

**Bei Fragen oder Problemen: Einfach fragen! 🦡**
