# Déploiement, maintenance, sauvegardes

## Mise en ligne (résumé)
1. PostgreSQL managé ; dans `prisma/schema.prisma` passer `provider = "postgresql"` ; `DATABASE_URL` ; `npx prisma migrate dev --name init` en local puis `prisma migrate deploy` en production (aujourd'hui le dépôt utilise `db push`, **à remplacer par des migrations versionnées avant la prod**).
2. Contrainte anti-chevauchement (défense en profondeur) :
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE "Booking" ADD CONSTRAINT no_overlap EXCLUDE USING gist
     ("partnerId" WITH =, tstzrange("startsAt" - ("travelBufferMin" || ' min')::interval, "endsAt" + ("travelBufferMin" || ' min')::interval) WITH &&)
     WHERE (status IN ('REQUESTED','ACCEPTED','EN_ROUTE','IN_PROGRESS'));
   ```
3. Variables d'environnement (voir SERVICES-EXTERNES.md). `SESSION_SECRET` aléatoire ≥ 32 car. **Jamais** les valeurs de `.env.example`.
4. `npm ci && npm run build && npm start` derrière un reverse proxy HTTPS (HSTS déjà envoyé).
5. `npm run db:seed` (catalogue + contenus, **sans** comptes démo). Créer le premier administrateur par script/SQL **une seule fois**, puis activer la 2FA à la première connexion. **Ne jamais lancer `--demo` en production.**
6. Cron : `* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://gobarber.ch/api/cron`.
7. Limiteur de débit en mémoire → Redis/Upstash dès qu'il y a plus d'une instance.
8. Stockage `storage/` → bucket privé chiffré.

## Sauvegardes et restauration
- PostgreSQL : sauvegarde quotidienne + PITR (hébergeur), rétention 30 j ; **test de restauration trimestriel** documenté.
- `pg_dump -Fc` chiffré hors site chaque nuit ; fichiers du bucket en versionnement.
- Procédure : créer une instance vide → `pg_restore` → `prisma migrate status` → vérifier `SELECT count(*)` sur Booking/Payment → basculer le DNS.
- RPO ≤ 24 h (≤ 5 min avec PITR), RTO cible ≤ 4 h.

## Maintenance
- Mises à jour de dépendances mensuelles (`npm audit`), Node LTS.
- Surveiller : taux d'échec de paiement, demandes expirées, webhooks rejetés, tentatives de connexion échouées (journal d'audit), espace disque.
- Données : appliquer les durées de conservation (CGV/politique) par tâche planifiée — **à écrire** : messages > N mois, journaux > N mois, comptes supprimés.
- Journaux : jamais de mot de passe, jeton, numéro de carte, ni pièce d'identité.
