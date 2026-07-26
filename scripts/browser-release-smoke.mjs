import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

import {
  assertPathOutsideRepository,
  canonicalPathOutsideRepository,
  isLoopbackHost,
  parseCliArguments,
} from './release-utils.mjs';

class CdpSession {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = (this.sequence += 1);
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForPage(session, theme) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await session.send('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && document.documentElement.dataset.theme === ${JSON.stringify(theme)} && document.body.innerText.includes('四时有余')`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`页面未在超时内完成 ${theme} 主题渲染`);
}

async function waitForUrl(session, url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await session.send('Runtime.evaluate', {
      expression: `location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`页面未在超时内加载：${url}`);
}

async function evaluatePage(session) {
  const result = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const visibleControls = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('name') || '').trim().slice(0, 40),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          };
        });
      return {
        title: document.title,
        theme: document.documentElement.dataset.theme,
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brandPresent: document.body.innerText.includes('四时有余'),
        undersized: visibleControls.filter((item) => item.width < 43.5 || item.height < 43.5),
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.value;
}

async function targetPage(cdpUrl) {
  const response = await fetch(new URL('/json/list', cdpUrl));
  if (!response.ok) throw new Error(`无法读取 Chrome CDP 页面：HTTP ${response.status}`);
  const targets = await response.json();
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('Chrome CDP 没有可用页面');
  return page.webSocketDebuggerUrl;
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    'cdp-url': 'string',
    'base-url': 'string',
    'screenshot-dir': 'string',
  });
  const cdpUrl = new URL(args['cdp-url'] ?? 'http://127.0.0.1:9223');
  if (cdpUrl.protocol !== 'http:' || !isLoopbackHost(cdpUrl.hostname)) {
    throw new Error('Chrome CDP 必须为本机 HTTP 地址');
  }
  const baseUrl =
    args['base-url'] && URL.canParse(args['base-url']) ? new URL(args['base-url']) : undefined;
  if (
    !baseUrl ||
    !['http:', 'https:'].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error('必须提供不含凭据的 HTTP(S) --base-url');
  }
  let screenshotDirectory = args['screenshot-dir']
    ? assertPathOutsideRepository(resolve(args['screenshot-dir']), '截图目录')
    : undefined;
  if (screenshotDirectory) {
    await mkdir(screenshotDirectory, { recursive: true });
    screenshotDirectory = await canonicalPathOutsideRepository(screenshotDirectory, '截图目录');
  }

  const session = new CdpSession(await targetPage(cdpUrl));
  await session.open();
  try {
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    const matrix = [];
    for (const width of [320, 375, 480]) {
      for (const theme of ['light', 'dark']) {
        await session.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: width === 320 ? 800 : width === 375 ? 812 : 900,
          deviceScaleFactor: 1,
          mobile: true,
        });
        await session.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: theme }],
        });
        const targetUrl = new URL('/login', baseUrl).href;
        await session.send('Page.navigate', { url: targetUrl });
        await waitForUrl(session, targetUrl);
        await session.send('Runtime.evaluate', {
          expression: `localStorage.setItem('siyu-theme', ${JSON.stringify(theme)})`,
        });
        await session.send('Page.reload');
        await waitForPage(session, theme);
        const result = await evaluatePage(session);
        if (!result?.brandPresent) throw new Error(`${width}px ${theme} 缺少正式品牌`);
        if (result.scrollWidth > result.viewportWidth) {
          throw new Error(
            `${width}px ${theme} 横向溢出：${result.scrollWidth} > ${result.viewportWidth}`,
          );
        }
        if (result.undersized.length > 0) {
          throw new Error(
            `${width}px ${theme} 存在小于 44px 的交互区：${JSON.stringify(result.undersized)}`,
          );
        }
        if (screenshotDirectory) {
          const screenshot = await session.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
          });
          await writeFile(
            resolve(screenshotDirectory, `login-${width}-${theme}.png`),
            Buffer.from(screenshot.data, 'base64'),
          );
        }
        matrix.push({ width, theme, title: result.title, controls: '>=44px', overflow: false });
      }
    }
    process.stdout.write(`${JSON.stringify({ ok: true, matrix }, null, 2)}\n`);
  } finally {
    session.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
