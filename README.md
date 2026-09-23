# Gestion d'association — Club de taekwondo

Application web mobile-first (PWA) de gestion du club : présences par QR code, membres, cotisations, grades, palmarès.
Spécification : [`../specification-gestion-association.md`](../specification-gestion-association.md).

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4**
- **Prisma 7** — SQLite en local (`prisma/dev.db`), Postgres (Supabase) en production
- `bcryptjs` (mots de passe), `jose` (sessions signées), `qrcode` (QR membres), `zod` (validation)

## Démarrage

```bash
npm install            # génère aussi le client Prisma (postinstall)
cp .env.example .env   # puis renseigner AUTH_SECRET (openssl rand -base64 32)
npx prisma migrate deploy
npm run db:seed        # référentiels (grades annexe A, frais, types d'événements) + démo
npm run dev            # http://localhost:3000
```

Compte admin de développement : `+261 34 00 000 00` / `admin1234`.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` / `npm run lint` | Vérifications |
| `npm run db:migrate` | Nouvelle migration après modification de `prisma/schema.prisma` |
| `npm run db:seed` | Données de référence et de démo (idempotent) |
| `npm run db:studio` | Explorateur de la base |

## Déploiement sur Vercel

SQLite ne persiste pas sur Vercel (système de fichiers éphémère). Pour la production :

1. Créer un projet Supabase et récupérer l'URL Postgres (pooler).
2. Dans `prisma/schema.prisma`, passer `provider = "postgresql"`, remplacer l'adaptateur
   `@prisma/adapter-better-sqlite3` par `@prisma/adapter-pg` dans `src/lib/db.ts`, puis régénérer les migrations.
3. Définir `DATABASE_URL` et `AUTH_SECRET` dans les variables d'environnement Vercel.

## Écrans (design GPH, 12 écrans)

| Module | Routes |
|---|---|
| Présence | `/presence` (tableau de bord, filtre de période), `/presence/nouvelle`, `/presence/[id]` (détail, correction, clôture), `/presence/[id]/scanner` (QR + saisie manuelle) |
| Membres | `/membres` (recherche, filtres), `/membres/[id]` (fiche, QR, contact), `/membres/nouveau`, `/membres/[id]/modifier` |
| Cotisations | `/cotisations`, `/cotisations/ecolage`, `/cotisations/droit`, `/cotisations/passport`, `/cotisations/paiement`, `/cotisations/paiement/[id]` (confirmation / reçu) |

Le scanner utilise la caméra : il faut **HTTPS** (ou `localhost`) sur le téléphone.

## Organisation

```
prisma/schema.prisma      Modèle de données (spec §5)
prisma/seed.ts            Référentiels + démo
src/proxy.ts              Redirection vers /connexion si non connecté
src/instrumentation.ts    Fuseau horaire Indian/Antananarivo
src/lib/dal.ts            requireUser / requirePermission (contrôle d'accès serveur)
src/lib/permissions.ts    Matrice des permissions (spec §2.2)
src/lib/fees.ts           Échéances, répartition des paiements, n° de reçu
src/lib/attendance.ts     Taux de présence
src/lib/format.ts         Ariary, téléphone +261, JJ/MM/AAAA, année scolaire
src/components/           Composants du design (avatar, navigation, en-têtes…)
src/app/(app)/            Écrans avec navigation ; (scan)/ plein écran ; (auth)/ connexion
src/app/actions/          Server actions (auth, séances, membres, paiements)
```
