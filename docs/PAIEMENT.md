# Paiement réel (Stripe Connect) — fonctionnement et mise en route

## Principe
- **Vous choisissez, barbier par barbier,** si le paiement en ligne est actif : *Administration → Partenaires → « Activer le paiement en ligne »*. Sinon le barbier est **réglé sur place** : la demande part tout de suite, aucun paiement ni commission en ligne, aucun versement.
- Avec Stripe, l'activation n'est possible que si le barbier a **terminé son inscription Stripe** (*Revenus → Relier mon compte bancaire* : identité et IBAN saisis chez Stripe, jamais chez nous).
- Si Stripe n'est pas configuré sur le serveur, tout repasse automatiquement en « sur place » (jamais de paiement fantôme).

## Parcours
1. Le client confirme sa réservation → **PaymentIntent** Stripe (CHF) → le client saisit sa carte / Apple Pay / Google Pay / TWINT dans l'interface **hébergée par Stripe**.
2. Stripe prévient notre **webhook** (`/api/webhooks/stripe`, signature vérifiée) → la demande part au barbier.
3. Barbier accepte → montant **encaissé** (mode `manual`) ; refuse ou ne répond pas → autorisation **libérée** ; annulation → remboursement selon la politique.
4. Après la prestation (+ 24 h, sans réclamation) → **versement** au barbier (Transfer Stripe) moins la commission, lancé par l'administrateur (*Paiements → Lancer les versements*).

## Mode de capture
- `STRIPE_CAPTURE_MODE=manual` (défaut) : l'argent est seulement **réservé** puis encaissé à l'acceptation. Cartes, Apple Pay, Google Pay.
- `STRIPE_CAPTURE_MODE=automatic` : encaissé tout de suite, **remboursé** si refus. **Nécessaire pour TWINT** (TWINT ne permet pas de réserver puis encaisser — à vérifier dans la documentation Stripe au moment de l'activation). Le texte « débité à l'acceptation » du site doit alors être adapté.

## Mise en route (à faire par vous)
1. Compte Stripe (Suisse), activer **Connect** (comptes *Express*), **TWINT**, **Apple Pay** (vérifier le domaine) et **Google Pay**.
2. Variables : `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` (`sk_test_…` puis `sk_live_…`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Webhook Stripe → `https://gobarber.ch/api/webhooks/stripe`, événements : `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`.
4. **Tester d'abord avec les clés de test** (cartes `4242 4242 4242 4242`) : réservation → acceptation → remboursement → versement. Le code est testé avec un Stripe **simulé** ; il n'a **jamais été exécuté contre le vrai Stripe** — ces tests réels sont indispensables avant d'ouvrir au public.
5. Coûts : frais Stripe par transaction (grille CH + TWINT), à vérifier sur stripe.com/ch. Les frais sont aujourd'hui supportés par GoBarber (prélevés sur la commission).
