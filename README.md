This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This repo deploys as **one Vercel project** containing two [Vercel Services](https://vercel.com/docs/services) - the Next.js app (`web`) and the Ask tab's Python assistant (`agent`, from `agent-service/`) - wired together in `vercel.json`. See `agent-service/README.md` for how that service works.

1. Import this repo in Vercel as usual (`vercel.json`'s `services` block is picked up automatically - no separate project needed for `agent-service/`).
2. Set these environment variables on the project:
   - `MONGODB_URI`, `AUTH_SECRET`, `IMAGEKIT_PUBLIC`, `IMAGEKIT_PRIVATE`, `IMAGEKIT_ENDPOINT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - used by `web` (the Next.js app), same as local dev.
   - `AGENT_SERVICE_SECRET` - the shared JWT-signing secret between `web` and `agent`. Set it once; both services read the same project-level value.
   - `GROQ_API_KEY`, `GROQ_MODEL` - used by `agent` only.
3. Do **not** set `AGENT_SERVICE_URL` or `NEXT_INTERNAL_BASE_URL` in Vercel - those are auto-injected per deployment by the `bindings` in `vercel.json`. They're only set manually in `.env.local` / `agent-service/.env` for local dev, where the two run as separate processes you start by hand (see `agent-service/README.md`).

The `agent` service has no public rewrite of its own, so it's unreachable from outside - `web` is the only public entry point, and reaches `agent` only through the binding.
