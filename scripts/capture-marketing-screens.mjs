/**
 * Marketing/auth visual QA capture.
 *
 * Drives a locally running production build with Playwright and records
 * screenshots plus layout diagnostics for the public landing page and the
 * authentication pages at every supported breakpoint, in both themes.
 *
 * The server it points at must be started with placeholder Firebase config
 * (see playwright.config.ts) so no backend is contacted.
 *
 *   node scripts/capture-marketing-screens.mjs
 *
 * Environment:
 *   MARKETING_QA_BASE_URL  default http://127.0.0.1:3210
 *   MARKETING_QA_OUTPUT    default %TEMP%/serenity-marketing-qa
 *   MARKETING_QA_LABEL     subfolder name, e.g. "before" or "after"
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.MARKETING_QA_BASE_URL || 'http://127.0.0.1:3210';
const label = process.env.MARKETING_QA_LABEL || 'current';
const outputRoot = process.env.MARKETING_QA_OUTPUT
  || path.join(process.env.TEMP || process.cwd(), 'serenity-marketing-qa');
const outputDir = path.join(outputRoot, label);

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000, full: true },
  { name: '1280x900', width: 1280, height: 900, full: false },
  { name: '1024x768', width: 1024, height: 768, full: false },
  { name: '768x1024', width: 768, height: 1024, full: false },
  { name: '430x932', width: 430, height: 932, full: false, mobile: true },
  { name: '390x844', width: 390, height: 844, full: true, mobile: true },
  { name: '360x800', width: 360, height: 800, full: false, mobile: true },
];

const pages = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
];

const themes = ['light', 'dark'];

function diagnostics() {
  const root = document.documentElement;
  const overflow = root.scrollWidth - root.clientWidth;
  const offenders = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > root.clientWidth + 1 || rect.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
        if (offenders.length >= 8) break;
      }
    }
  }

  const tiny = [];
  for (const el of document.querySelectorAll('p, span, li, a, dd, dt, label')) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    if (size && size < 12 && (el.textContent || '').trim().length > 12) {
      tiny.push({ size, text: (el.textContent || '').trim().slice(0, 40) });
      if (tiny.length >= 6) break;
    }
  }

  const heading = document.querySelector('h1');
  const targets = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.height < 24 || rect.width < 24) {
      targets.push({
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
      if (targets.length >= 6) break;
    }
  }

  return {
    title: document.title,
    theme: root.className,
    scrollHeight: root.scrollHeight,
    overflow,
    offenders,
    tinyText: tiny,
    smallTargets: targets,
    h1: heading ? (heading.textContent || '').trim().slice(0, 160) : null,
    h1FontSize: heading ? getComputedStyle(heading).fontSize : null,
    headings: [...document.querySelectorAll('h1, h2')]
      .map((node) => `${node.tagName}: ${(node.textContent || '').trim().slice(0, 90)}`),
    landmarks: {
      header: document.querySelectorAll('header').length,
      nav: document.querySelectorAll('nav').length,
      main: document.querySelectorAll('main').length,
      footer: document.querySelectorAll('footer').length,
    },
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.75, 480);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

const report = {};
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const theme of themes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: Boolean(viewport.mobile),
        hasTouch: Boolean(viewport.mobile),
        colorScheme: theme,
      });
      await context.addInitScript((value) => {
        try {
          window.localStorage.setItem('theme', value);
        } catch {
          /* storage unavailable */
        }
      }, theme);

      const page = await context.newPage();
      for (const target of pages) {
        const key = `${target.name}-${viewport.name}-${theme}`;
        try {
          await page.goto(`${baseURL}${target.path}`, { waitUntil: 'networkidle', timeout: 45_000 });
          await page.waitForTimeout(1200);
          await settle(page);
          await page.screenshot({ path: path.join(outputDir, `${key}.png`) });
          if (viewport.full) {
            await page.screenshot({ path: path.join(outputDir, `${key}-full.png`), fullPage: true });
          }
          report[key] = await page.evaluate(diagnostics);
        } catch (error) {
          report[key] = { error: String(error).slice(0, 240) };
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

const failures = Object.entries(report).filter(([, value]) => value.error || value.overflow > 1);
console.log(`captured ${Object.keys(report).length} states into ${outputDir}`);
console.log(failures.length === 0
  ? 'no horizontal overflow detected'
  : `ISSUES: ${failures.map(([key, value]) => `${key} (${value.error ? 'error' : `overflow ${value.overflow}px`})`).join(', ')}`);
