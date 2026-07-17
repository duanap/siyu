import { checkNativeServices } from './native-runtime.mjs';

const configOnly = process.argv.includes('--config-only');

try {
  await checkNativeServices({ connect: !configOnly });
  console.log(configOnly ? '原生运行配置检查通过。' : '原生依赖服务检查通过。');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
