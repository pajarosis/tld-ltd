# TLD Ltd

Static comparison of domain extension prices. The site is an Astro app hosted on Vercel. Prices live in [`data/prices.json`](data/prices.json). There is no database and no server at request time.

## Scripts

- `npm run dev` — local preview
- `npm run refresh` — download the IANA list and Porkbun prices into `data/prices.json`
- `npm run build` — write the static site to `dist/`

## Daily price refresh

[`.github/workflows/refresh-prices.yml`](.github/workflows/refresh-prices.yml) runs every day at 06:00 UTC, and when you start it by hand. It does not run on push, so its own commit cannot loop. If prices changed, it commits `data/prices.json` and pushes to `main`. Vercel rebuilds from that push.

A push made with the default `GITHUB_TOKEN` does not notify Vercel. The workflow pushes with a fine-grained personal access token stored as the repository secret `PRICES_PUSH_TOKEN`.

Create the token on the `pajarosis` GitHub account:

1. Settings → Developer settings → Fine-grained tokens → Generate new token.
2. Resource owner: `pajarosis`. Repository access: only `tld-ltd`.
3. Permissions: Contents — Read and write.
4. In the `tld-ltd` repo: Settings → Secrets and variables → Actions → New repository secret, name `PRICES_PUSH_TOKEN`.

Until that secret exists, run `npm run refresh` locally and push `main`. A normal push deploys through Vercel’s Git integration. Pushes you make yourself do not need the token.
