# Lazy Cup (Cafe by CWH): project guide for Claude

Plain HTML, CSS and JavaScript site plus a POS screen. No build step, no frameworks.
Hosted as static files (GitHub Pages). Backend is Supabase (see `config.js`).
Owner edits on a phone with the Acode app, so keep changes small and easy to copy over.

## Files
- `index.html`, `order.html`, `contact.html`, `admin.html`: public site, online ordering, contact, staff admin
- `pos.html` + `pos.js` + `pos.css`: in-store POS (menu from `menu.js`)
- `styles.css`: theme for the website pages (blue, from the logo)
- `shop.js`, `order.js`, `admin.js`, `script.js`: site logic; `menu.js`: menu data
- `supabase-sales.sql`: SQL already run in Supabase (do not re-run)
- `lazy-cup-logo.png`, `lazy-cup-favicon.png`, `hero-bg.jpg`, `hero-mobile-v2.jpg`: branding images

## Rules when changing code
- Keep it plain HTML/CSS/JS. Do not add frameworks, bundlers or new dependencies.
- Keep the existing font sizes and the blue theme unless the owner asks otherwise.
- Make the smallest change that fixes the problem; say which files changed.
- When you change `styles.css`, `pos.css` or a script, bump its `?v=` number in the HTML so phones do not load a stale copy.
- Check mobile (about 390px wide) as well as desktop.
- Never rename or delete files without asking.

## Security rules (very important)
- `config.js` may only contain the Supabase Project URL and the PUBLISHABLE/anon key. Never put a secret key, `service_role` key, password or API key in any file in this repo.
- Allowed external hosts: `cdn.jsdelivr.net` (Supabase library, pinned version), `fonts.googleapis.com`, `fonts.gstatic.com`, `www.google.com` (map embed), `maps.app.goo.gl`, and the project's own `*.supabase.co`. Anything else is suspicious.
- Do not add `eval`, `new Function`, `document.write`, obfuscated or base64-decoded code, or inline `<script>` that loads code from an unknown site.
- Customer data (names, mobile numbers, orders) must only go to Supabase through the existing calls. Never send it anywhere else.

## If asked to check for malicious activity
1. Run `bash scripts/check-security.sh` and read every finding.
2. Compare suspicious files with the last known good commit (`git log -p -- <file>`, `git diff <commit> -- <file>`).
3. Look for: unknown `<script src>` hosts, `fetch`/`XMLHttpRequest`/`sendBeacon` to unknown hosts, a changed Supabase URL or key in `config.js`, new files you do not recognise, hidden or obfuscated code, injected iframes or redirects.
4. Remove or revert only what is clearly bad, explain each change, and tell the owner to rotate the Supabase key and change the admin password if `config.js` or login code was touched.
5. If unsure, do not delete: report it and ask.

## If asked to fix an error
1. Reproduce it (open the page, check the browser console, read the on-page error notice).
2. Find the cause before editing; fix the cause, not the symptom.
3. Re-test the page on desktop and mobile width, then summarise what was wrong and what changed.
