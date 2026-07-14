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
  const personalLedger = await prisma.ledger.findFirstOrThrow({
    where: { ownerUserId: user.id, type: 'PERSONAL' },
  });
  assert.equal(await prisma.ledger.count({ where: { ownerUserId: user.id, type: 'PERSONAL' } }), 1);
  assert.equal(await prisma.ledgerMember.count({ where: { userId: user.id, role: 'OWNER' } }), 1);
  assert.equal(await prisma.category.count({ where: { ledgerId: personalLedger.id } }), 16);
  assert.equal(
    await prisma.category.count({
      where: { ledgerId: personalLedger.id, isSystem: true, isEnabled: true },
    }),
    16,
  );

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

  const resetRegisterLimit = new IORedis(readConfig().redisUrl);
  const registerRateKeys = await resetRegisterLimit.keys('rate:auth:register:*');
  if (registerRateKeys.length > 0) await resetRegisterLimit.del(...registerRateKeys);
  await resetRegisterLimit.quit();

  async function registerCoupleUser(label) {
    const result = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: `${label}-${suffix}@example.com`,
        password: 'couple-password-1234',
        nickname: `情侣测试${label}`,
      })
      .expect(201);
    return { accessToken: result.body.data.accessToken, user: result.body.data.user };
  }

  const ownerAccess = userLogin.body.data.accessToken;
  const partner = await registerCoupleUser('partner');
  const outsider = await registerCoupleUser('outsider');
  const ledgerKey = `ledger-${suffix}`;
  const createdCouple = await request(server)
    .post('/api/v1/couple-ledgers')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ name: '朝暮同笺测试', idempotencyKey: ledgerKey })
    .expect(201);
  const coupleLedgerId = createdCouple.body.data.id;
  assert.equal(createdCouple.body.data.members.length, 1);
  assert.equal(createdCouple.body.data.members[0].role, 'OWNER');
  assert.equal(JSON.stringify(createdCouple.body).includes('idempotencyKey'), false);
  assert.equal(await prisma.category.count({ where: { ledgerId: coupleLedgerId } }), 16);

  const ownerExpenseCategories = await request(server)
    .get('/api/v1/categories')
    .query({ ledgerId: coupleLedgerId, type: 'EXPENSE', includeDisabled: true })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(ownerExpenseCategories.body.data.items.length, 9);
  assert.deepEqual(ownerExpenseCategories.body.data.permissions, {
    canCreate: true,
    canReorder: true,
  });
  assert.equal(
    ownerExpenseCategories.body.data.items.every((item) => item.canToggle),
    true,
  );
  await request(server)
    .get('/api/v1/categories')
    .query({ ledgerId: coupleLedgerId, type: 'EXPENSE' })
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '非法图标分类',
      icon: 'not-allowed',
      color: '#64748B',
      idempotencyKey: `invalid-icon-${suffix}`,
    })
    .expect(400);
  await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '超'.repeat(51),
      icon: 'other',
      color: '#64748B',
      idempotencyKey: `long-name-${suffix}`,
    })
    .expect(400);

  const ownerCategoryKey = `owner-category-${suffix}`;
  const ownerCategory = await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '共同旅行',
      icon: 'transport',
      color: '#3B82F6',
      idempotencyKey: ownerCategoryKey,
    })
    .expect(201);
  const ownerCategoryId = ownerCategory.body.data.id;
  assert.equal(ownerCategory.body.data.canEdit, true);
  assert.equal(ownerCategory.body.data.sortOrder, 1000);
  const ownerCategoryReplay = await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '共同旅行',
      icon: 'transport',
      color: '#3b82f6',
      idempotencyKey: ownerCategoryKey,
    })
    .expect(201);
  assert.equal(ownerCategoryReplay.body.data.id, ownerCategoryId);
  const categoryIdempotencyConflict = await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '不同分类',
      icon: 'other',
      color: '#64748B',
      idempotencyKey: ownerCategoryKey,
    })
    .expect(409);
  assert.equal(categoryIdempotencyConflict.body.code, 'IDEMPOTENCY_CONFLICT');
  const duplicateCategory = await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: ' 共同旅行 ',
      icon: 'other',
      color: '#64748B',
      idempotencyKey: `duplicate-category-${suffix}`,
    })
    .expect(409);
  assert.equal(duplicateCategory.body.code, 'CATEGORY_NAME_CONFLICT');

  const systemCategoryId = ownerExpenseCategories.body.data.items[0].id;
  const immutableSystem = await request(server)
    .patch(`/api/v1/categories/${systemCategoryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ name: '系统分类不可改' })
    .expect(403);
  assert.equal(immutableSystem.body.code, 'CATEGORY_SYSTEM_IMMUTABLE');
  await request(server)
    .patch(`/api/v1/categories/${ownerCategoryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ name: '共同长途旅行', icon: 'gift', color: '#E67E22' })
    .expect(200);
  await request(server)
    .post(`/api/v1/categories/${ownerCategoryId}/disable`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  await request(server)
    .post(`/api/v1/categories/${ownerCategoryId}/disable`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  const activeOnly = await request(server)
    .get('/api/v1/categories')
    .query({ ledgerId: coupleLedgerId, type: 'EXPENSE' })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(
    activeOnly.body.data.items.some((item) => item.id === ownerCategoryId),
    false,
  );
  await request(server)
    .post(`/api/v1/categories/${ownerCategoryId}/enable`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);

  const beforeReorder = await request(server)
    .get('/api/v1/categories')
    .query({ ledgerId: coupleLedgerId, type: 'EXPENSE', includeDisabled: true })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  const reversedCategoryIds = beforeReorder.body.data.items.map((item) => item.id).reverse();
  const reordered = await request(server)
    .put('/api/v1/categories/reorder')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ledgerId: coupleLedgerId, type: 'EXPENSE', categoryIds: reversedCategoryIds })
    .expect(200);
  assert.deepEqual(
    reordered.body.data.items.map((item) => item.id),
    reversedCategoryIds,
  );
  assert.deepEqual(
    reordered.body.data.items.map((item) => item.sortOrder),
    reversedCategoryIds.map((_, index) => (index + 1) * 100),
  );
  await request(server)
    .put('/api/v1/categories/reorder')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ledgerId: coupleLedgerId, type: 'EXPENSE', categoryIds: reversedCategoryIds })
    .expect(200);
  const invalidReorder = await request(server)
    .put('/api/v1/categories/reorder')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ledgerId: coupleLedgerId, type: 'EXPENSE', categoryIds: [ownerCategoryId] })
    .expect(409);
  assert.equal(invalidReorder.body.code, 'CATEGORY_REORDER_INVALID');

  const replayedCouple = await request(server)
    .post('/api/v1/couple-ledgers')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ name: '朝暮同笺测试', idempotencyKey: ledgerKey })
    .expect(201);
  assert.equal(replayedCouple.body.data.id, coupleLedgerId);
  const idempotencyConflict = await request(server)
    .post('/api/v1/couple-ledgers')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ name: '不同名称', idempotencyKey: ledgerKey })
    .expect(409);
  assert.equal(idempotencyConflict.body.code, 'IDEMPOTENCY_CONFLICT');

  const invitationKey = `invite-${suffix}`;
  const invitation = await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/invitations`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ idempotencyKey: invitationKey })
    .expect(201);
  const invitationToken = invitation.body.data.token;
  assert.equal(typeof invitationToken, 'string');
  assert.equal(JSON.stringify(invitation.body).includes('tokenHash'), false);
  const replayedInvitation = await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/invitations`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ idempotencyKey: invitationKey })
    .expect(201);
  assert.equal(replayedInvitation.body.data.token, invitationToken);

  const selfAccept = await request(server)
    .post('/api/v1/couple-invitations/accept')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ token: invitationToken })
    .expect(409);
  assert.equal(selfAccept.body.code, 'INVITATION_SELF_ACCEPT');

  const accepted = await request(server)
    .post('/api/v1/couple-invitations/accept')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ token: invitationToken })
    .expect(200);
  assert.equal(accepted.body.data.members.length, 2);
  const memberCategories = await request(server)
    .get('/api/v1/categories')
    .query({ ledgerId: coupleLedgerId, type: 'EXPENSE', includeDisabled: true })
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  assert.deepEqual(memberCategories.body.data.permissions, {
    canCreate: true,
    canReorder: false,
  });
  assert.equal(
    memberCategories.body.data.items.find((item) => item.id === systemCategoryId).canToggle,
    false,
  );
  assert.equal(
    memberCategories.body.data.items.find((item) => item.id === ownerCategoryId).canEdit,
    false,
  );
  const memberCategory = await request(server)
    .post('/api/v1/categories')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      name: '成员自定义分类',
      icon: 'entertainment',
      color: '#F5A623',
      idempotencyKey: `member-category-${suffix}`,
    })
    .expect(201);
  assert.equal(memberCategory.body.data.creatorUserId, partner.user.id);
  assert.equal(memberCategory.body.data.canEdit, true);
  const editOtherCategory = await request(server)
    .patch(`/api/v1/categories/${ownerCategoryId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ name: '越权修改' })
    .expect(403);
  assert.equal(editOtherCategory.body.code, 'CATEGORY_PERMISSION_DENIED');
  await request(server)
    .patch(`/api/v1/categories/${memberCategory.body.data.id}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ name: '成员自定义长名称分类' })
    .expect(200);
  await request(server)
    .post(`/api/v1/categories/${memberCategory.body.data.id}/disable`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  await request(server)
    .post(`/api/v1/categories/${memberCategory.body.data.id}/enable`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  const memberSystemToggle = await request(server)
    .post(`/api/v1/categories/${systemCategoryId}/disable`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(403);
  assert.equal(memberSystemToggle.body.code, 'CATEGORY_PERMISSION_DENIED');
  const memberReorder = await request(server)
    .put('/api/v1/categories/reorder')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      categoryIds: [...reversedCategoryIds, memberCategory.body.data.id],
    })
    .expect(403);
  assert.equal(memberReorder.body.code, 'CATEGORY_PERMISSION_DENIED');
  await request(server)
    .get(`/api/v1/ledgers/${coupleLedgerId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  const fullInvite = await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/invitations`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ idempotencyKey: `invite-full-${suffix}` })
    .expect(409);
  assert.equal(fullInvite.body.code, 'COUPLE_LEDGER_FULL');

  const ownerLeave = await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/leave`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(403);
  assert.equal(ownerLeave.body.code, 'COUPLE_OWNER_MUST_TRANSFER');

  const transferred = await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/transfer-ownership`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ targetUserId: partner.user.id })
    .expect(200);
  assert.equal(transferred.body.data.ownerUserId, partner.user.id);
  assert.equal(
    transferred.body.data.members.find((member) => member.userId === partner.user.id).role,
    'OWNER',
  );

  await request(server)
    .post(`/api/v1/couple-ledgers/${coupleLedgerId}/leave`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  await request(server)
    .get(`/api/v1/ledgers/${coupleLedgerId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(404);
  await request(server)
    .get(`/api/v1/ledgers/${coupleLedgerId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);

  await request(server)
    .delete(`/api/v1/couple-ledgers/${coupleLedgerId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  await request(server)
    .get(`/api/v1/ledgers/${coupleLedgerId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(404);
  assert.equal(
    await prisma.ledger.count({ where: { id: coupleLedgerId, status: 'DISSOLVED' } }),
    1,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        targetId: coupleLedgerId,
        action: {
          in: [
            'COUPLE_LEDGER_CREATED',
            'COUPLE_MEMBER_LEFT',
            'COUPLE_OWNERSHIP_TRANSFERRED',
            'COUPLE_LEDGER_DISSOLVED',
          ],
        },
      },
    }),
    4,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        targetType: 'CATEGORY',
        targetId: { in: [ownerCategoryId, memberCategory.body.data.id, coupleLedgerId] },
      },
    }),
    9,
  );

  await request(server)
    .post('/api/v1/auth/logout')
    .set('cookie', String(adminLogin.headers['set-cookie'][0]).split(';')[0])
    .expect(200);
  await request(server).post('/api/v1/auth/logout').expect(200);
  await closeResources();
  console.log('API health, authentication, couple ledger, and category E2E passed.');
}

main().catch(async (error) => {
  console.error(error);
  await closeResources();
  process.exitCode = 1;
});
