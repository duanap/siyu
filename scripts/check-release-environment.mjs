import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  parseCliArguments,
  parseDatabaseUrl,
  readEnvironmentFile,
  safeUrlSummary,
} from './release-utils.mjs';

const developmentSecrets = new Set([
  'siyu-test-only-jwt-secret-change-me',
  'siyu-local-compose-jwt-secret-change-me-now',
  'siyu-native-local-jwt-secret-change-me',
]);
const placeholder = /(?:change[-_ ]?me|replace|example|placeholder|your[-_]|待填写|替换)/i;

function validHttpsOrigin(value) {
  if (!value || placeholder.test(value) || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.origin !== value) {
    return undefined;
  }
  return url;
}

function presentSecret(value) {
  return Boolean(value && !placeholder.test(value));
}

function booleanFlag(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function inspectReleaseEnvironment(environment, mode) {
  const checks = [];
  const add = (code, ok, message) => checks.push({ code, ok, message });

  add('MODE', ['native', 'compose'].includes(mode), '运行模式必须显式为 native 或 compose');
  add('NODE_ENV', environment.NODE_ENV === 'production', 'NODE_ENV 必须为 production');
  const profile = environment.SIYU_DEPLOYMENT_PROFILE;
  add(
    'DEPLOYMENT_PROFILE',
    ['personal', 'public'].includes(profile),
    'SIYU_DEPLOYMENT_PROFILE 必须显式为 personal 或 public',
  );
  const registrationEnabled = booleanFlag(environment.SIYU_REGISTRATION_ENABLED);
  add(
    'REGISTRATION_FEATURE',
    registrationEnabled !== undefined && (profile !== 'public' || registrationEnabled),
    profile === 'public'
      ? 'public 档案必须启用新账号注册'
      : 'SIYU_REGISTRATION_ENABLED 必须显式为 true 或 false',
  );

  const secret = environment.JWT_SECRET ?? '';
  add(
    'JWT_SECRET',
    secret.length >= 32 && !developmentSecrets.has(secret) && !placeholder.test(secret),
    'JWT_SECRET 必须为至少 32 字符的独立强随机值',
  );
  add('COOKIE_SECURE', environment.SIYU_COOKIE_SECURE === 'true', 'SIYU_COOKIE_SECURE 必须为 true');

  const publicUrl = validHttpsOrigin(environment.SIYU_PUBLIC_URL);
  add('PUBLIC_URL', Boolean(publicUrl), 'SIYU_PUBLIC_URL 必须为无路径的 HTTPS Origin');

  let adminUrl;
  if (environment.SIYU_ADMIN_URL && URL.canParse(environment.SIYU_ADMIN_URL)) {
    adminUrl = new URL(environment.SIYU_ADMIN_URL);
  }
  add(
    'ADMIN_URL',
    Boolean(
      publicUrl &&
      adminUrl &&
      adminUrl.protocol === 'https:' &&
      adminUrl.origin === publicUrl.origin &&
      adminUrl.pathname === '/admin/' &&
      !adminUrl.search &&
      !adminUrl.hash &&
      !placeholder.test(environment.SIYU_ADMIN_URL),
    ),
    'SIYU_ADMIN_URL 必须为公开域名同源的 /admin/',
  );
  add(
    'CORS_ORIGINS',
    Boolean(publicUrl && environment.SIYU_CORS_ORIGINS === publicUrl.origin),
    '生产 SIYU_CORS_ORIGINS 必须只包含公开 HTTPS Origin',
  );

  let databaseOk = false;
  try {
    parseDatabaseUrl(environment.DATABASE_URL ?? '');
    databaseOk = !placeholder.test(environment.DATABASE_URL ?? '');
  } catch {
    databaseOk = false;
  }
  add('DATABASE_URL', databaseOk, 'DATABASE_URL 必须为完整 PostgreSQL URL');

  let redisOk = false;
  if (environment.REDIS_URL && URL.canParse(environment.REDIS_URL)) {
    const redis = new URL(environment.REDIS_URL);
    redisOk =
      ['redis:', 'rediss:'].includes(redis.protocol) &&
      Boolean(redis.hostname) &&
      !placeholder.test(environment.REDIS_URL);
  }
  add('REDIS_URL', redisOk, 'REDIS_URL 必须为完整 Redis/Valkey URL');

  const qqValues = [
    environment.SIYU_QQ_CLIENT_ID,
    environment.SIYU_QQ_CLIENT_SECRET,
    environment.SIYU_QQ_CALLBACK_URL,
  ];
  let qqCallback;
  if (environment.SIYU_QQ_CALLBACK_URL && URL.canParse(environment.SIYU_QQ_CALLBACK_URL)) {
    qqCallback = new URL(environment.SIYU_QQ_CALLBACK_URL);
  }
  const qqEnabled = booleanFlag(environment.SIYU_QQ_AUTH_ENABLED);
  add(
    'QQ_FEATURE',
    qqEnabled !== undefined && (profile !== 'public' || qqEnabled),
    profile === 'public'
      ? 'public 档案必须启用 QQ 登录'
      : 'SIYU_QQ_AUTH_ENABLED 必须显式为 true 或 false',
  );
  add(
    'QQ_CREDENTIALS',
    qqEnabled === true ? qqValues.every(presentSecret) : qqValues.every((value) => !value),
    qqEnabled === true
      ? '启用 QQ 登录时 App ID、App Key 和回调地址必须全部配置'
      : '关闭 QQ 登录时不得保留 QQ 凭据或回调',
  );
  add(
    'QQ_CALLBACK',
    qqEnabled !== true ||
      Boolean(
        publicUrl &&
        qqCallback &&
        qqCallback.protocol === 'https:' &&
        qqCallback.origin === publicUrl.origin &&
        qqCallback.pathname === '/api/v1/auth/qq/callback' &&
        !qqCallback.search &&
        !qqCallback.hash &&
        !placeholder.test(environment.SIYU_QQ_CALLBACK_URL),
      ),
    qqEnabled === true
      ? 'QQ 回调必须为公开域名同源的 HTTPS /api/v1/auth/qq/callback'
      : 'QQ 登录已关闭，不要求回调',
  );

  const mailProvider = environment.SIYU_MAIL_PROVIDER;
  const passwordResetEnabled = booleanFlag(environment.SIYU_PASSWORD_RESET_ENABLED);
  add(
    'PASSWORD_RESET_FEATURE',
    passwordResetEnabled !== undefined && (profile !== 'public' || passwordResetEnabled),
    profile === 'public'
      ? 'public 档案必须启用邮件密码重置'
      : 'SIYU_PASSWORD_RESET_ENABLED 必须显式为 true 或 false',
  );
  add(
    'MAIL_PROVIDER',
    passwordResetEnabled === false && !mailProvider,
    passwordResetEnabled === false
      ? mailProvider
        ? '关闭密码重置时不得配置邮件提供方'
        : '邮件密码重置已关闭，不要求邮件提供方'
      : mailProvider === 'test'
        ? '生产禁止测试邮件传输器'
        : '仓库尚无已批准生产邮件适配器，启用密码重置时无法验收',
  );

  if (mode === 'native') {
    add(
      'NATIVE_API_HOST',
      ['127.0.0.1', '::1', 'localhost'].includes(environment.SIYU_API_HOST ?? '127.0.0.1'),
      '原生 API 必须监听回环地址',
    );
    add(
      'NATIVE_GATEWAY_HOST',
      ['127.0.0.1', '::1', 'localhost'].includes(environment.SIYU_GATEWAY_HOST ?? '127.0.0.1'),
      '原生网关必须监听回环地址',
    );
  }

  return {
    ok: checks.every((check) => check.ok),
    mode,
    checks,
    summary: {
      publicUrl: publicUrl?.origin,
      database: databaseOk ? safeUrlSummary(environment.DATABASE_URL) : undefined,
      redis: redisOk ? safeUrlSummary(environment.REDIS_URL) : undefined,
      profile: ['personal', 'public'].includes(profile) ? profile : undefined,
      registrationEnabled,
      qqAuthEnabled: qqEnabled,
      passwordResetEnabled,
      mailProvider: mailProvider || undefined,
    },
  };
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    'env-file': 'string',
    mode: 'string',
    json: 'boolean',
  });
  if (!args['env-file']) throw new Error('必须通过 --env-file 指定 staging 或 production 环境文件');
  if (!args.mode) throw new Error('必须通过 --mode 指定 native 或 compose');
  const loaded = await readEnvironmentFile(args['env-file']);
  const report = inspectReleaseEnvironment(loaded.values, args.mode);
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ envFile: loaded.path, ...report }, null, 2)}\n`);
  } else {
    console.log(`发布配置：${loaded.path}`);
    console.log(`运行模式：${args.mode}`);
    for (const check of report.checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.code}: ${check.message}`);
    }
    console.log(report.ok ? '发布配置预检通过。' : '发布配置预检失败。');
  }
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
