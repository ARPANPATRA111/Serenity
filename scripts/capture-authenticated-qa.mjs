import fs from 'node:fs';
import path from 'node:path';

const cdpPort = process.env.CDP_PORT || '9228';
const baseUrl = process.env.VISUAL_QA_BASE_URL || 'http://127.0.0.1:3000';
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
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || 'Browser evaluation failed.');
    }
    return response.result.value;
  };

  const navigate = async (pathname, wait = 2600) => {
    await send('Page.navigate', { url: `${baseUrl}${pathname}` });
    await delay(wait);
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

  const capture = async (name, fullPage = false) => {
    const response = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: fullPage,
    });
    fs.writeFileSync(path.join(outputDir, name), Buffer.from(response.data, 'base64'));
  };

  const loadTheme = async (theme) => {
    await evaluate(`localStorage.setItem('theme', ${JSON.stringify(theme)})`);
    await send('Page.reload', { ignoreCache: true });
    await delay(3200);
  };

  fs.mkdirSync(outputDir, { recursive: true });
  await send('Page.enable');
  await setMetrics(1440, 1000);

  await navigate('/login', 5200);
  await loadTheme('dark');
  await capture('login-desktop-dark.png');
  await loadTheme('light');
  await capture('login-desktop-light.png');

  await navigate('/signup', 3200);
  await capture('signup-desktop-light.png');
  await loadTheme('dark');
  await capture('signup-desktop-dark.png');

  await navigate('/login', 3200);
  const submitted = await evaluate(`(() => {
    const email = document.querySelector('#login-email');
    const password = document.querySelector('#login-password');
    const form = email?.closest('form');
    if (!(email instanceof HTMLInputElement)
      || !(password instanceof HTMLInputElement)
      || !(form instanceof HTMLFormElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(email, 'user-a@example.test');
    email.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(password, 'Test-only-123!');
    password.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);

  const loginDeadline = Date.now() + 16_000;
  let location = '';
  do {
    await delay(500);
    location = await evaluate('location.pathname');
  } while (location !== '/dashboard' && Date.now() < loginDeadline);
  if (location !== '/dashboard') {
    const error = await evaluate(`document.querySelector('[role="alert"]')?.textContent || ''`);
    throw new Error(`Emulator login did not reach the dashboard. ${error}`);
  }

  await delay(5000);
  const dashboardDark = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    path: location.pathname,
    brand: document.querySelector('nav a[href="/"]')?.textContent?.trim() || '',
    headings: [...document.querySelectorAll('main h1, main h2')].map((item) => item.textContent?.trim()),
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyHeight: document.documentElement.scrollHeight
  })`));
  await capture('dashboard-desktop-dark-full.png', true);

  await loadTheme('light');
  const dashboardLight = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    path: location.pathname,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  })`));
  await capture('dashboard-desktop-light-full.png', true);

  await setMetrics(390, 844, true);
  await delay(900);
  const dashboardMobile = JSON.parse(await evaluate(`JSON.stringify({
    theme: document.documentElement.className,
    path: location.pathname,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  })`));
  await capture('dashboard-mobile-light.png');

  console.log(JSON.stringify({
    outputDir,
    submitted,
    dashboardDark,
    dashboardLight,
    dashboardMobile,
  }, null, 2));
  await delay(100);
  socket.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
