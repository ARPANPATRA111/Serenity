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
