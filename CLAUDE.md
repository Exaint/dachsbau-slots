# Deployment
- NICHT über `wrangler deploy` deployen
- Nur auf GitHub pushen (`git push origin main`)
- GitHub Actions übernimmt das Deployment automatisch

# Git Commit / Push / Deploy Regeln
- NIEMALS `git commit`, `git push` oder `wrangler deploy` ausführen, es sei denn der User sagt EXPLIZIT "commit", "push" oder "deploy"
- Jeder einzelne Commit und Push braucht EXPLIZITE Erlaubnis — ein "ok" gilt nur für genau diese eine Aktion, KEINE Generalerlaubnis
- Im Zweifel: FRAGEN, nicht einfach committen oder pushen

# Commit Style
- Alle Commit-Messages auf DEUTSCH schreiben
- Kurz und prägnant (Betreff max 72 Zeichen)
- Beschreibung in Stichpunkten wenn nötig
