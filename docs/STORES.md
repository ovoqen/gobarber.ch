# Publication App Store / Google Play — exigences et points ouverts

> ⚠️ **Rien ici ne garantit l'acceptation.** Les règles d'Apple et de Google changent : **re-vérifier les textes officiels le jour de la soumission** (App Store Review Guidelines, Apple Developer Program License Agreement, Google Play Developer Policy, Data safety, Payments policy). Je n'ai pas pu consulter ces pages dans cette session ; la liste ci-dessous reprend les exigences connues, marquées « à vérifier ».

## Statut des applications
**Non réalisées à ce stade.** Aucun outil Xcode n'est installé sur cette machine (pas de compilation iOS possible) et aucun SDK Android n'a été vérifié. Plan : coque **Capacitor** autour de l'application web (déjà responsive, installable en PWA via `manifest.webmanifest`), voir ci-dessous.

## Check-list
| Sujet | Exigence (à vérifier) | État |
|---|---|---|
| Paiement de prestations physiques à domicile | Les services physiques consommés hors de l'app peuvent en général être payés avec un moyen externe (carte/Apple Pay via PSP) **sans** achat intégré Apple/Google ; ne jamais vendre de contenu numérique par ce biais | Conforme dans la conception — **à confirmer** auprès de la revue |
| Création **et suppression** de compte | Suppression initiable **depuis l'app** (Apple, Google) | ✅ implémentée (Profil → Supprimer) ; ⚠️ refusée si réservation en cours — à expliquer dans l'écran |
| Confidentialité | Politique publique accessible ; « App Privacy » (Apple) et « Data safety » (Google) cohérents avec les collectes réelles | Projet de politique rédigé ; **formulaires à remplir** |
| Localisation | Libellé d'usage clair ; **facultative** ; saisie manuelle toujours possible | Saisie manuelle OK ; géolocalisation **non encore codée** |
| Caméra/photos | Uniquement pour la photo/documents du partenaire, avec libellé d'usage | Upload fichier OK ; prise de photo native à ajouter |
| Notifications | Demande de permission contextualisée, jamais obligatoire | À implémenter (APNs/FCM) |
| Connexions tierces | Si « Sign in with Google/Facebook » est ajouté → **Sign in with Apple** requis (à vérifier) | Non applicable (e-mail uniquement) |
| Contenus générés (avis, messages) | Filtrage, **signalement**, blocage, modération réactive | Modération admin des avis ✅ ; **signalement de message/utilisateur** à ajouter |
| Assistance | URL d'assistance + e-mail de contact valides | Page Contact ✅ ; adresse [À RENSEIGNER] |
| Liens légaux | CGU, confidentialité dans l'app et la fiche | ✅ pages prêtes (projets) |
| Accès de démonstration | Comptes de test pour le relecteur (client, barbier approuvé) | Comptes démo existent (`--demo`) ; **créer un jeu dédié sur l'environnement de pré-production** avec paiement en mode test |
| Guideline 4.2 (valeur minimale) | Une simple page web emballée peut être refusée | Prévoir push natifs, localisation, partage, caméra |
| Compte développeur | Au nom de la société (D-U-N-S pour Apple) | À faire |

## Fiches à préparer (non produites)
Icônes (1024×1024, adaptatif Android), captures d'écran par taille d'appareil, textes courts/longs FR, mots-clés, catégorie (Style de vie / Beauté), classification d'âge, URL de confidentialité et d'assistance, déclarations de collecte de données, note de revue avec comptes de démo.

## Marche à suivre (quand vous serez prêt)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/push-notifications @capacitor/geolocation`
2. `npx cap init GoBarber ch.gobarber.app --web-dir=public` ; configurer `server.url` vers l'URL de production HTTPS.
3. `npx cap add ios && npx cap add android` ; ouvrir dans Xcode / Android Studio (**Xcode complet requis**).
4. Ajouter push + géolocalisation (facultative), signalement de contenus, puis TestFlight / piste de test interne Google Play.
