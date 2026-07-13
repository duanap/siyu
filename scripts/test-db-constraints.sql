CREATE OR REPLACE FUNCTION pg_temp.expect_sqlstate(
  statement text,
  expected_state text,
  test_name text
) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RETURN;
    END IF;
    RAISE EXCEPTION '%: expected SQLSTATE %, got % (%)', test_name, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION '%: statement unexpectedly succeeded', test_name;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  required_tables integer;
  required_indexes integer;
  required_constraints integer;
  required_delete_actions integer;
BEGIN
  SELECT count(*) INTO required_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'users', 'ledgers', 'ledger_members', 'ledger_invitations', 'categories',
      'entries', 'debts', 'debt_transactions', 'recurring_rules', 'recurring_runs',
      'salary_profiles', 'salary_records', 'salary_items', 'saving_goals',
      'saving_contributions', 'notifications', 'audit_logs'
    );
  IF required_tables <> 17 THEN
    RAISE EXCEPTION 'Expected 17 application tables, found %', required_tables;
  END IF;

  SELECT count(*) INTO required_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'users_qq_open_id_key',
      'ledger_members_ledger_id_user_id_key',
      'ledger_invitations_token_hash_key',
      'entries_creator_user_id_idempotency_key_key',
      'entries_source_type_source_id_key',
      'debt_transactions_entry_id_key',
      'debt_transactions_user_id_idempotency_key_key',
      'recurring_runs_entry_id_key',
      'recurring_runs_rule_id_scheduled_date_key',
      'salary_records_entry_id_key',
      'salary_records_active_profile_month_key',
      'saving_contributions_user_id_idempotency_key_key',
      'ledgers_one_active_personal_per_owner',
      'debts_id_user_id_key',
      'salary_profiles_id_user_id_key'
    );
  IF required_indexes <> 15 THEN
    RAISE EXCEPTION 'Expected 15 critical unique indexes, found %', required_indexes;
  END IF;

  SELECT count(*) INTO required_constraints
  FROM pg_constraint
  WHERE conname IN (
    'entries_amount_positive', 'entries_source_consistent',
    'debts_amounts_valid', 'debts_dates_valid',
    'debt_transactions_amount_positive', 'debt_transactions_entry_consistent',
    'debt_transactions_debt_user_fkey',
    'recurring_rules_amount_positive', 'recurring_rules_interval_positive',
    'recurring_rules_occurrences_valid', 'recurring_rules_dates_valid',
    'recurring_rules_reminder_valid', 'recurring_runs_amount_positive',
    'recurring_runs_attempts_valid', 'recurring_runs_entry_consistent',
    'salary_profiles_pay_day_valid', 'salary_records_month_normalized',
    'salary_records_amounts_valid', 'salary_records_payment_consistent',
    'salary_records_profile_user_fkey', 'salary_items_amount_positive',
    'salary_items_sort_order_valid', 'saving_goals_amounts_valid',
    'saving_contributions_amount_positive'
  );
  IF required_constraints <> 24 THEN
    RAISE EXCEPTION 'Expected 24 custom constraints, found %', required_constraints;
  END IF;

  SELECT count(*) INTO required_delete_actions
  FROM pg_constraint
  WHERE (conname, confdeltype) IN (
    ('debt_transactions_entry_id_fkey', 'r'),
    ('recurring_runs_entry_id_fkey', 'r'),
    ('salary_records_entry_id_fkey', 'n'),
    ('salary_items_salary_record_id_fkey', 'c'),
    ('categories_owner_user_id_fkey', 'n'),
    ('ledger_invitations_accepted_by_user_id_fkey', 'n'),
    ('audit_logs_actor_user_id_fkey', 'n')
  );
  IF required_delete_actions <> 7 THEN
    RAISE EXCEPTION 'Expected 7 critical delete actions, found %', required_delete_actions;
  END IF;
END $$;

INSERT INTO users (id, qq_open_id, nickname, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'task-000-user-1', '测试用户一', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'task-000-user-2', '测试用户二', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000003', 'task-000-user-3', '分类归属用户', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000004', 'task-000-user-4', '审计归属用户', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000005', 'task-000-user-5', '邀请接受用户', CURRENT_TIMESTAMP);

SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO users (id, qq_open_id, nickname, updated_at)
       VALUES ('00000000-0000-0000-0000-000000000006', 'task-000-user-1', '重复', CURRENT_TIMESTAMP)$sql$,
  '23505', 'users qq_open_id unique'
);

INSERT INTO ledgers (id, type, name, owner_user_id, status, updated_at, deleted_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'PERSONAL', '个人账本', '00000000-0000-0000-0000-000000000001', 'ACTIVE', CURRENT_TIMESTAMP, NULL),
  ('00000000-0000-0000-0000-000000000011', 'COUPLE', '朝暮同笺', '00000000-0000-0000-0000-000000000001', 'ACTIVE', CURRENT_TIMESTAMP, NULL),
  ('00000000-0000-0000-0000-000000000012', 'PERSONAL', '已解散记录', '00000000-0000-0000-0000-000000000001', 'DISSOLVED', CURRENT_TIMESTAMP, NULL),
  ('00000000-0000-0000-0000-000000000013', 'PERSONAL', '已删除记录', '00000000-0000-0000-0000-000000000001', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO ledgers (id, type, name, owner_user_id, updated_at)
       VALUES ('00000000-0000-0000-0000-000000000014', 'PERSONAL', '重复个人账本',
               '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP)$sql$,
  '23505', 'one active personal ledger per owner'
);

INSERT INTO ledger_members (id, ledger_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'OWNER');
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO ledger_members (id, ledger_id, user_id, role)
       VALUES ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011',
               '00000000-0000-0000-0000-000000000001', 'MEMBER')$sql$,
  '23505', 'ledger member unique'
);

INSERT INTO ledger_invitations (
  id, ledger_id, inviter_user_id, token_hash, expires_at, accepted_by_user_id
) VALUES (
  '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001', 'task-000-token', CURRENT_TIMESTAMP + INTERVAL '1 day',
  '00000000-0000-0000-0000-000000000005'
);
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO ledger_invitations (id, ledger_id, inviter_user_id, token_hash, expires_at)
       VALUES ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000011',
               '00000000-0000-0000-0000-000000000001', 'task-000-token', CURRENT_TIMESTAMP + INTERVAL '1 day')$sql$,
  '23505', 'invitation token unique'
);

INSERT INTO categories (id, owner_user_id, type, name, is_system, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000030', NULL, 'EXPENSE', '系统分类', true, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000003', 'EXPENSE', '个人分类', false, CURRENT_TIMESTAMP);

INSERT INTO entries (
  id, ledger_id, creator_user_id, type, amount_cent, category_id,
  business_date, source_type, source_id, idempotency_key, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'shared-key', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'shared-key', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'RECURRING_RUN', '00000000-0000-0000-0000-000000000090', 'source-key', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'debt-entry', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'recurring-entry', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'INCOME', 9000, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'salary-entry', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', NULL, 'manual-null-source', CURRENT_TIMESTAMP);

SELECT pg_temp.expect_sqlstate($sql$UPDATE entries SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000040'$sql$, '23514', 'entry amount positive');
SELECT pg_temp.expect_sqlstate($sql$UPDATE entries SET amount_cent = 9007199254740992 WHERE id = '00000000-0000-0000-0000-000000000040'$sql$, '23514', 'entry safe integer');
SELECT pg_temp.expect_sqlstate($sql$UPDATE entries SET source_type = 'SALARY', source_id = NULL WHERE id = '00000000-0000-0000-0000-000000000040'$sql$, '23514', 'non-manual source requires id');
SELECT pg_temp.expect_sqlstate($sql$UPDATE entries SET source_type = 'MANUAL', source_id = '00000000-0000-0000-0000-000000000099' WHERE id = '00000000-0000-0000-0000-000000000040'$sql$, '23514', 'manual source forbids id');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, idempotency_key, updated_at) VALUES ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 200, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'shared-key', CURRENT_TIMESTAMP)$sql$, '23505', 'entry user idempotency unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, source_type, source_id, idempotency_key, updated_at) VALUES ('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'RECURRING_RUN', '00000000-0000-0000-0000-000000000090', 'different-user-source', CURRENT_TIMESTAMP)$sql$, '23505', 'entry source unique');

INSERT INTO debts (id, user_id, direction, counterparty_name, principal_cent, remaining_cent, start_date, due_date, updated_at)
VALUES ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 'BORROWED', '归属测试', 1000, 1000, '2026-07-11', '2026-08-11', CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE debts SET processed_cent = 100, remaining_cent = 100 WHERE id = '00000000-0000-0000-0000-000000000050'$sql$, '23514', 'debt amount equation');
SELECT pg_temp.expect_sqlstate($sql$UPDATE debts SET due_date = '2026-07-10' WHERE id = '00000000-0000-0000-0000-000000000050'$sql$, '23514', 'debt due date');

INSERT INTO debt_transactions (id, debt_id, user_id, amount_cent, business_date, sync_entry, entry_id, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 100, '2026-07-11', true, '00000000-0000-0000-0000-000000000043', 'shared-key');
SELECT pg_temp.expect_sqlstate($sql$UPDATE debt_transactions SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000051'$sql$, '23514', 'debt transaction amount');
SELECT pg_temp.expect_sqlstate($sql$UPDATE debt_transactions SET sync_entry = false WHERE id = '00000000-0000-0000-0000-000000000051'$sql$, '23514', 'debt transaction entry consistency');
SELECT pg_temp.expect_sqlstate($sql$UPDATE debt_transactions SET entry_id = NULL WHERE id = '00000000-0000-0000-0000-000000000051'$sql$, '23514', 'debt transaction synced entry required');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO debt_transactions (id, debt_id, user_id, amount_cent, business_date, idempotency_key) VALUES ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000002', 100, '2026-07-11', 'wrong-owner')$sql$, '23503', 'debt transaction owner composite fk');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO debt_transactions (id, debt_id, user_id, amount_cent, business_date, sync_entry, entry_id, idempotency_key) VALUES ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 100, '2026-07-11', true, '00000000-0000-0000-0000-000000000043', 'other-entry-key')$sql$, '23505', 'debt transaction entry unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO debt_transactions (id, debt_id, user_id, amount_cent, business_date, idempotency_key) VALUES ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 100, '2026-07-11', 'shared-key')$sql$, '23505', 'debt transaction idempotency unique');

INSERT INTO recurring_rules (id, owner_user_id, ledger_id, name, entry_type, amount_cent, category_id, frequency, start_date, end_date, total_occurrences, generation_mode, updated_at)
VALUES ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '月租', 'EXPENSE', 1000, '00000000-0000-0000-0000-000000000030', 'MONTHLY', '2026-07-01', '2026-12-01', 6, 'AUTO', CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring rule amount');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET interval_value = 0 WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring interval');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET total_occurrences = 0 WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring total occurrences');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET completed_occurrences = 7 WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring completed occurrences');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET end_date = '2026-06-30' WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring dates');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_rules SET reminder_days_before = -1 WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23514', 'recurring reminder');

INSERT INTO recurring_runs (id, rule_id, scheduled_date, amount_cent, status, entry_id, updated_at)
VALUES ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000060', '2026-07-01', 1000, 'GENERATED', '00000000-0000-0000-0000-000000000044', CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_runs SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000061'$sql$, '23514', 'recurring run amount');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_runs SET attempts = -1 WHERE id = '00000000-0000-0000-0000-000000000061'$sql$, '23514', 'recurring run attempts');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_runs SET status = 'PENDING' WHERE id = '00000000-0000-0000-0000-000000000061'$sql$, '23514', 'pending run forbids entry');
SELECT pg_temp.expect_sqlstate($sql$UPDATE recurring_runs SET entry_id = NULL WHERE id = '00000000-0000-0000-0000-000000000061'$sql$, '23514', 'generated run requires entry');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO recurring_runs (id, rule_id, scheduled_date, amount_cent, updated_at) VALUES ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000060', '2026-07-01', 1000, CURRENT_TIMESTAMP)$sql$, '23505', 'recurring rule date unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO recurring_runs (id, rule_id, scheduled_date, amount_cent, status, entry_id, updated_at) VALUES ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000060', '2026-08-01', 1000, 'GENERATED', '00000000-0000-0000-0000-000000000044', CURRENT_TIMESTAMP)$sql$, '23505', 'recurring entry unique');

INSERT INTO salary_profiles (id, user_id, name, pay_day, updated_at)
VALUES ('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000001', '主工资', 10, CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_profiles SET pay_day = 0 WHERE id = '00000000-0000-0000-0000-000000000070'$sql$, '23514', 'salary pay day');

INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, payment_status, paid_date, entry_id, updated_at)
VALUES ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '2026-07-01', 10000, 1000, 9000, 'PAID', '2026-07-10', '00000000-0000-0000-0000-000000000045', CURRENT_TIMESTAMP);
INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, deleted_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '2026-07-01', 10000, 1000, 9000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_records SET salary_month = '2026-07-02' WHERE id = '00000000-0000-0000-0000-000000000071'$sql$, '23514', 'salary month normalized');
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_records SET net_cent = 8000 WHERE id = '00000000-0000-0000-0000-000000000071'$sql$, '23514', 'salary amount equation');
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_records SET payment_status = 'UNPAID' WHERE id = '00000000-0000-0000-0000-000000000071'$sql$, '23514', 'unpaid salary consistency');
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_records SET paid_date = NULL WHERE id = '00000000-0000-0000-0000-000000000071'$sql$, '23514', 'paid salary date required');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, updated_at) VALUES ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000070', '2026-08-01', 10000, 1000, 9000, CURRENT_TIMESTAMP)$sql$, '23503', 'salary profile owner composite fk');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, updated_at) VALUES ('00000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '2026-07-01', 10000, 1000, 9000, CURRENT_TIMESTAMP)$sql$, '23505', 'active salary month unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, payment_status, paid_date, entry_id, updated_at) VALUES ('00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '2026-08-01', 10000, 1000, 9000, 'PAID', '2026-08-10', '00000000-0000-0000-0000-000000000045', CURRENT_TIMESTAMP)$sql$, '23505', 'salary entry unique');

INSERT INTO salary_items (id, salary_record_id, item_type, item_code, item_name, amount_cent)
VALUES ('00000000-0000-0000-0000-000000000076', '00000000-0000-0000-0000-000000000071', 'EARNING', 'base', '基本工资', 10000);
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_items SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000076'$sql$, '23514', 'salary item amount');
SELECT pg_temp.expect_sqlstate($sql$UPDATE salary_items SET sort_order = -1 WHERE id = '00000000-0000-0000-0000-000000000076'$sql$, '23514', 'salary item sort');

INSERT INTO saving_goals (id, ledger_id, creator_user_id, name, target_cent, initial_cent, saved_cent, updated_at)
VALUES ('00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '旅行', 100000, 1000, 1000, CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE saving_goals SET target_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000080'$sql$, '23514', 'saving goal target');
SELECT pg_temp.expect_sqlstate($sql$UPDATE saving_goals SET saved_cent = 999 WHERE id = '00000000-0000-0000-0000-000000000080'$sql$, '23514', 'saving goal saved amount');

INSERT INTO saving_contributions (id, goal_id, user_id, amount_cent, business_date, idempotency_key, updated_at)
VALUES ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000001', 100, '2026-07-11', 'shared-key', CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$UPDATE saving_contributions SET amount_cent = 0 WHERE id = '00000000-0000-0000-0000-000000000081'$sql$, '23514', 'saving contribution amount');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO saving_contributions (id, goal_id, user_id, amount_cent, business_date, idempotency_key, updated_at) VALUES ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000001', 100, '2026-07-11', 'shared-key', CURRENT_TIMESTAMP)$sql$, '23505', 'saving contribution idempotency unique');

SELECT pg_temp.expect_sqlstate($sql$DELETE FROM entries WHERE id = '00000000-0000-0000-0000-000000000043'$sql$, '23503', 'debt-linked entry delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM entries WHERE id = '00000000-0000-0000-0000-000000000044'$sql$, '23503', 'recurring-linked entry delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM debts WHERE id = '00000000-0000-0000-0000-000000000050'$sql$, '23503', 'debt delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM recurring_rules WHERE id = '00000000-0000-0000-0000-000000000060'$sql$, '23503', 'recurring rule delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM saving_goals WHERE id = '00000000-0000-0000-0000-000000000080'$sql$, '23503', 'saving goal delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM ledgers WHERE id = '00000000-0000-0000-0000-000000000010'$sql$, '23503', 'ledger delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM categories WHERE id = '00000000-0000-0000-0000-000000000030'$sql$, '23503', 'category delete restrict');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'$sql$, '23503', 'user delete restrict');

DELETE FROM entries WHERE id = '00000000-0000-0000-0000-000000000045';
DO $$ BEGIN
  IF (SELECT entry_id IS NOT NULL FROM salary_records WHERE id = '00000000-0000-0000-0000-000000000071') THEN
    RAISE EXCEPTION 'salary record entry_id should be set null';
  END IF;
END $$;

DELETE FROM users WHERE id IN (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000005'
);
DO $$ BEGIN
  IF (SELECT owner_user_id IS NOT NULL FROM categories WHERE id = '00000000-0000-0000-0000-000000000031') THEN
    RAISE EXCEPTION 'category owner should be set null';
  END IF;
  IF (SELECT accepted_by_user_id IS NOT NULL FROM ledger_invitations WHERE id = '00000000-0000-0000-0000-000000000022') THEN
    RAISE EXCEPTION 'invitation accepted_by should be set null';
  END IF;
END $$;

INSERT INTO audit_logs (id, actor_user_id, actor_type, action, target_type)
VALUES ('00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000004', 'USER', 'TEST', 'TASK');
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000004';
DO $$ BEGIN
  IF (SELECT actor_user_id IS NOT NULL FROM audit_logs WHERE id = '00000000-0000-0000-0000-000000000091') THEN
    RAISE EXCEPTION 'audit actor should be set null';
  END IF;
END $$;

INSERT INTO salary_records (id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, updated_at)
VALUES ('00000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '2026-09-01', 10000, 1000, 9000, CURRENT_TIMESTAMP);
INSERT INTO salary_items (id, salary_record_id, item_type, item_code, item_name, amount_cent)
VALUES ('00000000-0000-0000-0000-000000000093', '00000000-0000-0000-0000-000000000092', 'EARNING', 'cascade', '级联测试', 10000);
DELETE FROM salary_records WHERE id = '00000000-0000-0000-0000-000000000092';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM salary_items WHERE id = '00000000-0000-0000-0000-000000000093') THEN
    RAISE EXCEPTION 'salary item should be cascade deleted';
  END IF;
END $$;

INSERT INTO user_credentials (id, user_id, email_normalized, password_hash, updated_at)
VALUES ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'constraint@example.com', '$argon2id$test-only-hash', CURRENT_TIMESTAMP);
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO user_credentials (id, user_id, email_normalized, password_hash, updated_at) VALUES ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'constraint@example.com', 'hash', CURRENT_TIMESTAMP)$sql$, '23505', 'credential normalized email unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO user_credentials (id, user_id, email_normalized, password_hash, updated_at) VALUES ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'UPPER@example.com', 'hash', CURRENT_TIMESTAMP)$sql$, '23514', 'credential normalized email check');

INSERT INTO auth_sessions (id, user_id, expires_at)
VALUES ('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP + INTERVAL '30 days');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '1 minute')$sql$, '23514', 'session expiry check');
SELECT pg_temp.expect_sqlstate($sql$UPDATE auth_sessions SET status = 'REVOKED' WHERE id = '30000000-0000-0000-0000-000000000010'$sql$, '23514', 'session revocation state check');

INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at)
VALUES ('30000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000010', repeat('a', 64), CURRENT_TIMESTAMP + INTERVAL '30 days');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at) VALUES ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000010', repeat('a', 64), CURRENT_TIMESTAMP + INTERVAL '30 days')$sql$, '23505', 'refresh digest unique');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM auth_sessions WHERE id = '30000000-0000-0000-0000-000000000010'$sql$, '23503', 'session delete restrict');

INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
VALUES ('30000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', repeat('b', 64), CURRENT_TIMESTAMP + INTERVAL '30 minutes');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('30000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000002', repeat('b', 64), CURRENT_TIMESTAMP + INTERVAL '30 minutes')$sql$, '23505', 'reset digest unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('30000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000002', repeat('c', 64), CURRENT_TIMESTAMP - INTERVAL '1 minute')$sql$, '23514', 'reset expiry check');

INSERT INTO user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO user_roles (user_id, role_id) VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')$sql$, '23505', 'user role composite unique');
SELECT pg_temp.expect_sqlstate($sql$INSERT INTO user_roles (user_id, role_id) VALUES ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000009999')$sql$, '23503', 'user role foreign key');
SELECT pg_temp.expect_sqlstate($sql$DELETE FROM roles WHERE code = 'USER'$sql$, '23503', 'role delete restrict');

SELECT 'database constraint verification passed' AS result;
