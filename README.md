# Viliqu

Viliqu is a mobile-first Next.js application for creating, customizing, publishing, and sharing invitation websites.

The app includes a template marketplace, invitation builder, public invite pages, profile dashboard, RSVP/event APIs, Supabase authentication, and Supabase-backed invitation data.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase
- Tailwind CSS/PostCSS
- ESLint

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.local.example .env.local
```

Configure the required values in `.env.local`, then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

`.env.local.example` contains the expected local variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_NAME=Viliqu
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPPORT_EMAIL=
GOOGLE_AUTH_ENABLED=false
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not expose server-only secrets such as `SUPABASE_SERVICE_ROLE_KEY` in client components.

## Main Routes

- `/` - marketing home page
- `/templates` - template marketplace
- `/templates/[id]` - template details
- `/templates/[id]/preview` - standalone template preview
- `/builder` - invitation builder
- `/invite/[slug]` - public invitation experience
- `/profile` - user dashboard and invitations
- `/login` and `/signup` - authentication pages
- `/auth/callback` - Supabase auth callback

## API Routes

- `/api/invitations`
- `/api/invitations/[id]`
- `/api/invitations/[id]/publish`
- `/api/media`
- `/api/rsvps`
- `/api/events`
- `/api/wishes`

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

There is currently no `test` script configured.

## Supabase

Supabase schema history lives in `supabase/migrations/` and should remain committed. Generated local Supabase CLI state, such as `supabase/.temp/`, is ignored.

The active invitation template ID `pastel-floral-wedding` is used by the local template registry, default invitation data, builder flow, validation, and migration seed data.

## Project Notes

- This project uses Next.js 16 App Router conventions. Route files under `app/` are used by file-system routing and may not have direct imports.
- Public app URL configuration is centralized through `NEXT_PUBLIC_APP_URL` and `lib/config/site.ts`.
- Generated folders such as `.next/`, `dist/`, `build/`, `.turbo/`, `.cache/`, `tmp/`, and `temp/` should not be committed.
- Keep `README.md`, `AGENTS.md`, lockfiles, config files, environment examples, Supabase migrations, and generated database types unless there is a verified reason to remove them.

## Deployment

Set the same public environment values in the deployment provider dashboard before publishing Viliqu. Ensure Supabase URL, anon key, auth settings, and callback URLs match the deployed application URL.
