# Éléments nécessaires avant la mise en production

## Décisions / informations qui n'existent pas encore (rien n'a été inventé)
- [ ] Raison sociale, forme juridique, siège, **IDE**, TVA, contact → mentions légales, reçus, CGV (`[À RENSEIGNER]` dans Admin → Contenus et Paramètres).
- [ ] **Statut des barbiers** (indépendants vs salariés) : risque de requalification (AVS/LPP/LAA, loi sur le service de l'emploi). **À faire valider par un juriste/fiduciaire**, ainsi que la TVA (qui facture quoi : intermédiaire ou prestataire ?).
- [ ] Taux de **commission** réel, politique d'annulation, frais de déplacement par zone, prix indicatifs.
- [ ] Qui supporte les remboursements en cas de litige (aujourd'hui déduit du net barbier — hypothèse).
- [ ] Assurance RC professionnelle exigée des partenaires (montant minimal).
- [ ] Documents juridiques (CGV, contrat partenaire, confidentialité, annulation, mentions, cookies) : **projets à faire valider par un professionnel**.
- [ ] Durées de conservation chiffrées + tâche de purge.
- [ ] Hébergeur, domaine, e-mail d'expédition.

## Développement restant (par ordre de priorité)
1. **Adaptateur Stripe Connect** (PaymentIntent manuel, Payment Element avec TWINT/Apple Pay/Google Pay, comptes Express, transferts, remboursements, webhooks réels) + tests en mode test.
2. Migrations Prisma versionnées + PostgreSQL + contrainte d'exclusion.
3. Stockage objet privé (documents/photos) + antivirus éventuel.
4. Notifications : rappels programmés (cron), push mobiles, SMS facultatifs.
5. Applications iOS/Android (Capacitor) + géolocalisation facultative + signalement de contenus.
6. Signalement d'un message/utilisateur ; blocage ; révision des avis signalés.
7. Facturation PDF (reçus actuellement imprimables depuis le navigateur).
8. Restriction du compte administrateur par IP / VPN, codes de secours 2FA.
9. Tests de charge, audit de sécurité externe, test d'intrusion, relecture RGPD/LPD (registre des traitements, DPA fournisseurs).
10. Internationalisation : textes actuellement en français dans le code ; extraire vers un dictionnaire (`next-intl`) avant d'ajouter une langue ; devise/pays à paramétrer.

## Opérationnel vs démonstration
| Opérationnel (testé) | Démonstration / non branché |
|---|---|
| Comptes, vérification e-mail, reset, verrouillage, rôles, 2FA admin | Paiement **démo** (aucune carte, aucun débit) ; versements simulés |
| Recherche par NPA, créneaux, trajets, « dès que possible » + repli | E-mails : file `Outbox` (pas d'envoi sans SMTP) |
| Réservation, double-clic, concurrence, refus, expiration, annulation, remboursement, litige | Notifications push, SMS, rappels automatiques |
| Espaces client / partenaire / admin, audit, export CSV, documents privés | Comptes `@gobarber.test` et barbiers « [DÉMO] » (**seed `--demo` seulement**) |
| Suppression de compte (anonymisation), export des données | Apps iOS / Android |
