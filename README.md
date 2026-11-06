# හරිතායු · Harithayu

A Sinhala-first, English-switchable mangrove restoration website for **Leo Club of SLTC**. Project location: **Mannar, Sri Lanka**. Goal: **500 seedlings**. Contribution: **LKR 100 per seedling** (LKR 50,000 total target).

## Run locally

Requires Node.js 24 or later. No npm packages, paid libraries or build service are required.

```powershell
npm run dev
```

Open http://localhost:3000. Administration: http://localhost:3000/admin.

```powershell
npm test
npm run build
```

`build` checks JavaScript syntax and essential assets. The app runs directly on Node; there is no generated frontend bundle.

## What works

- First-visit seedling grow introduction, skip/replay, reduced-motion support.
- Sinhala and English content, language preference, responsive mobile layout.
- Accurate-purpose symbolic Sri Lanka map with a Mannar project marker; up to 500 contribution seedlings.
- LKR 100 / 500 / 1,000 presets and custom contributions.
- Persistent SQLite donation records; public totals include **only manually confirmed transfers**.
- Opt-in public donor names, anonymous alternatives, private email/reference records.
- Admin session login, transfer review, duplicate-reference prevention, repeat-review protection, rate limits and origin validation.
- After an admin verifies a transfer, the donor's browser checks status every 12 seconds, scrolls to the map and grows a seedling. Other visitors refresh totals every 20 seconds.
- Explicit demonstration action: never records or counts a payment.

## Enable actual bank transfers

1. Copy `.env.example` to `.env` locally. Never commit `.env`.
2. Set `ADMIN_PASSWORD` to a unique password of at least 16 characters.
3. Set the club-approved bank name, account holder, account number and branch. Set an official `CONTACT_EMAIL`; optionally add `CONTACT_PHONE`.
4. Confirm the project details and contribution terms with the club, then set `DONATIONS_ENABLED=true` and restart.
5. Open `/admin`, sign in, and compare each reference **and amount** against the actual bank statement before confirming. A submitted reference is not payment proof.

Until all required configuration exists, the public website **takes no payments** and shows a clearly marked seedling preview. No bank account, contact, donation, team member, planting date or success story has been invented.

Bank transfers are manually verified. This is **not automatic card payment processing**. The app itself is free to run; bank and hosting charges, if any, depend on the chosen providers.

## Why PayHere is not enabled

PayHere's official [Application Process](https://support.payhere.lk/application-process), under “Can PayHere be used to collect donations online?”, says its service cannot collect donations. No PayHere merchant account was supplied. Do not relabel donations as purchases to circumvent this restriction. For automatic card payments, obtain a provider that explicitly accepts this club's charitable use, then integrate server-created orders and signed, idempotent server-to-server notifications. Browser redirects must never confirm payments.

## Production hosting

**Vercel:** import this GitHub repository with framework preset **Other**. `vercel.json` configures the build (`npm run build`), static output (`public`) and Node API. Use Node 24. No payment information or bank details are required to deploy the closed-donations preview.

Vercel cannot persist the local SQLite file. Before accepting contributions, create a [Turso database](https://turso.tech/pricing), run `server/schema.sql` in its SQL console, and add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as sensitive Vercel environment variables. Set `PUBLIC_ORIGIN` to the exact production HTTPS origin (without a trailing slash), then add the club-approved bank/contact/admin configuration described above and redeploy. The application supports Turso directly over HTTPS, including durable admin sessions and rate limits shared across function instances. Never put the token into browser code or GitHub. Both platforms offer plans with free allowances; check current limits and eligibility before selecting a plan. No paid plan is required by this code.

Without remote database configuration, Vercel serves the website and seedling preview with zero contributions, while submission and admin operations remain disabled. An unreachable or uninitialised configured database returns an error rather than pretending a transfer succeeded. Local SQLite records are not automatically migrated to Turso.

**Other Node hosts:** run `npm start` with HTTPS and a persistent disk, set `HOST=0.0.0.0`, `PORT` as required and `PUBLIC_ORIGIN` to the exact HTTPS origin. Back up the SQLite `data/` directory. A local SQLite deployment should run one instance. Admin sessions expire after one hour and are stored in the selected database.

Static-only hosts such as GitHub Pages cannot run the donation API. Hosting setup does not enable automatic card payments.

## Project video and content

Set `PROJECT_VIDEO_URL` to an HTTPS direct MP4 URL for the real project footage. Until supplied, the film dialog honestly identifies it as forthcoming and links to an [independent UNEP documentary](https://www.unep.org/news-and-stories/video/how-sri-lankas-bet-mangroves-paying).

The planting date, exact Mannar location, ecological partner, permissions and monitoring schedule still need club confirmation. Map seedlings represent funded equivalents, **not already-planted trees or guaranteed survival**. Totals may exceed the 500 seedling goal; the visual map caps at 500.

## Assets and research

- Map coastline: public-domain Natural Earth 1:10m geometry from [datasets/geo-countries](https://github.com/datasets/geo-countries). The Sri Lanka feature is saved in `public/assets/sri-lanka.geojson`. `node scripts/update-map.mjs` regenerates both the SVG coastline and the matching seedling mask. Projection preserves local geographic proportions; the Mannar town marker indicates the project region, not a confirmed planting site.
- Project logo: supplied by the user, copied without changes to `public/assets/harithayu-logo.png`.
- Mangrove context photograph: [Roar Media · The Roots of the Sea](https://archive.roar.media/english/life/environment-wildlife/the-roots-of-the-sea-protecting-the-mangroves-of-our-islands-coasts); attribution appears in the site footer. It is not presented as project photography. Confirm image reuse permission or replace it with club-owned imagery before public release.
- Mangrove background: [UNEP](https://www.unep.org/news-and-stories/story/bringing-back-sri-lankas-mangroves-science-and-community-spirit); [Sri Lanka Ministry of Environment restoration guidelines](https://www.env.gov.lk/web/index.php/en/campaigns/222-introduction-of-national-strategic-action-plan-for-conservation-and-sustainable-utilization-of-mangrove-ecosystems-in-sri-lanka-and-national-guideline-for-the-restoration-of-mangrove-ecosystems-of-sri-lanka).
- Typography: Google Fonts DM Sans and Noto Sans Sinhala. Local system fallbacks work without a connection; fonts make external requests when available.

Do not expose the development server directly to the internet without the HTTPS and account configuration above. Admin passwords and donor status tokens should be treated as credentials. Donors can recover their pending status in the same browser; cross-device recovery and automated refund handling are not implemented.
