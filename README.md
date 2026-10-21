# GoBarber.ch

Plateforme de réservation de barbiers à domicile (Suisse, FR, CHF) — site responsive + espaces client / partenaire / administration. Next.js 15 · Prisma · Tailwind 4 · TypeScript.

```bash
export PATH=~/.local/node/bin:$PATH
npm install
cp .env.example .env        # puis éditer
npx prisma db push
npm run db:seed -- --demo   # catalogue + contenus + comptes DE DÉMO (@gobarber.test)
npm run dev                 # http://localhost:3200
npm test                    # 33 tests (domaine, concurrence, paiements, accès HTTP si le serveur tourne)
```

Comptes de démo (mot de passe = `SEED_PASSWORD` du `.env`) : `client@`, `barbier1@`, `barbier2@`, `admin@`, `support@gobarber.test`. L'admin doit activer la 2FA (clé affichée à l'écran) à la 1re connexion. Les e-mails (liens de vérification) sont listés dans *Admin → E-mails*.

Documentation : [`docs/SECURITE.md`](docs/SECURITE.md) · [`docs/PAIEMENT.md`](docs/PAIEMENT.md) · [`docs/MOBILE.md`](docs/MOBILE.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/SERVICES-EXTERNES.md`](docs/SERVICES-EXTERNES.md) · [`docs/STORES.md`](docs/STORES.md) · [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) · [`docs/AVANT-MISE-EN-PRODUCTION.md`](docs/AVANT-MISE-EN-PRODUCTION.md).

Structure : `src/modules` (règles métier pures) · `src/lib` (auth, service de réservation, notifications) · `src/app/(site)` (public, client, partenaire) · `src/app/admin` · `prisma/content.ts` (textes publics et **projets** juridiques).

## Connexion rapide (développement local)
Avec `DEV_AUTOLOGIN="1"` dans `.env` : `http://localhost:3200/api/dev-login?as=admin` (ou `partner`, `client`, `support`) connecte directement un compte de démo, sans mot de passe ni code 2FA. Désactivé en production et hors localhost.
