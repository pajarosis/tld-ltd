# TLD Ltd

Static comparison of domain extension prices. The site is an Astro app hosted on Vercel. Prices live in [`data/prices.json`](data/prices.json). There is no database and no server at request time.

## Scripts

- `npm run dev` — local preview
- `npm run refresh` — download the IANA list and Porkbun prices into `data/prices.json`
- `npm run build` — write the static site to `dist/`

## Daily price refresh

[`.github/workflows/refresh-prices.yml`](.github/workflows/refresh-prices.yml) runs every day at 06:00 UTC, and when you start it by hand. If prices changed, it commits `data/prices.json` and pushes with the default `GITHUB_TOKEN`. That push does not start this workflow again, so it cannot loop.

If Vercel does not rebuild from that bot push, create a Deploy Hook in the Vercel project and add it as the repository secret `VERCEL_DEPLOY_HOOK`. You can also run `npm run refresh` locally and push `main`.
