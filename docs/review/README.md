# Landing and authentication redesign — review evidence

First-viewport captures used to review the redesign in PR #2. Light theme,
captured from a local production build with placeholder Firebase config.

"Before" is the branch prior to the landing and authentication redesign.
"After" is the current branch head, including the runtime-audit fixes recorded
in `MARKETING_REDESIGN_VALIDATION.md` §9.

| View | Before | After |
| --- | --- | --- |
| Landing, 1440×1000 | `landing-desktop-before.webp` | `landing-desktop-after.webp` |
| Landing, 390×844 | `landing-mobile-before.webp` | `landing-mobile-after.webp` |
| Signup, 1440×1000 | `signup-desktop-before.webp` | `signup-desktop-after.webp` |
| Mobile header, 390px | `nav-mobile-before.webp` | `nav-mobile-after.webp` |

Dark theme has no "before" — the design it was rebuilt from has no dark mode at
all, so these are new surfaces rather than comparisons:

| View | Capture |
| --- | --- |
| Landing, 1440×1000, dark | `landing-desktop-dark.webp` |
| Login, 1440×1000, dark | `login-desktop-dark.webp` |

## Signed-in application

The application palette now mirrors the public one, so these are captures of
the same design system applied behind the login. Taken against the local
Firebase emulator with the seeded `user-a@example.test` fixture — no production
data.

| View | Capture |
| --- | --- |
| Dashboard, 1440×1000, light | `app-dashboard-light.webp` |
| Dashboard, 1440×1000, dark | `app-dashboard-dark.webp` |
| History, 390×844, light | `app-history-mobile.webp` |
| Templates, 390×844, dark | `app-templates-mobile-dark.webp` |

Reproduce the full signed-in set (8 routes × 2 widths × 2 themes) by starting
the emulator, seeding it, and running the app against it:

```powershell
pnpm emulators          # terminal 1
pnpm seed:emulator      # terminal 2
pnpm dev:emulator       # terminal 2
```

The mobile-header pair is a crop of the same page at the same width, isolating
three defects the runtime audit found. Before: the theme toggle is the
application's amber gradient rather than the marketing palette, "Start free"
is squeezed onto two lines, and the menu button is an **empty outline** because
its icon had collapsed to zero width. After: one line, a visible menu icon, and
the toggle moved into the menu panel at this width.

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
