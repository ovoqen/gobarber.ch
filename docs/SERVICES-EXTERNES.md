# Services externes — configuration, coûts, informations à fournir

Les **coûts sont indicatifs** (vérifier les grilles officielles au moment de la souscription).

| Service | Rôle | État actuel | À configurer | Coût indicatif | Ce qu'il me faut de vous |
|---|---|---|---|---|---|
| **Stripe Connect** (ou autre PSP marketplace) | Cartes, Apple Pay, Google Pay, TWINT ; onboarding et versements des barbiers | **DÉMO** (`PAYMENT_PROVIDER=demo`, aucun argent). Interface `PaymentProvider` prête ; **adaptateur Stripe à écrire** | Compte Stripe (CH), Connect activé (comptes Express), TWINT activé, domaine vérifié pour Apple Pay, webhook → `/api/webhooks/payments` | Commission par transaction (grille Stripe CH + TWINT), pas d'abonnement fixe en principe | Raison sociale, IDE, IBAN de la société, clés API test puis live |
| **Hébergement** | Serveur + PostgreSQL + sauvegardes | Local | VPS/PaaS en Suisse ou UE (ex. Infomaniak, Exoscale, Fly/Render + Postgres managé) | ≈ 20–80 CHF/mois au démarrage | Choix de l'hébergeur, domaine `gobarber.ch` |
| **E-mail transactionnel** | Vérification, reset, notifications | File `Outbox` (consultable en admin) ; SMTP si `SMTP_HOST` défini | SMTP (Infomaniak, Postmark, Brevo…), SPF/DKIM/DMARC du domaine | 0–20 CHF/mois | Identifiants SMTP, adresse d'expédition |
| **Notifications push** | Statuts, rappels | In-app + e-mail seulement | APNs (clé Apple), FCM (Firebase) via Capacitor | Gratuit | Comptes développeur |
| **Rappels / maintenance** | Expiration des demandes, rappels | `POST /api/cron` (`Authorization: Bearer $CRON_SECRET`) | Cron externe toutes les minutes | Gratuit | — |
| **Stockage fichiers** | Pièces d'identité, photos | Disque local privé `storage/` | Bucket privé S3-compatible + URLs signées, chiffrement au repos | ≈ 1–5 CHF/mois | Hébergeur |
| **Géocodage / carte** (optionnel) | Autocomplétion d'adresse, distance réelle | Non branché : NPA suisse + saisie manuelle | Swisstopo (gratuit) ou Google Places | 0–variable | Choix |
| **SMS** (optionnel) | Rappels | Non branché | Twilio/Infobip… | Au message | — |
| **Antispam** (optionnel) | Formulaires | Honeypot + limitation de débit | hCaptcha / Turnstile si abus | Gratuit | — |
| **Apple Developer Program** | Publier sur l'App Store | — | Compte au nom de la société | ≈ 99 USD/an | D-U-N-S de la société |
| **Google Play Console** | Publier sur Google Play | — | Compte société, vérification | ≈ 25 USD une fois | Identité société |
| **Sentry / logs** (optionnel) | Supervision | Logs console | Sans données personnelles | Gratuit–25 CHF/mois | — |

## Variables d'environnement
`DATABASE_URL`, `SESSION_SECRET` (≥ 32 car. aléatoires, **obligatoire en prod**), `NEXT_PUBLIC_SITE_URL`, `PAYMENT_PROVIDER` (`demo`|`stripe`), `PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET`, `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`.
