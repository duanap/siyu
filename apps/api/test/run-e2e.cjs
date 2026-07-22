/* eslint-disable @typescript-eslint/no-require-imports -- black-box runner loads compiled CommonJS output */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const request = require('supertest');

const { createApp } = require('../dist/app');
const { loadEnvironmentFile, readConfig } = require('../dist/config');
const { PrismaService } = require('../dist/database/prisma.service');
const { RecurringService } = require('../dist/recurring/recurring.service');
const { businessToday, dateOnly } = require('../dist/recurring/recurring.dates');
const {
  RECURRING_MATERIALIZE_JOB,
  RECURRING_QUEUE,
  RECURRING_SCAN_JOB,
  RECURRING_SCAN_SCHEDULER,
  recurringMaterializeJobId,
} = require('../dist/recurring/recurring.jobs');
const { startWorker } = require('../dist/worker');

let activeApp;
let activePrisma;
let activeQueue;
let activeQueueEvents;
let activeWorkerRuntime;
let activeSecondWorkerRuntime;

async function closeResources() {
  await activeQueueEvents?.close();
  await activeSecondWorkerRuntime?.close();
  await activeWorkerRuntime?.close();
  await activeQueue?.close();
  await activePrisma?.$disconnect();
  await activeApp?.close();
  activeQueue = undefined;
  activeQueueEvents = undefined;
  activeWorkerRuntime = undefined;
  activeSecondWorkerRuntime = undefined;
  activePrisma = undefined;
  activeApp = undefined;
}

async function main() {
  loadEnvironmentFile();
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

  const personalExpenseCategory = await prisma.category.findFirstOrThrow({
    where: { ledgerId: personalLedger.id, type: 'EXPENSE', isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  const personalIncomeCategory = await prisma.category.findFirstOrThrow({
    where: { ledgerId: personalLedger.id, type: 'INCOME', isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  const expensePayload = {
    ledgerId: personalLedger.id,
    type: 'EXPENSE',
    amountCent: 12345,
    categoryId: personalExpenseCategory.id,
    businessDate: '2026-07-14',
    note: '  请求哈希原始备注  ',
    paymentMethod: 'WECHAT',
    idempotencyKey: `entry-expense-${suffix}`,
  };
  const personalExpense = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(expensePayload)
    .expect(201);
  const personalExpenseId = personalExpense.body.data.id;
  assert.equal(personalExpense.body.data.note, '请求哈希原始备注');
  assert.equal(personalExpense.body.data.amountCent, 12345);
  assert.equal(personalExpense.body.data.sourceType, 'MANUAL');
  assert.equal(personalExpense.body.data.version, 1);
  assert.equal(personalExpense.body.data.canEdit, true);
  assert.deepEqual(Object.keys(personalExpense.body.data.creator).sort(), [
    'avatarUrl',
    'id',
    'nickname',
  ]);
  assert.equal(JSON.stringify(personalExpense.body).includes('createRequestHash'), false);

  const replayedExpense = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(expensePayload)
    .expect(201);
  assert.equal(replayedExpense.body.data.id, personalExpenseId);
  const hashBeforeUpdate = await prisma.entry.findUniqueOrThrow({
    where: { id: personalExpenseId },
    select: { createRequestHash: true },
  });

  const changedExpense = await request(server)
    .patch(`/api/v1/entries/${personalExpenseId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ expectedVersion: 1, note: '修改后的备注' })
    .expect(200);
  assert.equal(changedExpense.body.data.version, 2);
  assert.equal(changedExpense.body.data.note, '修改后的备注');
  const replayAfterMutableUpdate = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(expensePayload)
    .expect(201);
  assert.equal(replayAfterMutableUpdate.body.data.id, personalExpenseId);
  assert.equal(replayAfterMutableUpdate.body.data.note, '修改后的备注');
  assert.deepEqual(
    await prisma.entry.findUniqueOrThrow({
      where: { id: personalExpenseId },
      select: { createRequestHash: true },
    }),
    hashBeforeUpdate,
  );
  const differentReplay = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, amountCent: 12346 })
    .expect(409);
  assert.equal(differentReplay.body.code, 'IDEMPOTENCY_CONFLICT');

  const noChangeAuditBefore = await prisma.auditLog.count({
    where: { targetType: 'ENTRY', targetId: personalExpenseId, action: 'ENTRY_UPDATED' },
  });
  const noChange = await request(server)
    .patch(`/api/v1/entries/${personalExpenseId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ expectedVersion: 2, note: '修改后的备注' })
    .expect(200);
  assert.equal(noChange.body.data.version, 2);
  assert.equal(
    await prisma.auditLog.count({
      where: { targetType: 'ENTRY', targetId: personalExpenseId, action: 'ENTRY_UPDATED' },
    }),
    noChangeAuditBefore,
  );

  const personalIncome = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: personalLedger.id,
      type: 'INCOME',
      amountCent: Number.MAX_SAFE_INTEGER,
      categoryId: personalIncomeCategory.id,
      businessDate: '2026-07-13',
      note: '安全整数上限收入',
      paymentMethod: 'BANK_CARD',
      idempotencyKey: `entry-income-${suffix}`,
    })
    .expect(201);
  assert.equal(personalIncome.body.data.amountCent, Number.MAX_SAFE_INTEGER);

  const concurrentEntryPayload = {
    ...expensePayload,
    amountCent: 777,
    note: '并发重复创建',
    idempotencyKey: `concurrent-entry-${suffix}`,
  };
  const concurrentEntries = await Promise.all([
    request(server)
      .post('/api/v1/entries')
      .set('authorization', `Bearer ${ownerAccess}`)
      .send(concurrentEntryPayload),
    request(server)
      .post('/api/v1/entries')
      .set('authorization', `Bearer ${ownerAccess}`)
      .send(concurrentEntryPayload),
  ]);
  assert.deepEqual(
    concurrentEntries.map((response) => response.status),
    [201, 201],
  );
  assert.equal(concurrentEntries[0].body.data.id, concurrentEntries[1].body.data.id);
  assert.equal(
    await prisma.entry.count({
      where: { creatorUserId: user.id, idempotencyKey: concurrentEntryPayload.idempotencyKey },
    }),
    1,
  );

  for (const amountCent of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await request(server)
      .post('/api/v1/entries')
      .set('authorization', `Bearer ${ownerAccess}`)
      .send({ ...expensePayload, amountCent, idempotencyKey: `invalid-${amountCent}-${suffix}` })
      .expect(400);
  }
  await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, businessDate: '2026-02-30', idempotencyKey: `date-${suffix}` })
    .expect(400);
  await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, paymentMethod: 'CRYPTO', idempotencyKey: `payment-${suffix}` })
    .expect(400);
  await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, note: '长'.repeat(501), idempotencyKey: `note-${suffix}` })
    .expect(400);
  await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, creatorUserId: outsider.user.id, sourceType: 'SALARY' })
    .expect(400);
  const crossLedgerCategory = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...expensePayload,
      categoryId: systemCategoryId,
      idempotencyKey: `cross-category-${suffix}`,
    })
    .expect(400);
  assert.equal(crossLedgerCategory.body.code, 'ENTRY_CATEGORY_INVALID');

  await request(server)
    .post(`/api/v1/categories/${personalExpenseCategory.id}/disable`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  const disabledCategory = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...expensePayload, idempotencyKey: `disabled-category-${suffix}` })
    .expect(409);
  assert.equal(disabledCategory.body.code, 'CATEGORY_DISABLED');
  await request(server)
    .post(`/api/v1/categories/${personalExpenseCategory.id}/enable`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);

  const filteredPersonal = await request(server)
    .get('/api/v1/entries')
    .query({
      ledgerId: personalLedger.id,
      month: '2026-07',
      type: 'EXPENSE',
      categoryId: personalExpenseCategory.id,
      creatorUserId: user.id,
      keyword: '修改后的',
      page: 1,
      pageSize: 1,
    })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(filteredPersonal.body.data.items.length, 1);
  assert.equal(filteredPersonal.body.data.items[0].id, personalExpenseId);
  assert.equal(filteredPersonal.body.data.total, 1);
  assert.equal(filteredPersonal.body.data.hasNext, false);
  const pagedPersonal = await request(server)
    .get('/api/v1/entries')
    .query({ ledgerId: personalLedger.id, month: '2026-07', page: 1, pageSize: 1 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(pagedPersonal.body.data.total >= 2, true);
  assert.equal(pagedPersonal.body.data.hasNext, true);
  assert.equal(pagedPersonal.body.data.items[0].businessDate, '2026-07-14');

  const ownerCoupleEntry = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      type: 'EXPENSE',
      amountCent: 200,
      categoryId: systemCategoryId,
      businessDate: '2026-07-14',
      note: 'OWNER 共同账目',
      paymentMethod: 'ALIPAY',
      idempotencyKey: `owner-couple-entry-${suffix}`,
    })
    .expect(201);
  const memberPayload = {
    ledgerId: coupleLedgerId,
    type: 'EXPENSE',
    amountCent: 300,
    categoryId: memberCategory.body.data.id,
    businessDate: '2026-07-14',
    note: 'MEMBER 共同账目',
    paymentMethod: 'CASH',
    idempotencyKey: `member-couple-entry-${suffix}`,
  };
  const memberCoupleEntry = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send(memberPayload)
    .expect(201);
  const memberEntryId = memberCoupleEntry.body.data.id;
  assert.equal(memberCoupleEntry.body.data.canEdit, true);

  const coupleListForMember = await request(server)
    .get('/api/v1/entries')
    .query({ ledgerId: coupleLedgerId, month: '2026-07' })
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  assert.equal(coupleListForMember.body.data.total, 2);
  assert.equal(
    coupleListForMember.body.data.items.find((item) => item.id === ownerCoupleEntry.body.data.id)
      .canEdit,
    false,
  );
  const memberEditOther = await request(server)
    .patch(`/api/v1/entries/${ownerCoupleEntry.body.data.id}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ expectedVersion: 1, note: '越权修改' })
    .expect(403);
  assert.equal(memberEditOther.body.code, 'ENTRY_PERMISSION_DENIED');
  await request(server)
    .delete(`/api/v1/entries/${ownerCoupleEntry.body.data.id}`)
    .query({ expectedVersion: 1 })
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(403);

  const memberOwnUpdate = await request(server)
    .patch(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ expectedVersion: 1, amountCent: 301 })
    .expect(200);
  assert.equal(memberOwnUpdate.body.data.version, 2);
  const concurrentWinner = await request(server)
    .patch(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ expectedVersion: 2, note: 'OWNER 管理成员账目' })
    .expect(200);
  assert.equal(concurrentWinner.body.data.version, 3);
  const concurrentLoser = await request(server)
    .patch(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ expectedVersion: 2, note: '过期写入' })
    .expect(409);
  assert.equal(concurrentLoser.body.code, 'ENTRY_VERSION_CONFLICT');

  await prisma.user.update({ where: { id: partner.user.id }, data: { status: 'DISABLED' } });
  const ownerViewsDisabledCreator = await request(server)
    .get(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(ownerViewsDisabledCreator.body.data.canEdit, true);
  const disabledActorView = await request(server)
    .get(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  assert.equal(disabledActorView.body.data.canEdit, false);
  await request(server)
    .patch(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ expectedVersion: 3, note: '禁用用户写入' })
    .expect(403);
  await request(server)
    .patch(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ expectedVersion: 3, note: 'OWNER 仍可管理' })
    .expect(200);
  await prisma.user.update({ where: { id: partner.user.id }, data: { status: 'ACTIVE' } });

  await request(server)
    .get('/api/v1/entries')
    .query({ ledgerId: coupleLedgerId, month: '2026-07' })
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  await request(server)
    .get(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);

  const managedEntryId = randomUUID();
  await prisma.entry.create({
    data: {
      id: managedEntryId,
      ledgerId: coupleLedgerId,
      creatorUserId: user.id,
      type: 'EXPENSE',
      amountCent: 400n,
      categoryId: systemCategoryId,
      businessDate: new Date('2026-07-14T00:00:00.000Z'),
      sourceType: 'SALARY',
      sourceId: randomUUID(),
      idempotencyKey: `managed-entry-${suffix}`,
      createRequestHash: '8'.repeat(64),
    },
  });
  const managedDetail = await request(server)
    .get(`/api/v1/entries/${managedEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(managedDetail.body.data.canEdit, false);
  const managedUpdate = await request(server)
    .patch(`/api/v1/entries/${managedEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ expectedVersion: 1, note: '普通接口不可改' })
    .expect(409);
  assert.equal(managedUpdate.body.code, 'ENTRY_SOURCE_MANAGED');
  const managedDelete = await request(server)
    .delete(`/api/v1/entries/${managedEntryId}`)
    .query({ expectedVersion: 1 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(409);
  assert.equal(managedDelete.body.code, 'ENTRY_SOURCE_MANAGED');

  const deleteResult = await request(server)
    .delete(`/api/v1/entries/${memberEntryId}`)
    .query({ expectedVersion: 4 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.deepEqual(deleteResult.body.data, { id: memberEntryId, deleted: true, version: 5 });
  await request(server)
    .delete(`/api/v1/entries/${memberEntryId}`)
    .query({ expectedVersion: 4 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  await request(server)
    .delete(`/api/v1/entries/${memberEntryId}`)
    .query({ expectedVersion: 4 })
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  const deletedVersionConflict = await request(server)
    .delete(`/api/v1/entries/${memberEntryId}`)
    .query({ expectedVersion: 3 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(409);
  assert.equal(deletedVersionConflict.body.code, 'ENTRY_VERSION_CONFLICT');
  await request(server)
    .get(`/api/v1/entries/${memberEntryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(404);
  const replayDeleted = await request(server)
    .post('/api/v1/entries')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send(memberPayload)
    .expect(409);
  assert.equal(replayDeleted.body.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(
    await prisma.auditLog.count({
      where: { targetType: 'ENTRY', targetId: memberEntryId, action: 'ENTRY_DELETED' },
    }),
    1,
  );
  const entryAuditJson = JSON.stringify(
    await prisma.auditLog.findMany({ where: { targetType: 'ENTRY' } }),
  );
  assert.equal(entryAuditJson.includes('请求哈希原始备注'), false);
  assert.equal(entryAuditJson.includes('修改后的备注'), false);

  // TASK-010 / BR-DEBT-001..010: privacy, atomic processing, idempotency,
  // source Entry mapping, settlement, overdue status, and approved delete rule 1A.
  const borrowedKey = `borrowed-${suffix}`;
  const borrowedPayload = {
    direction: 'BORROWED',
    counterpartyName: '借贷测试对方',
    principalCent: 1000,
    startDate: '2026-01-01',
    dueDate: '2026-01-31',
    note: '借贷创建幂等测试',
    reminderEnabled: true,
    idempotencyKey: borrowedKey,
  };
  const borrowed = await request(server)
    .post('/api/v1/debts')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(borrowedPayload)
    .expect(201);
  const borrowedId = borrowed.body.data.id;
  assert.equal(borrowed.body.data.status, 'OVERDUE');
  assert.equal(borrowed.body.data.remainingCent, 1000);
  assert.equal(borrowed.body.data.overdueDays > 0, true);
  assert.equal(borrowed.body.data.canDelete, true);
  const borrowedReplay = await request(server)
    .post('/api/v1/debts')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(borrowedPayload)
    .expect(201);
  assert.equal(borrowedReplay.body.data.id, borrowedId);
  const borrowedConflict = await request(server)
    .post('/api/v1/debts')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...borrowedPayload, principalCent: 1001 })
    .expect(409);
  assert.equal(borrowedConflict.body.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(
    await prisma.entry.count({ where: { sourceType: 'DEBT_TRANSACTION', creatorUserId: user.id } }),
    0,
  );
  await request(server)
    .get(`/api/v1/debts/${borrowedId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  await request(server)
    .patch(`/api/v1/debts/${borrowedId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ dueDate: '2025-12-31' })
    .expect(400);

  const partialPayload = {
    amountCent: 400,
    businessDate: '2026-07-16',
    syncEntry: false,
    idempotencyKey: `borrowed-partial-${suffix}`,
    note: '部分还款',
  };
  const concurrentDebtTransactions = await Promise.all([
    request(server)
      .post(`/api/v1/debts/${borrowedId}/transactions`)
      .set('authorization', `Bearer ${ownerAccess}`)
      .send(partialPayload),
    request(server)
      .post(`/api/v1/debts/${borrowedId}/transactions`)
      .set('authorization', `Bearer ${ownerAccess}`)
      .send(partialPayload),
  ]);
  assert.deepEqual(
    concurrentDebtTransactions.map((response) => response.status).sort(),
    [201, 201],
  );
  assert.equal(
    concurrentDebtTransactions[0].body.data.transaction.id,
    concurrentDebtTransactions[1].body.data.transaction.id,
  );
  assert.equal(concurrentDebtTransactions[0].body.data.debt.remainingCent, 600);
  assert.equal(
    await prisma.debtTransaction.count({
      where: { userId: user.id, idempotencyKey: partialPayload.idempotencyKey },
    }),
    1,
  );
  const overpay = await request(server)
    .post(`/api/v1/debts/${borrowedId}/transactions`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...partialPayload, amountCent: 601, idempotencyKey: `overpay-${suffix}` })
    .expect(409);
  assert.equal(overpay.body.code, 'DEBT_AMOUNT_EXCEEDS_REMAINING');

  const settle = await request(server)
    .post(`/api/v1/debts/${borrowedId}/transactions`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      amountCent: 600,
      businessDate: '2026-07-16',
      syncEntry: true,
      idempotencyKey: `borrowed-settle-${suffix}`,
      note: '结清还款',
    })
    .expect(201);
  assert.equal(settle.body.data.debt.remainingCent, 0);
  assert.equal(settle.body.data.debt.processedCent, 1000);
  assert.equal(settle.body.data.debt.status, 'SETTLED');
  const borrowedEntryId = settle.body.data.transaction.entryId;
  const borrowedEntry = await prisma.entry.findUniqueOrThrow({ where: { id: borrowedEntryId } });
  assert.equal(borrowedEntry.ledgerId, personalLedger.id);
  assert.equal(borrowedEntry.creatorUserId, user.id);
  assert.equal(borrowedEntry.type, 'EXPENSE');
  assert.equal(borrowedEntry.amountCent, 600n);
  assert.equal(borrowedEntry.sourceType, 'DEBT_TRANSACTION');
  assert.equal(borrowedEntry.sourceId, settle.body.data.transaction.id);
  const protectedDelete = await request(server)
    .delete(`/api/v1/debts/${borrowedId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(409);
  assert.equal(protectedDelete.body.code, 'DEBT_HAS_SYNCED_ENTRY');
  assert.equal(await prisma.entry.count({ where: { id: borrowedEntryId, deletedAt: null } }), 1);

  const lent = await request(server)
    .post('/api/v1/debts')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      direction: 'LENT',
      counterpartyName: '待收款测试对方',
      principalCent: 200,
      startDate: '2026-07-01',
      idempotencyKey: `lent-${suffix}`,
    })
    .expect(201);
  const lentTransaction = await request(server)
    .post(`/api/v1/debts/${lent.body.data.id}/transactions`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      amountCent: 200,
      businessDate: '2026-07-16',
      syncEntry: true,
      idempotencyKey: `lent-settle-${suffix}`,
    })
    .expect(201);
  const lentEntry = await prisma.entry.findUniqueOrThrow({
    where: { id: lentTransaction.body.data.transaction.entryId },
  });
  assert.equal(lentEntry.type, 'INCOME');
  assert.equal(lentTransaction.body.data.debt.status, 'SETTLED');

  const removable = await request(server)
    .post('/api/v1/debts')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      direction: 'BORROWED',
      counterpartyName: '可删除测试对方',
      principalCent: 300,
      startDate: '2026-07-01',
      idempotencyKey: `removable-${suffix}`,
    })
    .expect(201);
  const removableTransaction = await request(server)
    .post(`/api/v1/debts/${removable.body.data.id}/transactions`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      amountCent: 100,
      businessDate: '2026-07-16',
      syncEntry: false,
      idempotencyKey: `removable-tx-${suffix}`,
    })
    .expect(201);
  await request(server)
    .delete(`/api/v1/debts/${removable.body.data.id}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  await request(server)
    .get(`/api/v1/debts/${removable.body.data.id}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(404);
  assert.equal(
    await prisma.debt.count({
      where: { id: removable.body.data.id, status: 'CANCELLED', deletedAt: { not: null } },
    }),
    1,
  );
  assert.equal(
    await prisma.debtTransaction.count({
      where: { id: removableTransaction.body.data.transaction.id, deletedAt: { not: null } },
    }),
    1,
  );
  const debtList = await request(server)
    .get('/api/v1/debts')
    .query({ page: 1, pageSize: 2 })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(debtList.body.data.items.length, 2);
  assert.equal(debtList.body.data.total >= 2, true);
  assert.equal(
    (await prisma.auditLog.count({
      where: {
        actorUserId: user.id,
        action: { in: ['DEBT_CREATED', 'DEBT_TRANSACTION_CREATED', 'DEBT_DELETED'] },
      },
    })) >= 7,
    true,
  );

  const recurring = app.get(RecurringService);
  const autoRuleKey = `recurring-auto-${suffix}`;
  const autoRulePayload = {
    ledgerId: personalLedger.id,
    name: '每月住房支出',
    entryType: 'EXPENSE',
    amountCent: 188800,
    categoryId: personalExpenseCategory.id,
    frequency: 'MONTHLY',
    intervalValue: 1,
    startDate: '2026-01-31',
    totalOccurrences: 1,
    generationMode: 'AUTO',
    reminderDaysBefore: 2,
    idempotencyKey: autoRuleKey,
  };
  const autoRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(autoRulePayload)
    .expect(201);
  const autoRuleId = autoRule.body.data.id;
  assert.equal(autoRule.body.data.canEdit, true);
  assert.equal(
    autoRule.body.data.nextRunDate.endsWith('-31') ||
      autoRule.body.data.nextRunDate.endsWith('-30') ||
      autoRule.body.data.nextRunDate.endsWith('-28') ||
      autoRule.body.data.nextRunDate.endsWith('-29'),
    true,
  );
  const autoReplay = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(autoRulePayload)
    .expect(201);
  assert.equal(autoReplay.body.data.id, autoRuleId);
  const recurringCreateConflict = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...autoRulePayload, name: '不同规则' })
    .expect(409);
  assert.equal(recurringCreateConflict.body.code, 'IDEMPOTENCY_CONFLICT');
  await request(server)
    .get(`/api/v1/recurring-rules/${autoRuleId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);

  const autoScheduledDate = new Date(`${autoRule.body.data.nextRunDate}T00:00:00.000Z`);
  await Promise.all([
    recurring.materializeDueRule(autoRuleId, autoScheduledDate),
    recurring.materializeDueRule(autoRuleId, autoScheduledDate),
  ]);
  const generatedRuns = await prisma.recurringRun.findMany({ where: { ruleId: autoRuleId } });
  assert.equal(generatedRuns.length, 1);
  assert.equal(generatedRuns[0].status, 'GENERATED');
  assert.equal(
    await prisma.entry.count({
      where: { sourceType: 'RECURRING_RUN', sourceId: generatedRuns[0].id },
    }),
    1,
  );
  const completedAutoRule = await prisma.recurringRule.findUniqueOrThrow({
    where: { id: autoRuleId },
  });
  assert.equal(completedAutoRule.completedOccurrences, 1);
  assert.equal(completedAutoRule.status, 'COMPLETED');
  assert.equal(completedAutoRule.nextRunDate, null);

  const confirmRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: '每月电费',
      amountCent: 30000,
      totalOccurrences: 2,
      generationMode: 'CONFIRM',
      idempotencyKey: `recurring-confirm-${suffix}`,
    })
    .expect(201);
  const confirmScheduledDate = new Date(`${confirmRule.body.data.nextRunDate}T00:00:00.000Z`);
  const pendingRun = await recurring.materializeDueRule(
    confirmRule.body.data.id,
    confirmScheduledDate,
  );
  assert.equal(pendingRun.status, 'PENDING');
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: user.id,
        type: 'RECURRING_CONFIRMATION_DUE',
        relatedType: 'RECURRING_RUN',
        relatedId: pendingRun.id,
      },
    }),
    1,
  );
  const lockedSchedule = await request(server)
    .patch(`/api/v1/recurring-rules/${confirmRule.body.data.id}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ frequency: 'YEARLY' })
    .expect(409);
  assert.equal(lockedSchedule.body.code, 'RECURRING_SCHEDULE_LOCKED');
  const confirmKey = `confirm-run-${suffix}`;
  const concurrentConfirmations = await Promise.all([
    request(server)
      .post(`/api/v1/recurring-runs/${pendingRun.id}/confirm`)
      .set('authorization', `Bearer ${ownerAccess}`)
      .send({ amountCent: 32109, idempotencyKey: confirmKey }),
    request(server)
      .post(`/api/v1/recurring-runs/${pendingRun.id}/confirm`)
      .set('authorization', `Bearer ${ownerAccess}`)
      .send({ amountCent: 32109, idempotencyKey: confirmKey }),
  ]);
  assert.deepEqual(
    concurrentConfirmations.map((response) => response.status),
    [200, 200],
  );
  assert.equal(
    concurrentConfirmations[0].body.data.entryId,
    concurrentConfirmations[1].body.data.entryId,
  );
  assert.equal(concurrentConfirmations[0].body.data.amountCent, 32109);
  const confirmedEntry = await prisma.entry.findUniqueOrThrow({
    where: { id: concurrentConfirmations[0].body.data.entryId },
  });
  assert.equal(Number(confirmedEntry.amountCent), 32109);
  assert.equal(
    Number(
      (await prisma.recurringRule.findUniqueOrThrow({ where: { id: confirmRule.body.data.id } }))
        .amountCent,
    ),
    30000,
  );
  const changedConfirmation = await request(server)
    .post(`/api/v1/recurring-runs/${pendingRun.id}/confirm`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ amountCent: 32110, idempotencyKey: confirmKey })
    .expect(409);
  assert.equal(changedConfirmation.body.code, 'IDEMPOTENCY_CONFLICT');
  await request(server)
    .post(`/api/v1/recurring-rules/${confirmRule.body.data.id}/pause`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  const completedWhilePaused = await request(server)
    .patch(`/api/v1/recurring-rules/${confirmRule.body.data.id}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ totalOccurrences: 1 })
    .expect(200);
  assert.equal(completedWhilePaused.body.data.status, 'COMPLETED');
  assert.equal(completedWhilePaused.body.data.nextRunDate, null);

  const skipRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: '可跳过订阅',
      amountCent: 9900,
      generationMode: 'CONFIRM',
      idempotencyKey: `recurring-skip-${suffix}`,
    })
    .expect(201);
  const skipRun = await recurring.materializeDueRule(
    skipRule.body.data.id,
    new Date(`${skipRule.body.data.nextRunDate}T00:00:00.000Z`),
  );
  const skipped = await request(server)
    .post(`/api/v1/recurring-runs/${skipRun.id}/skip`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(skipped.body.data.status, 'SKIPPED');
  await request(server)
    .post(`/api/v1/recurring-runs/${skipRun.id}/skip`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(
    await prisma.entry.count({ where: { sourceType: 'RECURRING_RUN', sourceId: skipRun.id } }),
    0,
  );

  const retryRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: '失败后重试规则',
      idempotencyKey: `recurring-retry-${suffix}`,
    })
    .expect(201);
  await prisma.category.update({
    where: { id: personalExpenseCategory.id },
    data: { isEnabled: false },
  });
  await assert.rejects(
    recurring.materializeDueRule(
      retryRule.body.data.id,
      new Date(`${retryRule.body.data.nextRunDate}T00:00:00.000Z`),
    ),
    /RECURRING_CATEGORY_DISABLED/,
  );
  const failedRun = await prisma.recurringRun.findFirstOrThrow({
    where: { ruleId: retryRule.body.data.id },
  });
  assert.equal(failedRun.status, 'FAILED');
  assert.equal(failedRun.attempts, 1);
  const failedScheduleLock = await request(server)
    .patch(`/api/v1/recurring-rules/${retryRule.body.data.id}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ frequency: 'YEARLY' })
    .expect(409);
  assert.equal(failedScheduleLock.body.code, 'RECURRING_SCHEDULE_LOCKED');
  await prisma.category.update({
    where: { id: personalExpenseCategory.id },
    data: { isEnabled: true },
  });
  const retriedRun = await recurring.materializeDueRule(
    retryRule.body.data.id,
    new Date(`${retryRule.body.data.nextRunDate}T00:00:00.000Z`),
  );
  assert.equal(retriedRun.id, failedRun.id);
  assert.equal(retriedRun.status, 'GENERATED');
  assert.equal(retriedRun.attempts, 2);

  const coupleRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ledgerId: coupleLedgerId,
      name: '共同房租',
      entryType: 'EXPENSE',
      amountCent: 360000,
      categoryId: systemCategoryId,
      frequency: 'MONTHLY',
      startDate: '2026-07-01',
      generationMode: 'CONFIRM',
      idempotencyKey: `couple-recurring-${suffix}`,
    })
    .expect(201);
  await request(server)
    .get(`/api/v1/recurring-rules/${coupleRule.body.data.id}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .expect(200);
  await request(server)
    .patch(`/api/v1/recurring-rules/${coupleRule.body.data.id}`)
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({ name: '成员越权修改' })
    .expect(403);
  const memberRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${partner.accessToken}`)
    .send({
      ledgerId: coupleLedgerId,
      name: '成员创建订阅',
      entryType: 'EXPENSE',
      amountCent: 2500,
      categoryId: memberCategory.body.data.id,
      frequency: 'YEARLY',
      startDate: '2024-02-29',
      generationMode: 'CONFIRM',
      idempotencyKey: `member-recurring-${suffix}`,
    })
    .expect(201);
  await request(server)
    .post(`/api/v1/recurring-rules/${memberRule.body.data.id}/pause`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  const resumedMemberRule = await request(server)
    .post(`/api/v1/recurring-rules/${memberRule.body.data.id}/resume`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(resumedMemberRule.body.data.status, 'ACTIVE');
  const memberRuleScheduledDate = new Date(
    `${resumedMemberRule.body.data.nextRunDate}T00:00:00.000Z`,
  );
  const memberPendingRun = await recurring.materializeDueRule(
    memberRule.body.data.id,
    memberRuleScheduledDate,
  );
  assert.equal(memberPendingRun.status, 'PENDING');
  assert.deepEqual(
    (
      await prisma.notification.findMany({
        where: {
          type: 'RECURRING_CONFIRMATION_DUE',
          relatedType: 'RECURRING_RUN',
          relatedId: memberPendingRun.id,
        },
        orderBy: { userId: 'asc' },
        select: { userId: true },
      })
    ).map((notification) => notification.userId),
    [user.id, partner.user.id].sort(),
  );
  const visibleRuns = await request(server)
    .get('/api/v1/recurring-runs')
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(visibleRuns.body.data.total >= 3, true);

  const workerNow = new Date();
  const workerBusinessDate = dateOnly(businessToday(user.timezone, workerNow));
  const workerRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: 'Worker 自动入账',
      startDate: workerBusinessDate,
      totalOccurrences: 1,
      idempotencyKey: `recurring-worker-${suffix}`,
    })
    .expect(201);
  const workerLogs = [];
  activeWorkerRuntime = await startWorker({
    enqueueStartupScan: false,
    now: () => workerNow,
    log: (record) => workerLogs.push(record),
  });
  activeSecondWorkerRuntime = await startWorker({
    registerScheduler: false,
    enqueueStartupScan: false,
    now: () => workerNow,
    log: (record) => workerLogs.push(record),
  });
  assert.ok(await activeWorkerRuntime.recurringQueue.getJobScheduler(RECURRING_SCAN_SCHEDULER));
  activeQueueEvents = new QueueEvents(RECURRING_QUEUE, {
    connection: { url: readConfig().redisUrl },
  });
  await activeQueueEvents.waitUntilReady();
  const scanJob = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_SCAN_JOB,
    { trigger: 'test' },
    { jobId: `recurring-scan-e2e-${suffix}`, removeOnComplete: false },
  );
  await scanJob.waitUntilFinished(activeQueueEvents, 15_000);
  const workerMaterializeId = recurringMaterializeJobId(
    workerRule.body.data.id,
    workerBusinessDate,
  );
  const workerMaterializeJob = await activeWorkerRuntime.recurringQueue.getJob(workerMaterializeId);
  assert.ok(workerMaterializeJob);
  await workerMaterializeJob.waitUntilFinished(activeQueueEvents, 15_000);
  const workerRun = await prisma.recurringRun.findFirstOrThrow({
    where: { ruleId: workerRule.body.data.id },
  });
  assert.equal(workerRun.status, 'GENERATED');
  assert.equal(workerRun.attempts, 1);
  assert.equal(
    await prisma.entry.count({ where: { sourceType: 'RECURRING_RUN', sourceId: workerRun.id } }),
    1,
  );
  const duplicateWorkerJob = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_MATERIALIZE_JOB,
    { ruleId: workerRule.body.data.id, scheduledDate: workerBusinessDate },
    { jobId: workerMaterializeId },
  );
  assert.equal(duplicateWorkerJob.id, workerMaterializeId);
  await duplicateWorkerJob.waitUntilFinished(activeQueueEvents, 15_000);
  assert.equal(
    (
      await prisma.recurringRun.findFirstOrThrow({
        where: { ruleId: workerRule.body.data.id },
      })
    ).attempts,
    1,
  );

  const workerConfirmRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: 'Worker 待确认账目',
      startDate: workerBusinessDate,
      totalOccurrences: 1,
      generationMode: 'CONFIRM',
      idempotencyKey: `recurring-worker-confirm-${suffix}`,
    })
    .expect(201);
  const workerConfirmJob = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_MATERIALIZE_JOB,
    { ruleId: workerConfirmRule.body.data.id, scheduledDate: workerBusinessDate },
    {
      jobId: recurringMaterializeJobId(workerConfirmRule.body.data.id, workerBusinessDate),
    },
  );
  await workerConfirmJob.waitUntilFinished(activeQueueEvents, 15_000);
  const workerPendingRun = await prisma.recurringRun.findFirstOrThrow({
    where: { ruleId: workerConfirmRule.body.data.id },
  });
  assert.equal(workerPendingRun.status, 'PENDING');
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: user.id,
        type: 'RECURRING_CONFIRMATION_DUE',
        relatedType: 'RECURRING_RUN',
        relatedId: workerPendingRun.id,
      },
    }),
    1,
  );

  const staleRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: 'Worker 过期任务',
      startDate: workerBusinessDate,
      totalOccurrences: 1,
      idempotencyKey: `recurring-worker-stale-${suffix}`,
    })
    .expect(201);
  const staleDate = dateOnly(
    new Date(new Date(`${workerBusinessDate}T00:00:00.000Z`).getTime() - 86_400_000),
  );
  const staleJob = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_MATERIALIZE_JOB,
    { ruleId: staleRule.body.data.id, scheduledDate: staleDate },
    { jobId: recurringMaterializeJobId(staleRule.body.data.id, staleDate) },
  );
  assert.deepEqual(await staleJob.waitUntilFinished(activeQueueEvents, 15_000), {
    materialized: false,
  });
  assert.equal(await prisma.recurringRun.count({ where: { ruleId: staleRule.body.data.id } }), 0);

  const failedWorkerRule = await request(server)
    .post('/api/v1/recurring-rules')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      ...autoRulePayload,
      name: 'Worker 业务失败',
      startDate: workerBusinessDate,
      totalOccurrences: 1,
      idempotencyKey: `recurring-worker-failed-${suffix}`,
    })
    .expect(201);
  await prisma.category.update({
    where: { id: personalExpenseCategory.id },
    data: { isEnabled: false },
  });
  const failedWorkerJob = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_MATERIALIZE_JOB,
    { ruleId: failedWorkerRule.body.data.id, scheduledDate: workerBusinessDate },
    {
      jobId: recurringMaterializeJobId(failedWorkerRule.body.data.id, workerBusinessDate),
      attempts: 5,
      backoff: { type: 'exponential', delay: 100 },
      removeOnFail: false,
    },
  );
  await assert.rejects(
    failedWorkerJob.waitUntilFinished(activeQueueEvents, 15_000),
    /RECURRING_CATEGORY_DISABLED/,
  );
  const failedWorkerRun = await prisma.recurringRun.findFirstOrThrow({
    where: { ruleId: failedWorkerRule.body.data.id },
  });
  assert.equal(failedWorkerRun.status, 'FAILED');
  assert.equal(failedWorkerRun.attempts, 1);
  assert.equal(failedWorkerRun.lastError, 'RECURRING_CATEGORY_DISABLED');
  const failureRescan = await activeWorkerRuntime.recurringQueue.add(
    RECURRING_SCAN_JOB,
    { trigger: 'test' },
    { jobId: `recurring-failure-rescan-${suffix}`, removeOnComplete: false },
  );
  await failureRescan.waitUntilFinished(activeQueueEvents, 15_000);
  assert.equal(
    (
      await prisma.recurringRun.findFirstOrThrow({
        where: { ruleId: failedWorkerRule.body.data.id },
      })
    ).attempts,
    1,
  );
  await prisma.category.update({
    where: { id: personalExpenseCategory.id },
    data: { isEnabled: true },
  });
  assert.equal(JSON.stringify(workerLogs).includes('amountCent'), false);
  assert.equal(JSON.stringify(workerLogs).includes('Worker 自动入账'), false);
  await activeQueueEvents.close();
  activeQueueEvents = undefined;
  await activeSecondWorkerRuntime.close();
  activeSecondWorkerRuntime = undefined;
  await activeWorkerRuntime.close();
  activeWorkerRuntime = undefined;

  const salaryProfileKey = `salary-profile-${suffix}`;
  const salaryProfileBody = {
    name: '主工资',
    employerName: '测试公司',
    payDay: 10,
    defaultSyncEntry: true,
    defaultItems: [
      {
        itemType: 'EARNING',
        itemCode: 'base_salary',
        itemName: '基本工资',
        amountCent: 1_200_000,
        sortOrder: 100,
      },
      {
        itemType: 'DEDUCTION',
        itemCode: 'income_tax',
        itemName: '个人所得税',
        amountCent: 100_000,
        sortOrder: 200,
      },
    ],
    idempotencyKey: salaryProfileKey,
  };
  const salaryProfile = await request(server)
    .post('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(salaryProfileBody)
    .expect(201);
  const salaryProfileId = salaryProfile.body.data.id;
  assert.equal(salaryProfile.body.data.defaultItems.length, 2);
  assert.equal(JSON.stringify(salaryProfile.body).includes('createRequestHash'), false);
  assert.equal(JSON.stringify(salaryProfile.body).includes('idempotencyKey'), false);
  const salaryProfileReplay = await request(server)
    .post('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(salaryProfileBody)
    .expect(201);
  assert.equal(salaryProfileReplay.body.data.id, salaryProfileId);
  const salaryProfileConflict = await request(server)
    .post('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...salaryProfileBody, name: '不同工资', idempotencyKey: salaryProfileKey })
    .expect(409);
  assert.equal(salaryProfileConflict.body.code, 'IDEMPOTENCY_CONFLICT');
  const secondSalaryProfile = await request(server)
    .post('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...salaryProfileBody, name: '第二工资', idempotencyKey: `salary-second-${suffix}` })
    .expect(409);
  assert.equal(secondSalaryProfile.body.code, 'SALARY_PROFILE_EXISTS');
  await request(server)
    .patch(`/api/v1/salary/profiles/${salaryProfileId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ employerName: null, payDay: 12 })
    .expect(200);
  const ownerSalaryProfiles = await request(server)
    .get('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(ownerSalaryProfiles.body.data.items.length, 1);
  const outsiderSalaryProfiles = await request(server)
    .get('/api/v1/salary/profiles')
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(200);
  assert.equal(outsiderSalaryProfiles.body.data.items.length, 0);

  const julySalaryBody = {
    profileId: salaryProfileId,
    salaryMonth: '2026-07-01',
    items: [
      {
        itemType: 'EARNING',
        itemCode: 'base_salary',
        itemName: '基本工资',
        amountCent: 1_200_000,
        sortOrder: 100,
      },
      {
        itemType: 'EARNING',
        itemCode: 'bonus',
        itemName: '奖金',
        amountCent: 50_000,
        sortOrder: 150,
      },
      {
        itemType: 'DEDUCTION',
        itemCode: 'income_tax',
        itemName: '个人所得税',
        amountCent: 100_000,
        sortOrder: 200,
      },
    ],
    idempotencyKey: `salary-july-${suffix}`,
  };
  const julySalary = await request(server)
    .post('/api/v1/salary/records')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(julySalaryBody)
    .expect(201);
  const julySalaryId = julySalary.body.data.id;
  assert.equal(julySalary.body.data.grossCent, 1_250_000);
  assert.equal(julySalary.body.data.deductionCent, 100_000);
  assert.equal(julySalary.body.data.netCent, 1_150_000);
  assert.equal(julySalary.body.data.canEdit, true);
  const julySalaryReplay = await request(server)
    .post('/api/v1/salary/records')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send(julySalaryBody)
    .expect(201);
  assert.equal(julySalaryReplay.body.data.id, julySalaryId);
  const duplicateJulySalary = await request(server)
    .post('/api/v1/salary/records')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ ...julySalaryBody, idempotencyKey: `salary-july-duplicate-${suffix}` })
    .expect(409);
  assert.equal(duplicateJulySalary.body.code, 'SALARY_MONTH_DUPLICATE');

  const augustSalary = await request(server)
    .post('/api/v1/salary/records')
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      profileId: salaryProfileId,
      salaryMonth: '2026-08-01',
      copyPreviousMonth: true,
      idempotencyKey: `salary-august-${suffix}`,
    })
    .expect(201);
  const augustSalaryId = augustSalary.body.data.id;
  assert.equal(augustSalary.body.data.grossCent, 1_250_000);
  assert.deepEqual(
    augustSalary.body.data.items.map((item) => ({
      itemType: item.itemType,
      itemCode: item.itemCode,
      itemName: item.itemName,
      amountCent: item.amountCent,
      sortOrder: item.sortOrder,
    })),
    julySalary.body.data.items.map((item) => ({
      itemType: item.itemType,
      itemCode: item.itemCode,
      itemName: item.itemName,
      amountCent: item.amountCent,
      sortOrder: item.sortOrder,
    })),
  );
  const updatedAugustSalary = await request(server)
    .patch(`/api/v1/salary/records/${augustSalaryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({
      items: [
        {
          itemType: 'EARNING',
          itemCode: 'base_salary',
          itemName: '基本工资',
          amountCent: 1_300_000,
          sortOrder: 100,
        },
        {
          itemType: 'DEDUCTION',
          itemCode: 'income_tax',
          itemName: '个人所得税',
          amountCent: 110_000,
          sortOrder: 200,
        },
      ],
    })
    .expect(200);
  assert.equal(updatedAugustSalary.body.data.netCent, 1_190_000);
  const salaryList = await request(server)
    .get('/api/v1/salary/records')
    .query({ year: 2026, profileId: salaryProfileId })
    .set('authorization', `Bearer ${ownerAccess}`)
    .expect(200);
  assert.equal(salaryList.body.data.total, 2);
  assert.deepEqual(
    salaryList.body.data.items.map((item) => item.salaryMonth),
    ['2026-08-01', '2026-07-01'],
  );
  await request(server)
    .get(`/api/v1/salary/records/${julySalaryId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .expect(404);
  await request(server)
    .patch(`/api/v1/salary/records/${julySalaryId}`)
    .set('authorization', `Bearer ${outsider.accessToken}`)
    .send({ items: julySalaryBody.items })
    .expect(404);
  await prisma.salaryRecord.update({
    where: { id: julySalaryId },
    data: { paymentStatus: 'PAID', paidDate: new Date('2026-07-12T00:00:00.000Z') },
  });
  const immutablePaidSalary = await request(server)
    .patch(`/api/v1/salary/records/${julySalaryId}`)
    .set('authorization', `Bearer ${ownerAccess}`)
    .send({ items: julySalaryBody.items })
    .expect(409);
  assert.equal(immutablePaidSalary.body.code, 'SALARY_ALREADY_PAID');

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
    .get(`/api/v1/entries/${ownerCoupleEntry.body.data.id}`)
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
  await request(server)
    .get(`/api/v1/entries/${ownerCoupleEntry.body.data.id}`)
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
  console.log(
    'API health, authentication, couple ledger, category, Entry, debt, recurring, and salary E2E passed.',
  );
}

main().catch(async (error) => {
  console.error(error);
  await closeResources();
  process.exitCode = 1;
});
