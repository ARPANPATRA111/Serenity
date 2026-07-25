import { test } from '@playwright/test';

/**
 * Editor correctness + generation — STAGING ONLY.
 *
 * The editor needs an authenticated staging session and Fabric canvas
 * interaction. Marked `fixme` until E2E_BASE_URL points at verified
 * staging. Invariants here are partly covered by unit tests
 * (verificationUrl, templateInvariants, alignmentGuides).
 */
test.describe('editor + generation (staging only)', () => {
  test.fixme('undo/redo and Ctrl/Cmd shortcuts behave across object ops', async () => {});
  test.fixme('mandatory verification URL cannot be deleted and survives save/load', async () => {});
  test.fixme('QR matches the visible verification URL and exports readably', async () => {});
  test.fixme('alignment guides never serialize into saved JSON or exports', async () => {});
  test.fixme('save/load fidelity for legacy + new templates (fonts, QR, background)', async () => {});
  test.fixme('CSV/Excel import maps columns and generates one certificate per row', async () => {});
  test.fixme('PDF/PNG/ZIP export succeeds for 5 and 50 rows', async () => {});
  test.fixme('mobile editor controls are reachable at 390px with no page overflow', async () => {});
});
