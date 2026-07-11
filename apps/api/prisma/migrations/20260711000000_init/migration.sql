-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PERSONAL', 'COUPLE');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('ACTIVE', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EntrySourceType" AS ENUM ('MANUAL', 'SALARY', 'DEBT_TRANSACTION', 'RECURRING_RUN');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('BORROWED', 'LENT');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'SETTLED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('AUTO', 'CONFIRM');

-- CreateEnum
CREATE TYPE "RecurringRuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringRunStatus" AS ENUM ('PENDING', 'GENERATED', 'CONFIRMED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "SalaryItemType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "SalaryPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "SavingGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "qq_open_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" UUID NOT NULL,
    "type" "LedgerType" NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_members" (
    "id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ,

    CONSTRAINT "ledger_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_invitations" (
    "id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "inviter_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_by_user_id" UUID,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "type" "EntryType" NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "creator_user_id" UUID NOT NULL,
    "type" "EntryType" NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "category_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "note" TEXT,
    "payment_method" TEXT,
    "source_type" "EntrySourceType" NOT NULL DEFAULT 'MANUAL',
    "source_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "counterparty_name" TEXT NOT NULL,
    "principal_cent" BIGINT NOT NULL,
    "processed_cent" BIGINT NOT NULL DEFAULT 0,
    "remaining_cent" BIGINT NOT NULL,
    "start_date" DATE NOT NULL,
    "due_date" DATE,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_transactions" (
    "id" UUID NOT NULL,
    "debt_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "business_date" DATE NOT NULL,
    "sync_entry" BOOLEAN NOT NULL DEFAULT false,
    "entry_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "debt_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_rules" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "entry_type" "EntryType" NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "category_id" UUID NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "interval_value" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "total_occurrences" INTEGER,
    "completed_occurrences" INTEGER NOT NULL DEFAULT 0,
    "next_run_date" DATE,
    "generation_mode" "GenerationMode" NOT NULL,
    "status" "RecurringRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "reminder_days_before" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_runs" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "status" "RecurringRunStatus" NOT NULL DEFAULT 'PENDING',
    "entry_id" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recurring_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "employer_name" TEXT,
    "pay_day" INTEGER NOT NULL,
    "default_sync_entry" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "salary_month" DATE NOT NULL,
    "gross_cent" BIGINT NOT NULL,
    "deduction_cent" BIGINT NOT NULL,
    "net_cent" BIGINT NOT NULL,
    "payment_status" "SalaryPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paid_date" DATE,
    "entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_items" (
    "id" UUID NOT NULL,
    "salary_record_id" UUID NOT NULL,
    "item_type" "SalaryItemType" NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "salary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_goals" (
    "id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "creator_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_cent" BIGINT NOT NULL,
    "initial_cent" BIGINT NOT NULL DEFAULT 0,
    "saved_cent" BIGINT NOT NULL DEFAULT 0,
    "target_date" DATE,
    "status" "SavingGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "cover_url" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "saving_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_contributions" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_cent" BIGINT NOT NULL,
    "business_date" DATE NOT NULL,
    "note" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "saving_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "related_type" TEXT,
    "related_id" UUID,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "request_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_qq_open_id_key" ON "users"("qq_open_id");

-- CreateIndex
CREATE INDEX "ledgers_owner_user_id_type_status_idx" ON "ledgers"("owner_user_id", "type", "status");

-- CreateIndex
CREATE INDEX "ledger_members_user_id_status_idx" ON "ledger_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_members_ledger_id_user_id_key" ON "ledger_members"("ledger_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_invitations_token_hash_key" ON "ledger_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "ledger_invitations_ledger_id_status_idx" ON "ledger_invitations"("ledger_id", "status");

-- CreateIndex
CREATE INDEX "categories_owner_user_id_type_is_enabled_idx" ON "categories"("owner_user_id", "type", "is_enabled");

-- CreateIndex
CREATE INDEX "entries_ledger_id_business_date_idx" ON "entries"("ledger_id", "business_date");

-- CreateIndex
CREATE INDEX "entries_ledger_id_type_business_date_idx" ON "entries"("ledger_id", "type", "business_date");

-- CreateIndex
CREATE INDEX "entries_ledger_id_category_id_business_date_idx" ON "entries"("ledger_id", "category_id", "business_date");

-- CreateIndex
CREATE INDEX "entries_ledger_id_creator_user_id_business_date_idx" ON "entries"("ledger_id", "creator_user_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "entries_creator_user_id_idempotency_key_key" ON "entries"("creator_user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "debts_user_id_status_due_date_idx" ON "debts"("user_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "debt_transactions_entry_id_key" ON "debt_transactions"("entry_id");

-- CreateIndex
CREATE INDEX "debt_transactions_debt_id_business_date_idx" ON "debt_transactions"("debt_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "debt_transactions_user_id_idempotency_key_key" ON "debt_transactions"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "recurring_rules_status_next_run_date_idx" ON "recurring_rules"("status", "next_run_date");

-- CreateIndex
CREATE INDEX "recurring_rules_owner_user_id_ledger_id_idx" ON "recurring_rules"("owner_user_id", "ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_runs_entry_id_key" ON "recurring_runs"("entry_id");

-- CreateIndex
CREATE INDEX "recurring_runs_status_scheduled_date_idx" ON "recurring_runs"("status", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_runs_rule_id_scheduled_date_key" ON "recurring_runs"("rule_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "salary_profiles_user_id_status_idx" ON "salary_profiles"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_entry_id_key" ON "salary_records"("entry_id");

-- CreateIndex
CREATE INDEX "salary_records_user_id_salary_month_idx" ON "salary_records"("user_id", "salary_month");

-- CreateIndex
CREATE INDEX "salary_items_salary_record_id_item_type_idx" ON "salary_items"("salary_record_id", "item_type");

-- CreateIndex
CREATE INDEX "saving_goals_ledger_id_status_idx" ON "saving_goals"("ledger_id", "status");

-- CreateIndex
CREATE INDEX "saving_contributions_goal_id_business_date_idx" ON "saving_contributions"("goal_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "saving_contributions_user_id_idempotency_key_key" ON "saving_contributions"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_members" ADD CONSTRAINT "ledger_members_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_members" ADD CONSTRAINT "ledger_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invitations" ADD CONSTRAINT "ledger_invitations_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invitations" ADD CONSTRAINT "ledger_invitations_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invitations" ADD CONSTRAINT "ledger_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "recurring_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_profiles" ADD CONSTRAINT "salary_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "salary_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_items" ADD CONSTRAINT "salary_items_salary_record_id_fkey" FOREIGN KEY ("salary_record_id") REFERENCES "salary_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_contributions" ADD CONSTRAINT "saving_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "saving_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_contributions" ADD CONSTRAINT "saving_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Confirmed business invariants that Prisma schema metadata does not fully express.
CREATE UNIQUE INDEX "ledgers_one_active_personal_per_owner"
ON "ledgers"("owner_user_id")
WHERE "type" = 'PERSONAL' AND "status" = 'ACTIVE' AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "entries_source_type_source_id_key"
ON "entries"("source_type", "source_id")
WHERE "source_id" IS NOT NULL;

CREATE UNIQUE INDEX "salary_records_active_profile_month_key"
ON "salary_records"("profile_id", "salary_month")
WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "debts_id_user_id_key" ON "debts"("id", "user_id");
CREATE UNIQUE INDEX "salary_profiles_id_user_id_key" ON "salary_profiles"("id", "user_id");

ALTER TABLE "debt_transactions"
ADD CONSTRAINT "debt_transactions_debt_user_fkey"
FOREIGN KEY ("debt_id", "user_id") REFERENCES "debts"("id", "user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_records"
ADD CONSTRAINT "salary_records_profile_user_fkey"
FOREIGN KEY ("profile_id", "user_id") REFERENCES "salary_profiles"("id", "user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entries"
ADD CONSTRAINT "entries_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991),
ADD CONSTRAINT "entries_source_consistent" CHECK (
  ("source_type" = 'MANUAL' AND "source_id" IS NULL)
  OR ("source_type" <> 'MANUAL' AND "source_id" IS NOT NULL)
);

ALTER TABLE "debts"
ADD CONSTRAINT "debts_amounts_valid" CHECK (
  "principal_cent" > 0
  AND "principal_cent" <= 9007199254740991
  AND "processed_cent" >= 0
  AND "processed_cent" <= 9007199254740991
  AND "remaining_cent" >= 0
  AND "remaining_cent" <= 9007199254740991
  AND "processed_cent" + "remaining_cent" = "principal_cent"
),
ADD CONSTRAINT "debts_dates_valid" CHECK ("due_date" IS NULL OR "due_date" >= "start_date");

ALTER TABLE "debt_transactions"
ADD CONSTRAINT "debt_transactions_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991),
ADD CONSTRAINT "debt_transactions_entry_consistent" CHECK (
  ("sync_entry" AND "entry_id" IS NOT NULL)
  OR (NOT "sync_entry" AND "entry_id" IS NULL)
);

ALTER TABLE "recurring_rules"
ADD CONSTRAINT "recurring_rules_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991),
ADD CONSTRAINT "recurring_rules_interval_positive" CHECK ("interval_value" > 0),
ADD CONSTRAINT "recurring_rules_occurrences_valid" CHECK (
  "completed_occurrences" >= 0
  AND ("total_occurrences" IS NULL OR "total_occurrences" > 0)
  AND ("total_occurrences" IS NULL OR "completed_occurrences" <= "total_occurrences")
),
ADD CONSTRAINT "recurring_rules_dates_valid" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
ADD CONSTRAINT "recurring_rules_reminder_valid" CHECK ("reminder_days_before" >= 0);

ALTER TABLE "recurring_runs"
ADD CONSTRAINT "recurring_runs_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991),
ADD CONSTRAINT "recurring_runs_attempts_valid" CHECK ("attempts" >= 0),
ADD CONSTRAINT "recurring_runs_entry_consistent" CHECK (
  ("status" IN ('GENERATED', 'CONFIRMED') AND "entry_id" IS NOT NULL)
  OR ("status" IN ('PENDING', 'SKIPPED', 'FAILED') AND "entry_id" IS NULL)
);

ALTER TABLE "salary_profiles"
ADD CONSTRAINT "salary_profiles_pay_day_valid" CHECK ("pay_day" BETWEEN 1 AND 31);

ALTER TABLE "salary_records"
ADD CONSTRAINT "salary_records_month_normalized" CHECK (
  "salary_month" = date_trunc('month', "salary_month")::date
),
ADD CONSTRAINT "salary_records_amounts_valid" CHECK (
  "gross_cent" >= 0
  AND "gross_cent" <= 9007199254740991
  AND "deduction_cent" >= 0
  AND "deduction_cent" <= 9007199254740991
  AND "net_cent" >= 0
  AND "net_cent" <= 9007199254740991
  AND "gross_cent" = "deduction_cent" + "net_cent"
),
ADD CONSTRAINT "salary_records_payment_consistent" CHECK (
  ("payment_status" = 'UNPAID' AND "paid_date" IS NULL AND "entry_id" IS NULL)
  OR ("payment_status" = 'PAID' AND "paid_date" IS NOT NULL)
);

ALTER TABLE "salary_items"
ADD CONSTRAINT "salary_items_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991),
ADD CONSTRAINT "salary_items_sort_order_valid" CHECK ("sort_order" >= 0);

ALTER TABLE "saving_goals"
ADD CONSTRAINT "saving_goals_amounts_valid" CHECK (
  "target_cent" > 0
  AND "target_cent" <= 9007199254740991
  AND "initial_cent" >= 0
  AND "initial_cent" <= 9007199254740991
  AND "saved_cent" >= "initial_cent"
  AND "saved_cent" <= 9007199254740991
);

ALTER TABLE "saving_contributions"
ADD CONSTRAINT "saving_contributions_amount_positive" CHECK ("amount_cent" > 0 AND "amount_cent" <= 9007199254740991);
