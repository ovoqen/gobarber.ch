# Applications iOS et Android

## Ce qui est prêt dans le code
| Fonction | État |
|---|---|
| Accès propre de l'application | **API `/api/v1`** : connexion e-mail + mot de passe, jeton d'accès 15 min, renouvellement par jeton à usage unique, déconnexion, suppression du compte (exigée par Apple/Google) |
| Réservations par l'API | liste, détail, création, paiement (Stripe), annulation ; côté barbier : demandes, accepter/refuser, statuts (en route, commencé, terminé) |
| Notifications push iOS + Android | Enregistrement des appareils (`/api/v1/devices`) + envoi via Firebase Cloud Messaging ; bouton « Activer les notifications » demandé **au clic** (exigence des stores) ; toucher une notification ouvre la bonne page |
| Géolocalisation | Bouton « 📍 Utiliser ma position » (facultatif, jamais bloquant) → adresse officielle du canton ; saisie manuelle toujours possible ; position non conservée |
| Connexion automatique | Session de 30 jours (« Rester connecté ») conservée par l'application ; révocable à distance |
| Contenus signalables | Bouton « Signaler » sur les messages + page de modération (exigence Apple 1.2) |
| Coque native | `capacitor.config.ts` (id `ch.gobarber.app`) |

## Ce qu'il faut faire sur un Mac avec Xcode / un PC avec Android Studio (impossible sur la machine de développement actuelle)
1. Comptes : **Apple Developer Program** (≈ 99 USD/an, au nom de la société, numéro D-U-N-S) et **Google Play Console** (≈ 25 USD une fois).
2. Site en ligne en HTTPS ; `export CAP_SERVER_URL=https://gobarber.ch`.
3. `npm run build` puis `npx cap add ios && npx cap add android && npx cap sync`.
4. **iOS** (`npx cap open ios`) : dans *Info.plist* ajouter `NSLocationWhenInUseUsageDescription` = « GoBarber utilise votre position uniquement pour trouver votre adresse. » ; activer les capacités *Push Notifications* et *Background Modes → Remote notifications*.
5. **Android** (`npx cap open android`) : permissions `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `POST_NOTIFICATIONS` ; ajouter `google-services.json`.
6. **Firebase** : créer un projet, ajouter les apps iOS/Android, **téléverser la clé APNs** (Apple) dans Firebase ; générer une clé de compte de service → variable `FCM_SERVICE_ACCOUNT_JSON` sur le serveur.
7. Icônes et écrans de démarrage : `npx @capacitor/assets generate` (icône 1024×1024 fournie par votre designer).
8. Tests : TestFlight (iOS) et piste de test interne (Android) avec de vrais téléphones ; vérifier paiement (Apple Pay / Google Pay / TWINT), push, géolocalisation, suppression de compte.

## Pour maximiser les chances d'acceptation (rien n'est garanti)
- **Apple 4.2 (valeur minimale)** : l'app apporte des fonctions natives (notifications, localisation, connexion persistante). Ne pas soumettre une coque vide.
- **Apple 5.1.1(v)** : suppression du compte possible **dans l'app** → Profil → Supprimer mon compte. ✔
- **Paiements** : services physiques à domicile → paiement externe autorisé (pas d'achat intégré) ; ne jamais vendre de contenu numérique.
- **Apple 1.2 / Google UGC** : signalement des messages ✔, modération ✔, coordonnées d'assistance : page Contact ✔ — *ajouter l'e-mail d'assistance réel*.
- **Confidentialité** : remplir « App Privacy » (Apple) et « Data safety » (Google) avec : e-mail, nom, téléphone, adresse, position approximative (facultative), identifiants d'appareil (push), historique de réservations, paiements (traités par Stripe).
- **Compte de démonstration pour le relecteur** : créer sur un serveur de pré-production un client et un barbier approuvé avec Stripe en mode test ; l'indiquer dans les notes de revue.
- **Notifications** : jamais d'adresse complète dans le texte (visible écran verrouillé) ✔.
- Vérifier les règles **officielles en vigueur le jour de la soumission** : elles changent.
