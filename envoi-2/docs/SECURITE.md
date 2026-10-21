# Sécurité — ce qui est en place, ce qu'il reste à faire

Objectif : **réduire fortement le risque et limiter les dégâts** (le risque zéro n'existe pas). Chaque ligne « en place » est couverte par un test automatique quand c'est possible (`npm test`).

## En place dans le code
| Menace | Protection |
|---|---|
| Mots de passe volés / devinés | bcrypt (coût 11), 10 caractères min., verrouillage 15 min après 5 échecs, limitation par IP (partagée Redis si configurée), alerte en cas de rafale (≥ 15 échecs / 10 min) |
| Vol de session | Sessions **révocables** en base : déconnexion à distance, « déconnecter les autres appareils », coupure immédiate si compte désactivé / mot de passe changé. Cookie HttpOnly + SameSite + Secure. Personnel : 4 h, jamais de connexion automatique |
| Vol d'identifiants de l'app mobile | Jeton d'accès 15 min + jeton de renouvellement **à usage unique** (rotation) ; un ancien jeton rejoué = session coupée + **alerte grave** |
| Accès au back-office | Administrateurs : 2FA obligatoire, permissions par rôle vérifiées côté serveur à chaque action, jamais d'accès par l'app mobile |
| Accès aux données d'autrui | Chaque requête est filtrée par propriétaire (404 sinon), testé pour clients, barbiers, API mobile |
| Injection de script (XSS) | **CSP avec nonce** : seuls nos scripts s'exécutent ; React échappe le texte ; Markdown maison sans HTML brut |
| Clickjacking / MIME / referrer | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS |
| CSRF | SameSite + vérification de l'en-tête Origin sur les routes d'API ; actions de formulaire Next.js protégées |
| Fraude au paiement | Aucun numéro de carte chez nous ; webhooks signés HMAC + tolérance horaire + dédoublonnage ; paiements idempotents ; versements idempotents |
| Fichiers envoyés | Type contrôlé par les premiers octets, taille limitée, stockage privé, **chiffrement AES-256-GCM** au repos, consultation journalisée |
| Fuite de données | Collecte minimale, adresse complète visible du barbier seulement pendant le rendez-vous, export et suppression du compte, CSV protégés contre l'injection de formules |
| Dépendances | `npm audit` : failles corrigées sauf 5 (outils de build/CLI, sans exposition en production) — à suivre |
| Détection et alerte | Table `SecurityEvent` + page **Administration → Sécurité** ; alertes graves par e-mail et webhook Slack/Discord (`ALERT_WEBHOOK_URL`) : force brute, compte admin verrouillé, jeton rejoué, webhook falsifié, création de compte du personnel, changement de mode de paiement |
| Modération | Signalement des messages, avis modérés, suspension d'utilisateurs, journal d'audit |

## À faire par vous (hébergement) — pare-feu web (WAF) recommandé : Cloudflare
1. Mettre le domaine derrière **Cloudflare** (gratuit pour commencer) : DNS en mode « proxifié ».
2. **WAF** → activer les *Managed Rules* (OWASP) ; **Bot Fight Mode** ; niveau de sécurité « Moyen ».
3. **Règles de limitation** (Rate limiting) : `/connexion`, `/admin/login`, `/api/v1/auth/*` → 20 requêtes/minute/IP ; `/api/search`, `/api/address*` → 120/minute.
4. **Protéger `/admin`** avec *Cloudflare Access* (Zero Trust, gratuit ≤ 50 personnes) : l'administration n'est joignable qu'après identification par e-mail, en plus du mot de passe et de la 2FA.
5. **Verrouiller le serveur d'origine** : n'accepter que les adresses IP de Cloudflare (pare-feu de l'hébergeur).
6. **Alertes** : Cloudflare → Notifications (attaque DDoS, pics de requêtes bloquées) vers votre e-mail ; et renseigner `ALERT_WEBHOOK_URL`.
7. En cas d'attaque : mode « Under Attack » Cloudflare ; puis Administration → Sécurité → *Déconnecter partout* pour les comptes concernés ; changer `SESSION_SECRET` (déconnecte **tout le monde**).

## Variables d'environnement de sécurité (production)
`SESSION_SECRET` (≥ 32 car. aléatoires), `DOC_ENCRYPTION_KEY` (32 octets, ex. `openssl rand -base64 32`), `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (limiteur partagé), `ALERT_EMAIL`, `ALERT_WEBHOOK_URL`. **Ne jamais** définir `DEV_AUTOLOGIN` en production (la route est de toute façon désactivée si `NODE_ENV=production`).
Le serveur **refuse de démarrer** sans `SESSION_SECRET` (≥ 32 caractères) et sans `DOC_ENCRYPTION_KEY` en production.

## Reste à faire avant l'ouverture au public
- **Test d'intrusion par un professionnel** (indispensable, jamais fait). Budget indicatif : quelques milliers de CHF.
- PostgreSQL chiffré + sauvegardes testées ; stockage objet privé pour les documents (la clé de chiffrement est déjà gérée).
- Journaux centralisés et supervision (Sentry/Grafana), sans données personnelles.
- Politique de mots de passe : vérification contre les mots de passe fuités (HIBP), 2FA facultative pour clients et barbiers.
- Revue juridique LPD/RGPD (registre des traitements, contrats avec Stripe, hébergeur, Google).
- Mettre à jour `next` / `prisma` quand les versions corrigées sont stables (5 alertes `npm audit` restantes : outils de build uniquement).
