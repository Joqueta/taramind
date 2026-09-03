# taramind — veille automatique

Application de veille : elle scanne des flux RSS, fait qualifier/catégoriser
chaque article par une IA locale (LM Studio), les range par dossier, et
envoie chaque matin un digest email des meilleurs articles.

## Prérequis

- **LM Studio** doit être ouvert avec un modèle chargé, sur `http://localhost:1234`
  (voir `lib/lmstudio.js`). Sans ça, la qualification des articles échoue.
- Variables d'environnement dans `.env` :
  - `DATABASE_URL` — base SQLite locale
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — compte SMTP pour l'envoi du digest
    (pour Gmail : `SMTP_PASS` doit être un **mot de passe d'application**, pas ton mot de
    passe normal → myaccount.google.com/apppasswords)
  - `DIGEST_TO` — adresse qui reçoit le digest

## Changer les sujets de veille

- **Flux RSS surveillés** : [config/feeds.js](config/feeds.js). Ajoute/retire des entrées
  `{ url, label }` (URL du flux `/feed/` ou `/rss` du site).
- **Dossiers/catégories** utilisés pour ranger les articles : `DOSSIERS` dans
  [lib/pipeline.js](lib/pipeline.js) (actuellement `IA`, `Automatisation`, `Design`,
  `Culture`, `Business`).
- **Mots-clés à surveiller** (surlignés dans le digest s'ils apparaissent) :
  [config/motsCles.js](config/motsCles.js).

## Comment marche le digest email

- `lib/veille.js` (`runVeille`) : lit chaque flux RSS, envoie les nouveaux articles
  (URL pas déjà en base) dans le pipeline IA de qualification.
- `lib/digest.js` (`envoyerDigest`) : sélectionne uniquement les articles **jamais
  encore envoyés** dans un digest (champ `envoyeDigest` en base), garde les **5
  meilleurs par score d'intérêt**, envoie le mail, puis marque tout le lot comme traité.
  - S'il n'y a aucun article nouveau depuis le dernier envoi, aucun mail n'est envoyé.
  - Avec peu de flux RSS configurés, il peut y avoir moins de 5 articles vraiment
    neufs par jour — le mail contiendra alors moins de 5 articles.

## Automatisation quotidienne (macOS launchd)

Deux services tournent en arrière-plan, installés dans `~/Library/LaunchAgents/` :

| Service | Rôle |
|---|---|
| `com.veilleapp.server` | Garde le serveur Next.js (`npm run dev`) allumé en permanence, redémarre tout seul s'il plante. |
| `com.veilleapp.scheduler` | Attend 8h chaque jour ([scripts/scheduler.js](scripts/scheduler.js)), puis appelle `/api/veille` (scan) suivi de `/api/digest` (envoi du mail). |

Les deux se relancent automatiquement à chaque connexion de session (même après
un redémarrage du Mac).

### Commandes utiles

Voir le statut :
```
launchctl list | grep veilleapp
```

Voir les logs :
```
~/Library/Logs/veille-app/server.log        # sortie du serveur Next
~/Library/Logs/veille-app/server-error.log
~/Library/Logs/veille-app/scheduler.log     # sortie du planificateur (résultats des scans/digests)
~/Library/Logs/veille-app/scheduler-error.log
```

Arrêter un service (⚠️ pas juste `kill <PID>` : le service redémarre tout seul) :
```
launchctl bootout gui/$(id -u)/com.veilleapp.server
launchctl bootout gui/$(id -u)/com.veilleapp.scheduler
```

Relancer un service :
```
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.veilleapp.server.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.veilleapp.scheduler.plist
```

Forcer un redémarrage (relit le code / recharge les variables d'env) :
```
launchctl kickstart -k gui/$(id -u)/com.veilleapp.server
launchctl kickstart -k gui/$(id -u)/com.veilleapp.scheduler
```

Déclencher un scan + digest manuellement, sans attendre 8h :
```
curl -X POST http://localhost:3000/api/veille
curl -X POST http://localhost:3000/api/digest
```

## Développement

```
npm run dev
```

⚠️ Si `com.veilleapp.server` tourne déjà (cas normal), le port 3000 est occupé.
Lance plutôt `launchctl bootout gui/$(id -u)/com.veilleapp.server` avant de développer
en mode interactif, puis `launchctl bootstrap ...` pour le relancer en repartant.
