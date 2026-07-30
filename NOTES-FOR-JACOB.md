# Van Dam Painting — Site Notes

Live site: https://bevier19jac.github.io/vandam-painting/
Color Studio: https://bevier19jac.github.io/vandam-painting/studio.html

## How the site is organized

| File | What it is |
|---|---|
| `index.html` | The homepage (all photos embedded — single file) |
| `studio.html` | The "Paint My Room" Color Studio |
| `studio-core.js` | Color math, palette, quiz logic (shared + unit-tested) |
| `site-config.js` | **The one file to edit** — all business info lives here |
| `assets/` | Example room + hero teaser images |
| `test/core.test.js` | Unit tests (`node --test test/core.test.js`) |

## Jacob Needs to Provide

Only these things are still unverified. Everything else on the site is real.

1. **Real business email** → set `email` in `site-config.js` (currently null; the site shows phone/text only, which works fine).
2. **Verified customer reviews** → add to `reviews` in `site-config.js` as `{quote, name, job}`. Until then the site shows the honest "references on request" section (no fake reviews anywhere).
3. **Confirm the stats** → 800+ projects / 30+ years came from you verbally; confirm with Bryan, adjust in `site-config.js` if needed.
4. **Exact guarantee terms** → if Bryan has real workmanship-guarantee terms, put them in `guaranteeTerms`. The site currently says "final walkthrough on every job" (true) instead of claiming a formal guarantee.
5. **Licensing / insurance status** → I removed "Licensed & Insured" claims because they were never verified. If Bryan confirms, it's worth adding back — tell me and I'll place it.
6. **Form destination (optional)** → the estimate form currently turns a request into a ready-to-send **text or call** (honest, works today, no server needed). If you later want silent submissions to an inbox, create a free form endpoint (e.g. Formspree free tier) and set `formEndpoint` — then tell me and I'll wire the fetch path.

## Verification commands used

```
node --test test/core.test.js        # 11/11 pass
python3 -m http.server 8901          # local static server
# Playwright end-to-end: upload → polygon → recolor → compare →
# download → estimate handoff; form validation; mobile; reduced-motion; no-JS
```

## Known limitations (honest ones)

- The recolor preview is an approximation by design — it says so in the UI.
- Dark walls repainted to light colors show less texture (little texture exists in the original pixels to preserve). Same as every tool of this kind.
- The form never fake-sends: with no endpoint configured it hands off to text/call.
- Room photos never leave the visitor's device; the downloaded preview is how they share it.

## Deployment

Automatic. `git push` to `main` → GitHub Pages redeploys in ~1 minute.
