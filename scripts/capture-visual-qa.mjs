import fs from 'node:fs';
import path from 'node:path';

const cdpPort = process.env.CDP_PORT || '9224';
const baseUrl = process.env.VISUAL_QA_BASE_URL || 'http://127.0.0.1:3100';
const outputDir = process.env.VISUAL_QA_OUTPUT
  || path.join(process.env.TEMP || process.cwd(), 'serenity-visual-qa');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getDebugPage() {
  let pages;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
      break;
    } catch {
      await delay(250);
    }
  }

  const page = pages?.find((item) => item.type === 'page' && item.url === 'about:blank')
    || pages?.find((item) => item.type === 'page' && item.url.startsWith(baseUrl))
    || pages?.find((item) => item.type === 'page');

  if (!page) throw new Error('No browser page is available through the DevTools endpoint.');
  return page;
}

async function run() {
  const page = await getDebugPage();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  };
  socket.onclose = () => {
    for (const task of pending.values()) {
      task.reject(new Error('The browser closed the DevTools connection during visual QA.'));
    }
    pending.clear();
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return response.result.value;
  };

  fs.mkdirSync(outputDir, { recursive: true });

  const capture = async (name, fullPage = true) => {
    const response = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: fullPage,
    });
    fs.writeFileSync(path.join(outputDir, name), Buffer.from(response.data, 'base64'));
  };

  const setMetrics = (width, height, mobile = false) => send(
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    },
  );

  const navigate = async (pathname) => {
    await send('Page.navigate', { url: `${baseUrl}${pathname}` });
    await delay(2400);
  };

  const reload = async () => {
    await send('Page.reload', { ignoreCache: true });
    await delay(2400);
  };

  const toggleTheme = async () => {
    const clicked = await evaluate(`(() => {
      const button = document.querySelector('.theme-toggle-button');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await delay(850);
    return clicked;
  };

  const primePage = async () => {
    await evaluate(`(async () => {
      const pageHeight = document.documentElement.scrollHeight;
      const step = Math.max(Math.round(innerHeight * 0.72), 480);
      for (let offset = 0; offset < pageHeight; offset += step) {
        scrollTo({ top: offset, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      scrollTo({ top: 0, behavior: 'instant' });
      document.querySelectorAll('.landing-reveal').forEach((element) => {
        element.classList.add('is-visible');
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    })()`);
  };

  await send('Page.enable');
  await setMetrics(1440, 1000);
  await navigate('/');
  await primePage();
  await capture('landing-desktop-dark-full.png');
  const desktopDark = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewTransitions: Boolean(document.startViewTransition)
  })`));

  await toggleTheme();
  const desktopLight = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    stored: localStorage.getItem('theme')
  })`));
  await reload();
  await primePage();
  await capture('landing-desktop-light-full.png');

  const modalOpened = await evaluate(`(() => {
    document.getElementById('pricing')?.scrollIntoView({ block: 'center' });
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('Discuss Pro access'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await delay(500);
  const modalGeometryText = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"] .modal-content');
    const nav = document.querySelector('header nav');
    if (!dialog || !nav) return '';
    const dialogBounds = dialog.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    return JSON.stringify({
      dialogTop: Math.round(dialogBounds.top),
      navBottom: Math.round(navBounds.bottom),
      gap: Math.round(dialogBounds.top - navBounds.bottom),
      dialogBottom: Math.round(dialogBounds.bottom),
      viewport: innerHeight
    });
  })()`);
  const modalGeometry = modalGeometryText ? JSON.parse(modalGeometryText) : null;
  await capture('pricing-dialog-light.png', false);
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
  });
  await delay(250);

  await setMetrics(390, 844, true);
  await navigate('/');
  await primePage();
  await capture('landing-mobile-light.png', false);
  const mobileLight = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  })`));
  await toggleTheme();
  await reload();
  await primePage();
  await capture('landing-mobile-dark.png', false);
  const mobileDark = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  })`));

  await setMetrics(1440, 1000);
  await navigate('/login');
  await delay(3500);
  await capture('login-desktop-dark.png', false);
  await toggleTheme();
  await reload();
  await capture('login-desktop-light.png', false);

  socket.close();
  console.log(JSON.stringify({
    outputDir,
    desktopDark,
    desktopLight,
    modalOpened,
    modalGeometry,
    mobileLight,
    mobileDark,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
