# QiQi Cottage

A private food wishlist for QiQi and friends. The interface starts in Chinese; English is available under **My card → Language**. The same interface adapts to small phones, tablets, and desktop screens.

## Features

- Public menu browsing with original watercolor artwork and twelve approved menu items.
- Invitation-based friend accounts, editable nicknames, optional avatars and dietary notes.
- Persistent private wishlists, per-drink ice preferences, and new dish requests.
- An owner-only notebook listing each friend's wishes and profile.
- Bilingual menu editing, visibility controls, and request archiving.
- HTTP-only session cookies, salted PBKDF2 password hashes, server-side ownership checks, authentication rate limiting, and same-origin write checks.

## Run locally

Requires Node.js 24 or later. There are no runtime packages to install.

```sh
npm run setup
npm run dev
```

Open `http://127.0.0.1:8788`. Local data is stored in `.data/cottage.sqlite`, which is ignored by Git.

`npm run setup` creates a private `.env` file. Open that file locally to find the friend invitation code and the separate owner setup code. Never commit `.env`, the owner setup code, a live database, or session cookies.

To create the owner account, choose **First visit**, use the reserved login name `qiqi`, supply the friend invitation code, and enter the owner setup code in the collapsed owner setup section. Choose your own unique password. Friends use their own usernames and the invitation code; they cannot claim the reserved owner account without its setup code. Nickname changes do not change account identity or erase wishes.

There is no automated password recovery. The owner must verify a friend's identity before an administrator-assisted account reset. Do not reuse passwords from other services.

## Verify

```sh
npm test
npm run build
```

The tests exercise the real SQLite-backed API, including account separation, hashed passwords and sessions, owner authorization, invitation and consent enforcement, rename preservation, ice selection, private avatars, and cross-origin rejection.

## Static hosting on GitHub Pages

`npm run build` produces `dist/` with only public assets. GitHub Pages can host these files as a menu viewer, but **GitHub Pages cannot run the account API or database**. Without a connected backend, the site displays a sync-unavailable notice and does not pretend to save shared records.

The complete source is portable. `src/server.mjs` supplies the Node.js + SQLite service. `src/worker.mjs` supplies a Cloudflare Workers + D1 service with the same API.

If a complete backend is deployed at another origin, set `public/config.json` → `backendOrigin` to that HTTPS origin and rebuild. The Pages entry redirects to the complete same-origin application. This avoids third-party cookie problems in Safari and embedded browsers.

## Deploy the complete application with Workers and D1

The source includes `wrangler.jsonc`. Configure your own Cloudflare account, remain on the intended plan, and check current provider quotas. This project does not enable a paid plan or automatic overage billing.

```sh
npx wrangler login
npx wrangler d1 create qiqi-cottage
```

Replace the placeholder D1 database ID in `wrangler.jsonc` with the returned ID. Apply schema and the initial menu separately:

```sh
npx wrangler d1 migrations apply qiqi-cottage --remote
npx wrangler d1 execute qiqi-cottage --remote --file seed.sql
npx wrangler secret put INVITE_CODE
npx wrangler secret put OWNER_SETUP_CODE
npx wrangler deploy
```

Set fresh, strong invitation and setup codes in the secret prompts. `OWNER_USERNAME` defaults to `qiqi`. Never use the owner code as the friend invitation code. The production database is separate from the local SQLite database. Production requests use secure HTTP-only cookies. No personal data is committed to GitHub.

## Data and privacy

Only the account owner and QiQi can read a friend's profile, avatar, dietary notes, and wishlist. A nickname is a self-provided familiar name, not verified real-world identity. Avatars are reduced in the browser and stored privately as PNG/JPEG data. The database enforces one wish per friend per menu item.

Use provider backups before modifying live data. To delete an account at the verified user's request, remove the user's row through an authenticated administrative process; foreign keys cascade to sessions, wishes, and requests. The production privacy notice should reflect the actual host and contact arrangements before inviting friends.

## Repository layout

- `public/`: Chinese/English UI and public artwork.
- `src/`: shared API, local SQLite adapter, Node server, and Worker entry.
- `migrations/`: schema migrations.
- `seed.sql`: initial public menu, with no private records.
- `scripts/`: setup and static build commands.
- `tests/`: isolated API verification.

## Mobile verification

The layout is checked at 320, 390, 430, 768, and 1280 CSS pixels. Inputs use at least 16px text to avoid automatic form zoom on iOS; dialogs use mobile bottom sheets, navigation accounts for safe areas, images preserve their aspect ratio, and large controls support touch. Browser resizing is not a substitute for testing on a real phone; check the final URL in iOS Safari, Android Chrome, and WeChat before inviting friends.
