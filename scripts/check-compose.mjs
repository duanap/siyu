import { readFile } from 'node:fs/promises';
import process from 'node:process';
import YAML from 'yaml';

const compose = YAML.parse(await readFile('docker-compose.yml', 'utf8'));
const requiredServices = ['siyu-nginx', 'siyu-api', 'siyu-worker', 'siyu-postgres', 'siyu-redis'];
const services = compose.services ?? {};
const missing = requiredServices.filter((name) => services[name] === undefined);

if (compose.name !== 'siyu') {
  console.error('Compose project name must be siyu.');
  process.exit(1);
}
if (missing.length > 0) {
  console.error(`Missing Compose services: ${missing.join(', ')}`);
  process.exit(1);
}
for (const name of ['siyu-postgres', 'siyu-redis']) {
  const ports = services[name].ports ?? [];
  if (ports.some((port) => !String(port).startsWith('127.0.0.1:'))) {
    console.error(`${name} may only publish development ports on localhost.`);
    process.exit(1);
  }
}
for (const name of requiredServices) {
  if (services[name].healthcheck === undefined) {
    console.error(`${name} must define a healthcheck.`);
    process.exit(1);
  }
}

console.log('Compose baseline contains all required SIYU services and local-only data ports.');
