# Architecture technique — GoBarber.ch

## Principe
**Un seul système de réservation** (un backend, une base) consommé par le site web et par les deux applications mobiles. Tout ce qui est métier vit côté serveur ; les clients (web / iOS / Android) n'ont aucune règle de sécurité propre.

```
 Navigateur (site responsive)  ─┐
 App iOS  (Capacitor)           ├─► Next.js 15 (App Router) ─► Prisma ─► PostgreSQL (prod) / SQLite (dev)
 App Android (Capacitor)        ─┘        │                         
                                          ├─► Prestataire de paiement (Stripe Connect) ← webhooks signés
                                          ├─► E-mail (SMTP) · Push (APNs/FCM) · Stockage privé (documents)
```

| Choix | Raison |
|---|---|
| Next.js 15 + React 19 + TypeScript | Un code pour le site, les pages privées, les routes API et les server actions ; pile identique à vos autres projets (maintenance simplifiée). |
| Prisma + SQLite → PostgreSQL | Schéma typé. SQLite en local ; **PostgreSQL obligatoire en production** (concurrence, sauvegardes). |
| Modules métier purs (`src/modules`) | Prix, commission, annulation, créneaux, machine à états, TOTP, webhooks : sans E/S, 100 % testables. |
| `src/lib/booking-service.ts` | Seul point d'écriture des réservations/paiements (transactions, verrou par barbier). |
| Montants en centimes entiers | Pas d'erreur d'arrondi. Fuseau Europe/Zurich pour tous les créneaux. |
| Applications mobiles : **Capacitor** (coque native autour de l'app web) | Même code, publication iOS/Android, plugins natifs (notifications push, géolocalisation, caméra). Voir `STORES.md` : il faut de vraies fonctions natives (push, localisation) pour éviter un refus « simple site web » (guideline 4.2). |

## Modèle de données (extrait)
`User(role CLIENT|PARTNER|ADMIN|SUPPORT)` → `Partner(status DRAFT|PENDING|APPROVED|SUSPENDED|REJECTED)` ← `PartnerService`, `PartnerZone(NPA, frais)`, `AvailabilityRule`, `TimeOff`.
`Booking(status…)` ← `BookingItem`, `Payment(idempotencyKey unique)`, `Message`, `Review`, `Dispute`, `Payout`. Transverse : `AuditLog`, `Setting`, `ContentPage`, `PromoCode`, `Outbox`, `PaymentEvent` (dédoublonnage webhooks).

## Règles de réservation (implémentées et testées)
- **Pas de double réservation** : chaque création de réservation fait d'abord `UPDATE partner SET lockVersion = lockVersion + 1` dans une transaction (verrou de ligne), puis revérifie horaires, congés, conflits **avec temps de trajet** avant/après (par défaut 20 min, réglable par barbier). Test : 3 réservations simultanées du même créneau → 1 seule réussit. *En PostgreSQL, ajouter en plus une contrainte d'exclusion (`tstzrange`) — voir DEPLOIEMENT.md.*
- Réservation en attente de paiement : créneau retenu 10 minutes.
- **« Dès que possible »** : uniquement si un barbier avec demandes immédiates activées a un créneau réel (pas avant `trajet + 15 min`). Sinon l'API renvoie le **prochain créneau possible** des autres barbiers.
- **Statuts** : `PENDING_PAYMENT → REQUESTED → ACCEPTED → EN_ROUTE → IN_PROGRESS → COMPLETED`, + `CANCELLED / REFUSED / EXPIRED / NO_SHOW_*`. Toute transition passe par `canTransition`.

## Paiement (hypothèses de fonctionnement — à valider)
1. Le client paie → **autorisation** (réservation du montant, capture manuelle), jamais de numéro de carte chez nous.
2. Le barbier **accepte** → **capture**. Il **refuse** ou **ne répond pas** (15 min en immédiat, 12 h en planifié, max. 1 h avant le rendez-vous) → autorisation **libérée**, e-mail au client.
3. Annulation client : gratuite avant acceptation et 5 min après ; > 24 h : gratuite ; 24 h–2 h : 50 % retenus ; < 2 h ou barbier en route : dû. Annulation barbier/admin : remboursement intégral (+ signalement du barbier).
4. **Commission** 20 % (hypothèse) sur les prestations après remise ; **frais de déplacement 100 % au barbier** ; frais du prestataire de paiement à la charge de GoBarber (prélevés sur la commission).
5. **Versement** 24 h après la fin de la prestation, groupé par barbier, bloqué en cas de réclamation ouverte.
6. Webhooks : signature HMAC + tolérance horaire, événements dédoublonnés par identifiant ; création de paiement idempotente.
Tous ces paramètres sont modifiables dans *Admin → Paramètres*.

## Sécurité (résumé)
Mots de passe bcrypt (coût 11) · verrouillage après 5 échecs · limitation de débit (login, inscription, recherche, messages, formulaire de contact) · sessions JWT HttpOnly/SameSite · rôle revérifié en base à chaque requête · 2FA TOTP **obligatoire** pour ADMIN/SUPPORT (accès bloqué sur la page 2FA tant qu'elle n'est pas activée) · permissions par rôle côté serveur · filtres de propriété sur chaque requête (404 pour les données d'autrui) · adresse complète visible du barbier uniquement tant que le rendez-vous est actif · documents en stockage privé, consultation journalisée · exports CSV protégés contre l'injection de formules · en-têtes de sécurité · journal d'audit · jetons à usage unique hachés.
