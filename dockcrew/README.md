# Dockcrew

Marketplace where warehouses and importers ("suppliers") post container
unloading jobs and registered unloading companies ("teams") quote per
container. The supplier chooses, the team unloads and uploads the doclist,
the supplier confirms, an invoice is generated in the team's name and the
supplier pays the team directly. The platform never holds money.

One web app, built as a PWA: it is the website and installs on phones.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind 4
- Supabase: PostgreSQL, auth, file storage, row-level security
- next-intl: NL, EN, PL, RO, RU (cookie-based, no URL prefix)
- Vitest for unit tests
- Later rounds: Mollie (payments, SEPA mandates), Resend (email), Sentry

## Run locally

```bash
npm install --legacy-peer-deps
cp .env.example .env.local        # fill in Supabase keys
npm run dev                       # http://localhost:3000
npm test                          # unit tests
npm run build                     # production build
```

## Database

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
3. For development, run `supabase/seed/0001_example_price_table.sql`.
   Its amounts are placeholders; the live floor table is set by the admin from
   the platform's own cost model and supplier interviews.

Money is stored as integer euro cents. Every table has row-level security;
`is_admin()` and `current_company_id()` are the two helpers the policies use.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/pricing/bands.ts` | Price bands, job floor, price check, final price after doclist. Pure functions, tested. |
| `src/lib/pricing/example-table.ts` | Example table used by tests and local dev. |
| `src/lib/supabase/` | Browser and server Supabase clients. |
| `src/i18n/`, `messages/` | Locale config and message files. Add a language by adding a file and the code to `locales`. |
| `src/app/page.tsx` | Public landing page. |
| `src/app/actions/locale.ts` | Server action that sets the language cookie. |
| `supabase/migrations/` | Schema. One file per change, numbered. |
| `public/manifest.webmanifest`, `public/icons/` | PWA manifest and icons. |

## Rules of the build

- Suppliers and teams are companies. There are no individual-worker accounts.
- Prices are per container by colli band; jobs are never described in hours.
- The platform generates invoices but never moves or holds job money and never
  deducts its own fee from it. Platform fees are invoiced separately.
- Personal documents go in the `documents` bucket with stricter access.
- Nothing in the code or seed data is derived from any competitor's rate card.

## Rounds

See the App Build Plan and task list. Round 0 (this repo): skeleton, schema,
pricing logic, languages, landing page. Round 1: company sign-up, documents,
admin approval, floor table admin, post a job.
