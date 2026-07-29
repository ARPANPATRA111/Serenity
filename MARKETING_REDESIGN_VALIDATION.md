# Landing and Authentication Redesign — Validation Record

Date: 2026-07-26
Branch: `feature/serenity-production-modernization`
Base: `main` = `3399e99` (unchanged)
Scope: public landing page, login, signup, and the shared visual system.
Out of scope this run: dashboard, editor, history, verification, templates,
and every other authenticated page.

---

## 1. Design research

Calendly's current public pages (`/`, `/login`, `/signup`) were captured with a
headless browser at 1440×1000, 768×1024, and 390×844, and their computed styles
were sampled for palette, radii, shadow, and type metrics. The study informed
*principles only*. No wording, colour value, artwork, layout, decorative shape,
animation, or component dimension was reproduced.

| Principle observed | Why it works | Adopted for Serenity as |
| --- | --- | --- |
| Light neutral canvas, dark ink type | Content leads; chrome recedes | White/`#F5F7FC` alternating bands, `#101935` ink |
| One decisive action colour | CTA hierarchy is unambiguous | Serenity indigo `#4F46E5`, single primary button style |
| Headline states the outcome, not a mood | Comprehensible in seconds | "From spreadsheet to verified certificates in minutes." |
| Large real product imagery beside the hero | Proof beats description | Three real screenshots of the running app |
| Readable tracking, ~1.1–1.2 line height | Large type stays legible | `sr-h1` at `-0.022em` / 1.1 (was `-0.052em` / 0.92) |
| Soft shadows tinted with the ink colour | Depth without heaviness | Three-step scale tinted `rgb(16 25 53)` |
| Modest radii (8–24px) | Reads as software, not a toy | 10/14/20/28px scale (was 32–36px) |
| Auth controls are large and calm | Reduces form friction | 48px controls, 16px input text, one card |
| Signup: form first, benefits secondary | Protects the conversion path | Benefits panel is `aside`, below the form on mobile |
| Simplified nav on auth pages | Fewer exits mid-signup | Brand + theme toggle only |

Deliberately **not** copied: the announcement pill above the login heading, the
progressive email-then-password login step, the customer logo wall (Serenity has
no verified customers to name), the split hero panel proportions, the
magenta/blue blob artwork, and the "20 million professionals" style of claim.

---

## 2. What the audit found

| Area | Before this run | Action |
| --- | --- | --- |
| Hero headline | "Recognition people want to share." — never says what the product is | Rewritten; category named in the eyebrow, outcome in the h1 |
| Product proof | Drawn browser chrome labelled "Serenity studio" with a floating "84 recipients mapped" chip | Replaced with three real screenshots |
| Verification section | Nested **inside** the `EVENTS_ENABLED` gate, so it vanished with the flag off | Now its own always-on section |
| Use cases | Absent | Added (colleges, event organisers, companies, training providers) |
| Mobile navigation | None — links were `lg:flex` only, with no menu | Added, with `aria-expanded`, Escape, and scroll lock |
| Footer | One row of four links | Four-column footer with product and account groups |
| Light mode | Dark hero panel and dark bands dropped into a light page | One canvas per theme; a single deep section, used once, at the final CTA |
| Login vs signup | Identical full-height dark feature wall; login had a marketing panel it did not need | Login is form-only; signup gets a factual benefits panel |
| Auth chrome | No header, no footer, no route back to the site | Brand header, theme toggle, and footer on both |
| Firebase errors | Rate limits, network failures, blocked pop-ups surfaced raw or not at all | `describeAuthError` maps 19 codes to actionable text |
| Tiny text | 6–10px labels inside the hero mock | Gone with the mock; smallest text is now 13px |
| `/templates` | Crashed with "Something went wrong!" — the page landing CTAs linked to | `formatDate` hardened; covered by a unit test |

---

## 3. Product screenshots

Captured from the running application against the **local Firebase emulator**
(`demo-serenity`), signed in as the seeded `user-a@example.test` fixture.

| Asset | Shows | Size |
| --- | --- | --- |
| `public/product/editor.webp` | Certificate editor, A4 canvas, template variables | 1440×900, 37 KB |
| `public/product/mapping.webp` | Data Source panel: 6 records, 4 variables, row preview | 1440×900, 41 KB |
| `public/product/verification.webp` | Public verification page for one certificate | 900×1194, 40 KB |

All recipient data is synthetic (`Alex Example`, `Product Design Workshop`,
`Serenity Learning Studio`, July 2026). No production Firebase project was read
or written, no certificate was generated in production, no email was sent, no
media was uploaded, and no verification record was created outside the emulator.

Not yet captured, and therefore not claimed on the page: batch generation
progress, the dashboard, and the public template gallery. The dashboard's
emulator state showed an empty template list, and `/templates` sits behind the
protected-route guard, so neither would have been honest marketing evidence.

---

## 4. Truthfulness checks

Every product claim on the landing page was traced to code:

- Free allowance renders from `FREE_CERTIFICATE_LIMIT` (`= 5`), so the page
  cannot drift from the server-enforced limit.
- Export formats match `BatchGenerator` (`'pdf' | 'png' | 'both'`, zipped).
- Import formats match the file input (`.csv,.xlsx,.xls,.ods`).
- Email copy matches `api/email/send` (ownership check, verified sender,
  `DAILY_EMAIL_LIMIT`) and `api/email/bulk` (501 while
  `ENABLE_BULK_EMAIL_API` is unset).
- Verification copy matches the public projection in `api/verify/[id]`.
- Pro is described as a request, not a checkout, because no billing exists.

A Playwright guard fails on invented social proof: "trusted by N", star
ratings, user/customer/organisation counts, certificate totals, and "unlimited
certificates".

---

## 5. Gates run in this environment

| Gate | Result |
| --- | --- |
| `pnpm lint` | pass — no ESLint warnings or errors |
| `pnpm build` | pass — Next 14.2.35, 28/28 pages |
| `pnpm test` | pass — 9 files, 24 tests (was 8 / 21) |
| `pnpm test:rules` | pass — emulator, `demo-serenity` |
| `pnpm test:smoke` | pass — 9 routes 200, none 500 |
| `pnpm test:e2e` | pass — 100 passed, 52 skipped (staging-gated) |
| `git diff --check` | clean |

### Bundle sizes

| Route | Before | After |
| --- | --- | --- |
| `/` | 8.48 kB / 113 kB first load | 7.57 kB / 117 kB first load |
| `/login` | 1.63 kB / 208 kB | 1.24 kB / 207 kB |
| `/signup` | 1.8 kB / 208 kB | 2.48 kB / 208 kB |

The landing route's first-load JS grows ~4 kB because `next/image` is now on the
page. That buys responsive `srcset`, lazy loading below the fold, and modern
formats for three screenshots that would otherwise be unoptimised markup.

### Responsive

`scripts/capture-marketing-screens.mjs` drives all three pages at 1440×1000,
1280×900, 1024×768, 768×1024, 430×932, 390×844, and 360×800 in both themes —
42 states. Horizontal overflow: **0 px everywhere**. The same widths are
asserted in Playwright so a regression fails CI rather than a screenshot review.

---

## 6. Accessibility

Verified by automation and by inspection:

- Skip link to `#main`; `header`/`nav`/`main`/`footer` landmarks on all three
  pages (login and signup previously had only `main`).
- One `h1` per page; heading order runs h1 → h2 → h3 with no level skipped.
- Every form input has an `id`, a matching `<label for>`, and an `autocomplete`
  value; asserted in Playwright rather than reviewed by eye.
- Validation hints occupy a reserved row, so error text cannot push the control
  under the pointer.
- `:focus-visible` rings on buttons, links, and inputs; the mobile menu exposes
  `aria-expanded`, is labelled, and closes on Escape.
- Decorative motifs are `aria-hidden`; product screenshots carry descriptive
  alt text (asserted to be over 30 characters).
- `prefers-reduced-motion` disables the reveal, the workflow rail, and hover
  lift.
- Autofill styling is pinned so Chrome's yellow fill stays readable in dark
  mode.
- Touch targets on the marketing surfaces are ≥ 40 px; controls are 48 px.

**Limitation:** no axe/Lighthouse run and no screen-reader or manual keyboard
pass on real assistive technology. This is not a WCAG conformance claim.

---

## 7. Known gaps and decisions for a human

1. **Terms and Privacy pages do not exist.** Signup carries a plain-language
   acknowledgement of what Serenity stores, but no links, because linking to
   absent pages would 404 and inventing legal copy is not appropriate.
   *Requires a product decision.*
2. **`/templates` is behind the auth guard**, so the landing page describes
   template reuse and says browsing needs an account rather than promising a
   public gallery. If a public gallery is wanted, the route guard must change.
3. **Google is the only surfaced provider.** Whether a Firebase project has
   Google sign-in enabled is not visible to the client, so the button always
   renders and `auth/operation-not-allowed` is translated into a clear message.
   GitHub exists in `AuthContext` but is deliberately not surfaced.
4. **Theme default changed** from `dark` to `system` in the root layout. This
   affects every route for users with no stored preference.
5. **Dashboard/batch-generation screenshots are still missing** from the
   marketing assets, for the reasons in §3.

---

## 8. Safety

`main` untouched at `3399e99`. Nothing merged, pushed to `main`, deployed, or
promoted. No Firestore rules or indexes changed. `NEXT_PUBLIC_EVENTS_ENABLED`
and `ENABLE_BULK_EMAIL_API` remain `false`. No environment file is tracked. No
secret or Firebase configuration value appears in any commit, screenshot, or
document. All Firebase interaction in this run went to the local emulator on a
`demo-` project; the production project was not contacted, so no test account
was created there and no production record was read or modified.

---

## Second pass — runtime audit (2026-07-29)

The first pass was verified largely by construction. This pass drove the built
pages in a real browser and measured them, which surfaced four defects that
source review had missed.

### 9. Defects found by running the pages

| # | Defect | Evidence | Fix |
| - | ------ | -------- | --- |
| 1 | The mobile menu button rendered as an **empty outline** — no hamburger icon — at every phone width. `.sr-btn`'s `padding-inline: 1.25rem` ties with Tailwind's `px-0` on specificity and wins on source order, so a `w-10` button had a **zero-width content box** and the SVG collapsed to `0x20`. | measured `svgBox: "0x20"` | Added an `.sr-btn-icon` variant that owns its own width and zero padding. The same dead `w-9 px-0` pattern in the pricing dialog's close button was fixed with it. |
| 2 | "Start free" in the header **wrapped onto two lines** at 360-390px: the flex row squeezed it from its natural 113px down to 79px. | measured at 360/390/430 | Below `sm` the theme toggle and "Sign in" move into the menu panel; the CTA is `shrink-0 whitespace-nowrap`. |
| 3 | `--sr-ink-faint` (`#74819E`) measured **3.64-3.9:1** on the light canvases, under the 4.5:1 that 13px hint text needs. Footer hints, pricing captions, and shot captions all failed WCAG AA. | axe-core, 8 nodes | Darkened to `92 103 128`: 5.3:1 on the subtle canvas, 5.7:1 on white. Dark mode already passed and is unchanged. |
| 4 | The FAQ's `<dt>`/`<dd>` pairs sat **two divs deep** inside the `<dl>` (reveal wrapper plus padding wrapper), which detaches them from the list for assistive technology. | axe-core, 15 nodes | The reveal wrapper *is* the group div now. |

Two further inconsistencies were corrected while there. The marketing nav's
brand link carried a **mojibake em dash** in its `aria-label`, so screen readers
announced the encoding artefact. And the theme toggle used the application's
amber-to-rose gradient, which read as a different product beside the indigo
marketing palette; inside `.sr-scope` it is now a neutral track with the brand
on the active knob. The authenticated app's own toggle is untouched.

Two refinements, not defects: single-column auth pages sat in a band of dead
space on tall viewports and now use `align-items: safe center`, which degrades
to top alignment rather than making a tall card unreachable. And the light
product screenshots are framed and dimmed 6% in dark mode so they stop glaring
against the near-black canvas.

### 10. Accessibility — automated coverage added

The first pass recorded "no axe/Lighthouse run" as a limitation. That gap is
closed: `@axe-core/playwright` (dev dependency) now scans the landing page,
login, and signup at 1440x1000 and 390x844 in **both** themes, plus the open
mobile menu — 13 scans against `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

Findings on entry: **23 violation nodes across 3 rules** (`color-contrast`,
`definition-list`, `dlitem`), all rated serious. Findings now: **zero**.

**This is still not a WCAG conformance claim.** axe covers roughly a third of
WCAG criteria. No screen-reader pass, no manual keyboard pass on real assistive
technology, and no Lighthouse run has been performed.

### 11. Regression guards added

- The header CTA must not be squeezed or clipped at 360/390/430px.
- The mobile menu button must contain an icon wider than 12px.

Both fail against the code as it stood before this pass.

### 12. Gates re-run (2026-07-29)

| Gate | Result |
| ---- | ------ |
| `pnpm lint` | pass |
| `pnpm build` | pass — 28/28 pages |
| `pnpm test` | pass — 9 files, 24 tests |
| `pnpm test:rules` | pass — 2 files, 8 tests, emulator on `demo-serenity` |
| `pnpm test:smoke` | pass — 9 routes 200 |
| `pnpm test:e2e` | pass — **134 passed**, 52 skipped (staging-gated) |
| `git diff --check` | clean |

Bundle sizes held: `/` 7.63 kB / **117 kB** first load, `/login` 1.24 kB /
**207 kB**, `/signup` 2.48 kB / **208 kB**. Horizontal overflow remains 0px
across all 42 captured states.

The rules emulator's default port 8080 was occupied by an unrelated local
process, so that suite was run on alternate ports via a temporary, untracked
config. No committed configuration changed.

### 13. Firebase testing performed

The operator permitted limited login/signup testing against the existing
project. What was actually done, and why:

- **Performed:** one sign-in attempt against the configured project using
  `serenity-qa-does-not-exist@example.invalid`, an address that cannot exist.
  Firebase rejected it before any write. This confirmed the client is wired
  correctly, that `describeAuthError` renders *"Invalid email or password"*
  rather than a raw `auth/...` code, and that the page stays on `/login`.
  **No account was created, no record was read or modified, no email was sent.**
- **Deliberately not performed:** account creation. Signup writes a permanent
  `users/{uid}` document to the production project, a test account there is not
  distinguishable from a real user, and cleanup is explicitly out of scope — so
  there would be no way to remove it afterwards. Per this run's own instruction,
  the UI was validated without completing account creation and the limitation is
  recorded here. Full signup acceptance still needs the isolated staging project
  described in `STAGING_SETUP.md`.

Everything else was validated against a local production build started with
**placeholder** Firebase config, which reaches no backend at all.
