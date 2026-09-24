# Gestion d'association — Club de taekwondo

Application web mobile-first (PWA) de gestion du club : présences par QR code (séances et
événements), annuaire des membres, cotisations, grades taekwondo, palmarès, trésorerie et
espace parents/athlètes. Implémente l'intégralité des phases du spec :
[`../specification-gestion-association.md`](../specification-gestion-association.md).

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4**
- **Prisma 7** — SQLite en local (`prisma/dev.db`), Postgres (Supabase) en production
- `bcryptjs` (mots de passe), `jose` (sessions signées), `qrcode` + `@zxing/browser` (QR),
  `zod` (validation), `exceljs` (import/export Excel), `pdf-lib` (reçus, PV, bilans PDF),
  `recharts` (graphiques), `idb-keyval` (file hors connexion)

## Démarrage

```bash
npm install            # génère aussi le client Prisma (postinstall)
cp .env.example .env   # puis renseigner AUTH_SECRET (openssl rand -base64 32)
npx prisma migrate deploy
npm run db:seed        # référentiels (grades, fédération, trésorerie, événements) + démo
npm run dev            # http://localhost:3000
```

Comptes de démonstration :

| Profil | Téléphone | Mot de passe |
|---|---|---|
| Administrateur | `+261 34 00 000 00` | `admin1234` |
| Parent (2 enfants) | `+261 34 00 000 11` | `parent1234` |
| Athlète | `+261 34 00 000 12` | `athlete1234` |

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` / `npm run lint` | Vérifications |
| `npm run db:migrate` | Nouvelle migration après modification de `prisma/schema.prisma` |
| `npm run db:seed` | Référentiels et démo (idempotent) — voir `prisma/seeds/*.ts` |
| `npm run db:studio` | Explorateur de la base |

## Déploiement sur Vercel

SQLite ne persiste pas sur Vercel (système de fichiers éphémère). Pour la production :

1. Créer un projet Supabase et récupérer l'URL Postgres (pooler).
2. Dans `prisma/schema.prisma`, passer `provider = "postgresql"`, remplacer l'adaptateur
   `@prisma/adapter-better-sqlite3` par `@prisma/adapter-pg` dans `src/lib/db.ts`, puis régénérer les migrations.
3. Définir `DATABASE_URL`, `AUTH_SECRET` et `CRON_SECRET` dans les variables d'environnement Vercel.
4. `vercel.json` déclare la sauvegarde quotidienne (`/api/cron/backup`, protégée par `CRON_SECRET`).
5. Optionnel : `SMS_GATEWAY_URL` / `EMAIL_GATEWAY_URL` / `GATEWAY_TOKEN` pour l'envoi réel des
   invitations, codes de connexion et relances (sans passerelle configurée, les messages restent
   en file dans Réglages → Messages, consultables par le staff).

Le scanner QR utilise la caméra arrière : il faut **HTTPS** (ou `localhost`) sur le téléphone.

## Modules

| Module | Epics | Routes principales |
|---|---|---|
| **Présence** | 1 | `/presence` (séances), `/presence/evenements` (événements, inscriptions, liste d'attente), `/presence/[id]/scanner` et `/presence/evenements/[id]/scanner` (QR, saisie manuelle, hors connexion), `/calendrier` |
| **Membres** | 2 | `/membres` (annuaire, filtres, catégories fédérales), fiche avec tuteurs/QR/historique, `/membres/import` (Excel/CSV) |
| **Cotisations** | 3 | `/cotisations` (Droit/Passport/Écolage/Événements), paiement multi-mois, reçu PDF, annulation motivée, relances |
| **Grades** | 4 | `/grades` (grilles Enfant/Adulte, badges de ceinture), passages, `/grades/examens` (convocation, tirage au sort, PV) |
| **Palmarès** | 5 | `/palmares` (compétitions, résultats), catégories d'âge/poids fédérales par saison, `/club` (vitrine publique) |
| **Trésorerie** | 6 | `/tresorerie` (comptes, recettes/dépenses, validation au-delà d'un seuil, budget, bilans PDF/Excel) |
| **Espace parents/athlète** | 7 | `/mon-espace` (lecture seule, sélecteur d'enfant), `/parents` (comptes, invitations) |
| **Réglages** | 8 | `/reglages` (couleurs + mode sombre, montants, utilisateurs, matrice des permissions, audit, export complet) |
| **Authentification** | 9 | Connexion mot de passe ou code SMS, QR à jeton signé, contrôle d'accès serveur sur chaque page/action |

## Organisation

```
prisma/schema.prisma      Modèle de données complet (spec §5)
prisma/seed.ts            Orchestrateur : charge prisma/seeds/*.ts dans l'ordre
prisma/seeds/             Référentiels (fédération, trésorerie) + démo par module
src/proxy.ts              Redirection vers /connexion si non connecté
src/instrumentation.ts    Fuseau horaire Indian/Antananarivo
src/lib/dal.ts            requireUser / requirePermission / visibleMemberIds (accès serveur)
src/lib/permissions.ts    Matrice des permissions (spec §2.2), configurable par l'admin
src/lib/nav.ts            Modules de navigation filtrés par permission
src/lib/fees.ts           Échéances, répartition des paiements, recette trésorerie, annulation
src/lib/grades.ts         Grille applicable, éligibilité, tirage au sort des poomsae
src/lib/categories.ts     Catégories d'âge/poids fédérales, profil compétition d'un athlète
src/lib/treasury.ts       Soldes de comptes, bilans
src/lib/export.ts         Export Excel (exceljs) et PDF (pdf-lib) génériques
src/lib/invitations.ts    Liens d'activation, réinitialisation, codes SMS (jetons hachés)
src/lib/notify.ts         Notifications in-app / SMS aux parents et athlètes
src/components/           Composants du design (avatar, navigation, badges de ceinture…)
src/app/(app)/            Écrans staff avec navigation ; (scan)/ plein écran ;
                          (auth)/ connexion ; (espace)/ parents et athlètes
src/app/actions/          Server actions par module
```
