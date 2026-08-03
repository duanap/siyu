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
    this.listeners = new Map();
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
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

const user = {
  id: 'user-owner',
  avatarUrl: null,
  nickname: '小宇',
  email: 'xiaoyu@example.com',
  timezone: 'Asia/Shanghai',
  status: 'ACTIVE',
  roles: ['USER'],
  permissions: [],
};
const ledger = {
  id: '00000000-0000-4000-8000-000000000010',
  type: 'PERSONAL',
  name: '个人账本',
  ownerUserId: user.id,
  status: 'ACTIVE',
  members: [
    {
      userId: user.id,
      role: 'OWNER',
      joinedAt: '2026-08-01T00:00:00.000Z',
      nickname: user.nickname,
      avatarUrl: null,
    },
  ],
};
const entries = [
  {
    id: 'entry-lunch',
    ledgerId: ledger.id,
    type: 'EXPENSE',
    amountCent: 3250,
    businessDate: '2026-08-03',
    note: '午餐',
    paymentMethod: 'WECHAT',
    sourceType: 'MANUAL',
    creator: { id: user.id, nickname: user.nickname, avatarUrl: null },
    category: { id: 'food', name: '餐饮', icon: 'food', color: '#F08A3C', isEnabled: true },
    createdAt: '2026-08-03T04:00:00.000Z',
    updatedAt: '2026-08-03T04:00:00.000Z',
    version: 1,
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'entry-salary',
    ledgerId: ledger.id,
    type: 'INCOME',
    amountCent: 800000,
    businessDate: '2026-08-03',
    note: '工资',
    paymentMethod: 'BANK_CARD',
    sourceType: 'SALARY',
    creator: { id: user.id, nickname: user.nickname, avatarUrl: null },
    category: { id: 'salary', name: '工资', icon: 'salary', color: '#24A875', isEnabled: true },
    createdAt: '2026-08-03T02:00:00.000Z',
    updatedAt: '2026-08-03T02:00:00.000Z',
    version: 1,
    canEdit: true,
    canDelete: true,
  },
  {
    id: 'entry-market',
    ledgerId: ledger.id,
    type: 'EXPENSE',
    amountCent: 12680,
    businessDate: '2026-08-02',
    note: '超市',
    paymentMethod: 'ALIPAY',
    sourceType: 'MANUAL',
    creator: { id: user.id, nickname: user.nickname, avatarUrl: null },
    category: { id: 'daily', name: '生活', icon: 'shopping', color: '#F08A3C', isEnabled: true },
    createdAt: '2026-08-02T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z',
    version: 1,
    canEdit: true,
    canDelete: true,
  },
];

function envelope(data) {
  return JSON.stringify({ success: true, data, requestId: 'task027-browser-qa' });
}

function mockData(url) {
  const target = new URL(url);
  const path = target.pathname;
  if (path.endsWith('/auth/refresh'))
    return { accessToken: 'task027-token', expiresIn: 3600, user };
  if (path.endsWith('/auth/capabilities'))
    return { emailPassword: true, registration: true, qqOAuth: false, passwordReset: true };
  if (path.endsWith('/ledgers')) return { items: [ledger] };
  if (path.endsWith('/statistics/overview'))
    return {
      ledgerId: ledger.id,
      ledgerType: ledger.type,
      month: '2026-08',
      incomeCent: 800000,
      expenseCent: 473200,
      balanceCent: 326800,
      averageDailyExpenseCent: 15264,
      largestExpenseCent: 12680,
      entryCount: entries.length,
    };
  if (path.endsWith('/entries'))
    return { items: entries, page: 1, pageSize: 5, total: entries.length, hasNext: false };
  if (path.endsWith('/recurring-runs'))
    return {
      items: [
        {
          id: 'run-1',
          status: 'PENDING',
          rule: { ledgerId: ledger.id },
        },
        {
          id: 'run-2',
          status: 'PENDING',
          rule: { ledgerId: ledger.id },
        },
      ],
      page: 1,
      pageSize: 100,
      total: 2,
      hasNext: false,
    };
  if (path.endsWith('/debts'))
    return {
      items: [
        {
          id: 'debt-1',
          status: 'ACTIVE',
          direction: 'BORROWED',
          dueDate: '2026-08-08',
          overdueDays: 0,
          remainingCent: 10000,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
      hasNext: false,
    };
  if (path.endsWith('/notifications'))
    return { items: [], page: 1, pageSize: 1, total: 0, hasNext: false, unreadCount: 3 };
  throw new Error(`没有为浏览器 QA 配置接口：${target.pathname}${target.search}`);
}

async function targetPage(cdpUrl) {
  const response = await fetch(new URL('/json/list', cdpUrl));
  if (!response.ok) throw new Error(`无法读取 Chrome CDP 页面：HTTP ${response.status}`);
  const targets = await response.json();
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('Chrome CDP 没有可用页面');
  return page.webSocketDebuggerUrl;
}

async function waitForPage(session, expectedText) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await session.send('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && document.body.innerText.includes(${JSON.stringify(expectedText)})`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`页面未在超时内出现：${expectedText}`);
}

async function waitForReady(session) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await session.send('Runtime.evaluate', {
      expression: `document.readyState === 'complete'`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('页面未在超时内加载完成');
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
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            cssHeight: style.height,
            parentHeight: Math.round((element.parentElement?.getBoundingClientRect().height ?? 0) * 10) / 10,
          };
        });
      return {
        path: location.pathname,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        activeNav: document.querySelector('[aria-current="page"]')?.textContent?.trim(),
        navItems: document.querySelectorAll('nav[aria-label="主要导航"] a').length,
        undersized: visibleControls.filter((item) => item.width < 43.5 || item.height < 43.5),
      };
    })()`,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    'cdp-url': 'string',
    'base-url': 'string',
    'screenshot-dir': 'string',
  });
  const cdpUrl = new URL(args['cdp-url'] ?? 'http://127.0.0.1:9224');
  if (cdpUrl.protocol !== 'http:' || !isLoopbackHost(cdpUrl.hostname))
    throw new Error('Chrome CDP 必须为本机 HTTP 地址');
  const baseUrl = new URL(args['base-url'] ?? 'http://127.0.0.1:4173');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || !isLoopbackHost(baseUrl.hostname))
    throw new Error('浏览器 QA 仅允许本机预览地址');
  let screenshotDirectory = assertPathOutsideRepository(
    resolve(args['screenshot-dir'] ?? '/tmp/siyu-task027-qa'),
    '截图目录',
  );
  await mkdir(screenshotDirectory, { recursive: true });
  screenshotDirectory = await canonicalPathOutsideRepository(screenshotDirectory, '截图目录');

  const session = new CdpSession(await targetPage(cdpUrl));
  await session.open();
  const consoleErrors = [];
  const requestFailures = [];
  session.on('Runtime.exceptionThrown', (params) =>
    consoleErrors.push(params.exceptionDetails?.text ?? '页面异常'),
  );
  session.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error')
      consoleErrors.push(params.args?.map((item) => item.value ?? item.description).join(' '));
  });
  session.on('Network.loadingFailed', (params) => requestFailures.push(params.errorText));
  session.on('Fetch.requestPaused', async (params) => {
    try {
      const data = mockData(params.request.url);
      await session.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
        body: Buffer.from(envelope(data)).toString('base64'),
      });
    } catch (error) {
      requestFailures.push(error instanceof Error ? error.message : String(error));
      await session.send('Fetch.failRequest', {
        requestId: params.requestId,
        errorReason: 'Failed',
      });
    }
  });

  try {
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Network.enable');
    await session.send('Fetch.enable', {
      patterns: [{ urlPattern: '*/api/v1/*', requestStage: 'Request' }],
    });

    const matrix = [
      { route: '/home?ledger=personal&month=2026-08', name: 'home', text: '近期需要处理' },
      { route: '/account', name: 'account', text: '外观与隐私' },
    ];
    const viewports = [
      { width: 320, height: 800, theme: 'light' },
      { width: 375, height: 812, theme: 'light' },
      { width: 426, height: 927, theme: 'light' },
      { width: 480, height: 900, theme: 'light' },
      { width: 375, height: 812, theme: 'dark' },
    ];
    const results = [];
    for (const page of matrix) {
      for (const viewport of viewports) {
        await session.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: true,
        });
        await session.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: viewport.theme }],
        });
        await session.send('Page.navigate', { url: new URL('/', baseUrl).href });
        await waitForReady(session);
        await session.send('Runtime.evaluate', {
          expression: `localStorage.setItem('siyu-theme', ${JSON.stringify(viewport.theme)}); localStorage.removeItem('siyu-amount-hidden')`,
        });
        await session.send('Page.navigate', { url: new URL(page.route, baseUrl).href });
        await waitForPage(session, page.text);
        const state = await evaluatePage(session);
        if (state.scrollWidth > state.viewportWidth)
          throw new Error(`${page.name} ${viewport.width}px ${viewport.theme} 横向溢出`);
        if (state.navItems !== 5)
          throw new Error(`${page.name} ${viewport.width}px ${viewport.theme} 底部导航不是 5 项`);
        if (state.undersized.length)
          throw new Error(
            `${page.name} ${viewport.width}px ${viewport.theme} 存在小于 44px 的交互区：${JSON.stringify(state.undersized)}`,
          );
        const screenshot = await session.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
        const file = resolve(
          screenshotDirectory,
          `${page.name}-${viewport.width}-${viewport.theme}.png`,
        );
        await writeFile(file, Buffer.from(screenshot.data, 'base64'));
        results.push({ ...state, theme: viewport.theme, screenshot: file });
      }
    }

    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await session.send('Page.navigate', {
      url: new URL('/home?ledger=personal&month=2026-08', baseUrl).href,
    });
    await waitForPage(session, '近期需要处理');
    const interactionClick = await session.send('Runtime.evaluate', {
      expression: `(() => {
        const button = document.querySelector('button[aria-label="隐藏首页金额"]');
        button?.click();
        return Boolean(button);
      })()`,
      returnByValue: true,
    });
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const interaction = await session.send('Runtime.evaluate', {
      expression: `({
        clicked: ${Boolean(interactionClick.result?.value)},
        hiddenStored: localStorage.getItem('siyu-amount-hidden'),
        hiddenTextVisible: document.body.innerText.includes('••••••'),
      })`,
      returnByValue: true,
    });
    if (
      !interaction.result?.value?.clicked ||
      interaction.result.value.hiddenStored !== 'true' ||
      !interaction.result.value.hiddenTextVisible
    )
      throw new Error('首页金额隐藏交互未通过');
    if (consoleErrors.length || requestFailures.length)
      throw new Error(
        `浏览器控制台或请求存在错误：${JSON.stringify({ consoleErrors, requestFailures })}`,
      );
    process.stdout.write(
      `${JSON.stringify({ ok: true, results, interaction: interaction.result.value }, null, 2)}\n`,
    );
  } finally {
    session.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
