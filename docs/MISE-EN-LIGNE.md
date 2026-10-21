# Mise en ligne de GoBarber.ch + publication iOS / Android — pas à pas

Domaine : `gobarber.ch` (enregistré chez Swizzonic). Les coûts sont **indicatifs** : vérifiez les prix sur chaque site.

## Phase A — Préparer (1 à 2 semaines, en parallèle des délais d'inscription)
1. **Informations de la société** (rien n'a été inventé dans le site) : raison sociale, forme juridique, adresse, numéro IDE, TVA, e-mail et téléphone d'assistance. Les remplacer dans *Administration → Contenus / Paramètres* (champs `[À RENSEIGNER]`).
2. **Faire relire par un juriste suisse** : CGV, contrat partenaire, confidentialité, annulation. Et par un fiduciaire : **statut des barbiers** (indépendants ou salariés) et TVA.
3. **Créer les comptes** (dans cet ordre, certains demandent des jours de vérification) :

| Compte | Pourquoi | Coût indicatif |
|---|---|---|
| **Apple Developer Program** (comme *organisation*) | publier sur l'App Store. Demande un numéro **D-U-N-S** (gratuit, 1–2 semaines) | ≈ 99 USD / an |
| **Google Play Console** (organisation) | publier sur Google Play | ≈ 25 USD une fois |
| **Stripe** (Suisse) | paiements, TWINT, Apple Pay, versements aux barbiers (Connect) | frais par transaction |
| **Hébergeur** (Render, voir B) | faire tourner le site et la base de données | ≈ 25–40 USD / mois au début |
| **Cloudflare** | pare-feu web (WAF), protection contre les attaques | gratuit au départ |
| **Firebase** (Google) | notifications sur les téléphones | gratuit |
| **E-mail d'envoi** (Brevo, Postmark ou celui de Swizzonic) | e-mails de confirmation, reçus | 0–20 CHF / mois |
| **GitHub** | stocker le code (dépôt **privé**) | gratuit |

## Phase B — Mettre le site en ligne
1. **Code sur GitHub** (privé) : `github.com/ovoqen/gobarber.ch`.
2. **Préparer le code pour la production** (à faire par moi, ~1 séance) : base **PostgreSQL** à la place de SQLite, migrations, stockage des documents dans un disque persistant, tâche planifiée, fichier de déploiement. *Dites-moi « go » et je le fais.*
3. **Render.com** (simple, serveurs en Europe/Francfort) :
   1. Créer un compte, *New → PostgreSQL* (région Frankfurt), activer les sauvegardes.
   2. *New → Web Service* → connecter GitHub → choisir le dépôt → région Frankfurt → ajouter un **disque persistant** (1 Go) pour les documents.
   3. Dans *Environment*, ajouter les variables (liste ci-dessous).
   4. *New → Cron Job* : toutes les minutes, appelle `https://gobarber.ch/api/cron` avec `Authorization: Bearer <CRON_SECRET>` (expire les demandes sans réponse).
4. **Variables d'environnement** : `DATABASE_URL` (fournie par Render), `SESSION_SECRET` et `CRON_SECRET` (générés, 32+ caractères), `DOC_ENCRYPTION_KEY` (`openssl rand -base64 32`), `NEXT_PUBLIC_SITE_URL=https://gobarber.ch`, `ENABLED_CANTONS=ge`, `PAYMENT_PROVIDER=stripe` + clés Stripe, `SMTP_*` + `MAIL_FROM`, `ALERT_EMAIL`, `ALERT_WEBHOOK_URL`, `FCM_SERVICE_ACCOUNT_JSON`. **Jamais** `DEV_AUTOLOGIN`.
5. **Domaine (Swizzonic → Cloudflare → Render)** :
   1. Cloudflare : *Add a site* → `gobarber.ch` → plan gratuit → noter les 2 **serveurs de noms** donnés (ex. `xxx.ns.cloudflare.com`).
   2. Swizzonic (promo.swizzonic.ch) → votre domaine `gobarber.ch` → **Serveurs de noms / DNS** → remplacer par ceux de Cloudflare. Compter de quelques minutes à 24 h.
   3. Render → votre service → *Settings → Custom Domains* → ajouter `gobarber.ch` et `www.gobarber.ch` → Render indique les enregistrements DNS à créer.
   4. Cloudflare → *DNS* → créer ces enregistrements (CNAME vers `xxx.onrender.com`). HTTPS est automatique.
6. **E-mails** : chez votre fournisseur d'e-mail, ajouter les enregistrements **SPF, DKIM, DMARC** dans Cloudflare DNS (sinon vos mails finissent en spam). Expéditeur : `no-reply@gobarber.ch`.
7. **Premier administrateur** : le créer une seule fois (script fourni), se connecter, **activer la double authentification**. Ne **jamais** lancer le seed de démonstration en production.
8. **Stripe** : d'abord en mode **test** → créer le webhook `https://gobarber.ch/api/webhooks/stripe` (événements dans `docs/PAIEMENT.md`) → activer Connect (comptes Express), TWINT, Apple Pay (vérifier le domaine `gobarber.ch`) et Google Pay → réaliser un parcours complet avec les cartes de test → **seulement ensuite** passer aux clés `live`.
9. **Pare-feu et alertes** : suivre `docs/SECURITE.md` (WAF, limitation de requêtes, protection de `/admin` par Cloudflare Access, alertes).
10. **Essai à blanc** : un faux client, un vrai barbier de test : réserver → accepter → terminer → avis → versement. Vérifier l'e-mail reçu et la notification.
11. **Avant d'ouvrir au public** : test d'intrusion par un professionnel, sauvegarde de la base testée (restauration), textes juridiques validés, assurance RC des barbiers définie.

## Phase C — Publier sur iOS et Android
Les applications sont une **coque** autour du site (déjà prête : `capacitor.config.ts`). Elles ne peuvent s'ouvrir qu'**après** la mise en ligne du site en HTTPS.

**Option 1 — vous avez accès à un Mac récent** : installer Xcode (App Store, gratuit) et Android Studio, puis `npx cap add ios && npx cap add android` et suivre `docs/MOBILE.md`.
**Option 2 — pas d'installation possible sur votre ordinateur (votre cas)** : construire dans le **cloud** avec **Codemagic** (codemagic.io, gratuit pour démarrer) : il compile les apps iOS et Android sur ses propres machines à partir de votre dépôt GitHub. Je prépare le fichier de configuration (`codemagic.yaml`) et les projets natifs.

Étapes communes :
1. **Firebase** : créer le projet → ajouter une app iOS (`ch.gobarber.app`) et une app Android → télécharger `GoogleService-Info.plist` et `google-services.json` → dans *Paramètres → Cloud Messaging*, téléverser la **clé APNs** (créée dans votre compte Apple Developer) → créer une clé de compte de service → la mettre dans `FCM_SERVICE_ACCOUNT_JSON` sur Render.
2. **Apple** : dans *App Store Connect*, créer l'app (`ch.gobarber.app`, nom « GoBarber »), créer le certificat de signature et la clé APNs ; Codemagic s'en sert pour signer.
3. **Google** : dans *Play Console*, créer l'app, générer la clé de signature (Codemagic peut le faire).
4. **Construire** (Codemagic) : une version de test iOS (envoyée sur **TestFlight**) et Android (piste de **test interne**). Installer sur de vrais téléphones et tester : connexion, réservation, paiement (Apple Pay / Google Pay / TWINT), notification, position, suppression de compte.
5. **Fiches des stores** (je les prépare) : nom, description courte/longue en français, mots-clés, catégorie « Style de vie », icône 1024×1024, captures d'écran, lien confidentialité `https://gobarber.ch/legal/confidentialite`, lien d'assistance, adresse e-mail d'assistance, questionnaires « App Privacy » (Apple) et « Data safety » (Google).
6. **Notes pour les relecteurs** : un **compte client** et un **compte barbier** de démonstration (avec Stripe en mode test) et la phrase : « Service de coiffure à domicile : les services physiques sont payés hors achat intégré ; suppression du compte dans Profil → Supprimer mon compte ».
7. **Soumettre** : relecture Apple (souvent 1 à 3 jours), Google (quelques heures à quelques jours). Répondre aux remarques si refus (fréquent la première fois), corriger, renvoyer.

## Calendrier réaliste
| Quand | Quoi |
|---|---|
| Semaine 1 | Comptes (Apple/D-U-N-S, Google, Stripe, Render, Cloudflare), préparation du code de production |
| Semaine 2 | Site en ligne en mode test (Stripe test), domaine, e-mails |
| Semaines 3–4 | Essais complets, juridique, test d'intrusion, apps en test (TestFlight / test interne) |
| Semaine 5+ | Soumission aux stores, puis ouverture au public avec Stripe `live` |

## Budget de démarrage indicatif
Apple ≈ 99 USD/an · Google ≈ 25 USD · hébergement ≈ 25–40 USD/mois · e-mail 0–20 CHF/mois · Stripe : frais par transaction · test d'intrusion : quelques milliers de CHF · juriste/fiduciaire : selon devis.
