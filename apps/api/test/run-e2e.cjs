/* eslint-disable @typescript-eslint/no-require-imports -- black-box runner loads compiled CommonJS output */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const request = require('supertest');

const { createApp } = require('../dist/app');
const { readConfig } = require('../dist/config');
const { PrismaService } = require('../dist/database/prisma.service');

let activeApp;
let activePrisma;
let activeQueue;

async function closeResources() {
  await activeQueue?.close();
  await activePrisma?.$disconnect();
  await activeApp?.close();
  activeQueue = undefined;
  activePrisma = undefined;
  activeApp = undefined;
}

async function main() {
  const redis = new IORedis(readConfig().redisUrl);
  const rateKeys = await redis.keys('rate:auth:*');
  if (rateKeys.length > 0) await redis.del(...rateKeys);
  await redis.quit();
  const app = await createApp();
  activeApp = app;
  await app.init();
  const server = app.getHttpServer();
  const health = await request(server).get('/health').expect(200);
  assert.equal(health.body.success, true);
  assert.match(health.body.requestId, /^req_/);
  await request(server).get('/not-found').expect(404);

  if (!process.env.DATABASE_URL?.includes('siyu_test')) {
    await closeResources();
    console.log(
      'API health E2E passed; authentication E2E requires isolated siyu_test DATABASE_URL.',
    );
    return;
  }

  const prisma = new PrismaService();
  activePrisma = prisma;
  const suffix = randomUUID().slice(0, 8);
  const email = `auth-${suffix}@example.com`;
  const password = 'safe-password-1234';
  const register = await request(server)
    .post('/api/v1/auth/register')
    .send({ email: ` ${email.toUpperCase()} `, password, nickname: '认证测试用户' })
    .expect(201);
  assert.equal(register.body.data.user.email, email);
  assert.deepEqual(register.body.data.user.roles, ['USER']);
  assert.equal(JSON.stringify(register.body).includes('passwordHash'), false);
  const firstCookie = String(register.headers['set-cookie'][0]).split(';')[0];
  const firstAccess = register.body.data.accessToken;
  const user = await prisma.user.findFirstOrThrow({
    where: { credential: { emailNormalized: email } },
  });
  assert.equal(await prisma.ledger.count({ where: { ownerUserId: user.id, type: 'PERSONAL' } }), 1);
  assert.equal(await prisma.ledgerMember.count({ where: { userId: user.id, role: 'OWNER' } }), 1);

  await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password, nickname: '重复' })
    .expect(409);
  const concurrentEmail = `concurrent-${suffix}@example.com`;
  const concurrent = await Promise.all([
    request(server)
      .post('/api/v1/auth/register')
      .send({ email: concurrentEmail, password, nickname: '并发甲' }),
    request(server)
      .post('/api/v1/auth/register')
      .send({ email: concurrentEmail, password, nickname: '并发乙' }),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);

  const unknown = await request(server)
    .post('/api/v1/auth/login')
    .send({ email: `missing-${suffix}@example.com`, password: 'wrong-password' })
    .expect(401);
  const wrong = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: 'wrong-password' })
    .expect(401);
  assert.equal(unknown.body.message, wrong.body.message);
  await request(server).get('/api/v1/users/me').expect(401);
  await request(server)
    .get('/api/v1/users/me')
    .set('authorization', `Bearer ${firstAccess}`)
    .expect(200);

  const rotated = await request(server)
    .post('/api/v1/auth/refresh')
    .set('cookie', firstCookie)
    .expect(200);
  const secondCookie = String(rotated.headers['set-cookie'][0]).split(';')[0];
  await request(server).post('/api/v1/auth/refresh').set('cookie', firstCookie).expect(401);
  await request(server).post('/api/v1/auth/refresh').set('cookie', secondCookie).expect(401);

  const login = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const loginCookie = String(login.headers['set-cookie'][0]).split(';')[0];
  const changed = await request(server)
    .post('/api/v1/auth/password/change')
    .set('authorization', `Bearer ${login.body.data.accessToken}`)
    .set('cookie', loginCookie)
    .send({ currentPassword: password, newPassword: 'changed-password-1234' })
    .expect(200);
  const changedCookie = String(changed.headers['set-cookie'][0]).split(';')[0];
  const changedRefresh = await request(server)
    .post('/api/v1/auth/refresh')
    .set('cookie', changedCookie)
    .expect(200);
  const changedSuccessorCookie = String(changedRefresh.headers['set-cookie'][0]).split(';')[0];
  await request(server).post('/api/v1/auth/refresh').set('cookie', loginCookie).expect(401);
  await request(server)
    .post('/api/v1/auth/refresh')
    .set('cookie', changedSuccessorCookie)
    .expect(401);
  await request(server).post('/api/v1/auth/login').send({ email, password }).expect(401);

  const forgotUnknown = await request(server)
    .post('/api/v1/auth/password/forgot')
    .send({ email: `none-${suffix}@example.com` })
    .expect(200);
  const forgotKnown = await request(server)
    .post('/api/v1/auth/password/forgot')
    .send({ email })
    .expect(200);
  assert.deepEqual(forgotUnknown.body.data, forgotKnown.body.data);
  const queue = new Queue('siyu-password-reset', { connection: { url: readConfig().redisUrl } });
  activeQueue = queue;
  const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed']);
  const job = jobs.find((candidate) => candidate.data.email === email);
  assert.equal(typeof job?.data.token, 'string');
  await request(server)
    .post('/api/v1/auth/password/reset')
    .send({ token: job.data.token, newPassword: 'reset-password-1234' })
    .expect(200);
  await request(server)
    .post('/api/v1/auth/password/reset')
    .send({ token: job.data.token, newPassword: 'reset-password-1234' })
    .expect(401);

  const userLogin = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: 'reset-password-1234' })
    .expect(200);
  await request(server)
    .get('/api/v1/admin/auth/check')
    .set('authorization', `Bearer ${userLogin.body.data.accessToken}`)
    .expect(403);
  await prisma.userRole.create({
    data: { userId: user.id, roleId: '10000000-0000-0000-0000-000000000002' },
  });
  const adminLogin = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: 'reset-password-1234' })
    .expect(200);
  await request(server)
    .get('/api/v1/admin/auth/check')
    .set('authorization', `Bearer ${adminLogin.body.data.accessToken}`)
    .expect(200);

  await request(server)
    .post('/api/v1/auth/logout')
    .set('cookie', String(adminLogin.headers['set-cookie'][0]).split(';')[0])
    .expect(200);
  await request(server).post('/api/v1/auth/logout').expect(200);
  await closeResources();
  console.log('API health and authentication E2E passed.');
}

main().catch(async (error) => {
  console.error(error);
  await closeResources();
  process.exitCode = 1;
});
