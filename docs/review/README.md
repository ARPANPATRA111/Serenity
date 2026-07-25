# Landing and authentication redesign — review evidence

First-viewport captures used to review the redesign in PR #2. Light theme,
captured from a local production build with placeholder Firebase config.

"Before" is `feature/serenity-production-modernization` at `6d4f02c`.
"After" is the same branch with the landing and authentication redesign.

| View | Before | After |
| --- | --- | --- |
| Landing, 1440×1000 | `landing-desktop-before.webp` | `landing-desktop-after.webp` |
| Landing, 390×844 | `landing-mobile-before.webp` | `landing-mobile-after.webp` |
| Signup, 1440×1000 | `signup-desktop-before.webp` | `signup-desktop-after.webp` |

The full set — three pages × seven widths × two themes, 42 states — is
reproducible rather than committed:

```powershell
# Terminal 1: local production build with placeholder config
pnpm build
$env:FB_CREDENTIAL='placeholder'; $env:FB_AUTH_DOMAIN='placeholder.firebaseapp.com'
$env:FB_PROJECT='placeholder-project'; $env:FB_BUCKET='placeholder.appspot.com'
$env:FB_SENDER='000000000000'; $env:FB_APP='1:000000000000:web:placeholder'
pnpm exec next start -p 3210

# Terminal 2
$env:MARKETING_QA_LABEL='after'; node scripts/capture-marketing-screens.mjs
```

The script writes screenshots plus a `report.json` of per-state diagnostics
(horizontal overflow, offending elements, sub-12px text, sub-24px targets,
heading outline, landmark counts) to `%TEMP%/serenity-marketing-qa/<label>/`.

Product screenshots used *on* the landing page are separate project assets in
`public/product/`, captured against the local Firebase emulator with synthetic
recipients. See `MARKETING_REDESIGN_VALIDATION.md` §3.
