-- TASK-012 / BR-RECUR-001..016: recurring rule idempotency, membership,
-- run confirmation facts and deferred source-entry consistency.

ALTER TABLE "recurring_rules"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "create_request_hash" TEXT;

UPDATE "recurring_rules"
SET
  "idempotency_key" = 'legacy:' || "id"::text,
  "create_request_hash" = 'legacy:' || "id"::text
WHERE "idempotency_key" IS NULL OR "create_request_hash" IS NULL;

ALTER TABLE "recurring_rules"
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "create_request_hash" SET NOT NULL;

ALTER TABLE "recurring_runs"
  ADD COLUMN "last_attempt_at" TIMESTAMPTZ,
  ADD COLUMN "confirmation_user_id" UUID,
  ADD COLUMN "confirmation_idempotency_key" TEXT,
  ADD COLUMN "confirmation_request_hash" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "recurring_rules"
    WHERE "end_date" IS NOT NULL AND "total_occurrences" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'TASK-012 migration: recurring rule has both end date and total occurrences';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "recurring_rules" rule
    WHERE NOT EXISTS (
      SELECT 1 FROM "ledger_members" member
      WHERE member."ledger_id" = rule."ledger_id"
        AND member."user_id" = rule."owner_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'TASK-012 migration: recurring rule owner membership is missing';
  END IF;
END $$;

UPDATE "recurring_rules"
SET "status" = 'CANCELLED', "next_run_date" = NULL
WHERE "deleted_at" IS NOT NULL;

UPDATE "recurring_rules"
SET "status" = 'COMPLETED', "next_run_date" = NULL
WHERE "deleted_at" IS NULL
  AND (
    ("total_occurrences" IS NOT NULL AND "completed_occurrences" >= "total_occurrences")
    OR ("end_date" IS NOT NULL AND "next_run_date" IS NOT NULL AND "next_run_date" > "end_date")
  );

UPDATE "recurring_rules"
SET "next_run_date" = NULL
WHERE "status" IN ('PAUSED', 'COMPLETED', 'CANCELLED');

UPDATE "recurring_rules"
SET "next_run_date" = "start_date"
WHERE "status" = 'ACTIVE' AND "next_run_date" IS NULL;

UPDATE "recurring_runs" run
SET
  "confirmation_user_id" = rule."owner_user_id",
  "confirmation_idempotency_key" = 'legacy:' || run."id"::text,
  "confirmation_request_hash" = 'legacy:' || run."id"::text,
  "confirmed_at" = COALESCE(run."confirmed_at", run."updated_at")
FROM "recurring_rules" rule
WHERE run."rule_id" = rule."id"
  AND run."status" = 'CONFIRMED'
  AND run."confirmation_user_id" IS NULL;

UPDATE "recurring_runs"
SET
  "last_error" = COALESCE(NULLIF(btrim("last_error"), ''), 'LEGACY_RECURRING_FAILURE'),
  "last_attempt_at" = COALESCE("last_attempt_at", "updated_at"),
  "attempts" = GREATEST("attempts", 1)
WHERE "status" = 'FAILED';

UPDATE "recurring_runs"
SET "last_error" = NULL
WHERE "status" <> 'FAILED';

ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_owner_idempotency_key"
    UNIQUE ("owner_user_id", "idempotency_key"),
  ADD CONSTRAINT "recurring_rules_owner_membership_fkey"
    FOREIGN KEY ("ledger_id", "owner_user_id")
    REFERENCES "ledger_members"("ledger_id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rules_text_valid" CHECK (
    "name" = btrim("name")
    AND char_length("name") BETWEEN 1 AND 100
  ),
  ADD CONSTRAINT "recurring_rules_idempotency_valid" CHECK (
    ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$' OR "idempotency_key" = 'legacy:' || "id"::text)
    AND ("create_request_hash" ~ '^[0-9a-f]{64}$' OR "create_request_hash" = 'legacy:' || "id"::text)
  ),
  ADD CONSTRAINT "recurring_rules_schedule_shape_valid" CHECK (
    "interval_value" BETWEEN 1 AND 1200
    AND "reminder_days_before" BETWEEN 0 AND 365
    AND NOT ("end_date" IS NOT NULL AND "total_occurrences" IS NOT NULL)
  ),
  ADD CONSTRAINT "recurring_rules_status_consistent" CHECK (
    ("deleted_at" IS NOT NULL AND "status" = 'CANCELLED' AND "next_run_date" IS NULL)
    OR (
      "deleted_at" IS NULL
      AND (
        ("status" = 'ACTIVE' AND "next_run_date" IS NOT NULL)
        OR ("status" IN ('PAUSED', 'COMPLETED') AND "next_run_date" IS NULL)
      )
    )
  ),
  ADD CONSTRAINT "recurring_rules_next_run_valid" CHECK (
    "next_run_date" IS NULL
    OR (
      "next_run_date" >= "start_date"
      AND ("end_date" IS NULL OR "next_run_date" <= "end_date")
    )
  );

ALTER TABLE "recurring_runs"
  DROP CONSTRAINT "recurring_runs_entry_consistent";

ALTER TABLE "recurring_runs"
  ADD CONSTRAINT "recurring_runs_confirmation_idempotency_key"
    UNIQUE ("confirmation_user_id", "confirmation_idempotency_key"),
  ADD CONSTRAINT "recurring_runs_confirmation_user_id_fkey"
    FOREIGN KEY ("confirmation_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_runs_error_valid" CHECK (
    "last_error" IS NULL OR char_length("last_error") BETWEEN 1 AND 500
  ),
  ADD CONSTRAINT "recurring_runs_confirmation_valid" CHECK (
    (
      "confirmation_user_id" IS NULL
      AND "confirmation_idempotency_key" IS NULL
      AND "confirmation_request_hash" IS NULL
      AND "confirmed_at" IS NULL
    )
    OR (
      "status" = 'CONFIRMED'
      AND "confirmation_user_id" IS NOT NULL
      AND (
        "confirmation_idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'
        OR "confirmation_idempotency_key" = 'legacy:' || "id"::text
      )
      AND (
        "confirmation_request_hash" ~ '^[0-9a-f]{64}$'
        OR "confirmation_request_hash" = 'legacy:' || "id"::text
      )
      AND "confirmed_at" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "recurring_runs_entry_consistent" CHECK (
    ("status" IN ('GENERATED', 'CONFIRMED') AND "entry_id" IS NOT NULL)
    OR ("status" IN ('PENDING', 'SKIPPED', 'FAILED') AND "entry_id" IS NULL)
  ),
  ADD CONSTRAINT "recurring_runs_failure_consistent" CHECK (
    ("status" = 'FAILED' AND "attempts" > 0 AND "last_error" IS NOT NULL AND "last_attempt_at" IS NOT NULL)
    OR ("status" <> 'FAILED' AND "last_error" IS NULL)
  );

CREATE INDEX "recurring_rules_ledger_active_created_idx"
  ON "recurring_rules" ("ledger_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "recurring_runs_rule_scheduled_created_idx"
  ON "recurring_runs" ("rule_id", "scheduled_date" DESC, "created_at" DESC, "id" DESC);

CREATE OR REPLACE FUNCTION prevent_recurring_rule_identity_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."owner_user_id" IS DISTINCT FROM OLD."owner_user_id"
     OR NEW."ledger_id" IS DISTINCT FROM OLD."ledger_id"
     OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
     OR NEW."create_request_hash" IS DISTINCT FROM OLD."create_request_hash" THEN
    RAISE EXCEPTION 'recurring rule identity and idempotency facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "recurring_runs" run WHERE run."rule_id" = OLD."id")
     AND (
       NEW."entry_type" IS DISTINCT FROM OLD."entry_type"
       OR NEW."category_id" IS DISTINCT FROM OLD."category_id"
       OR NEW."frequency" IS DISTINCT FROM OLD."frequency"
       OR NEW."interval_value" IS DISTINCT FROM OLD."interval_value"
       OR NEW."start_date" IS DISTINCT FROM OLD."start_date"
       OR NEW."generation_mode" IS DISTINCT FROM OLD."generation_mode"
     ) THEN
    RAISE EXCEPTION 'recurring rule schedule is immutable after the first run' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_rules_identity_immutable"
BEFORE UPDATE OF "owner_user_id", "ledger_id", "idempotency_key", "create_request_hash", "entry_type", "category_id", "frequency", "interval_value", "start_date", "generation_mode"
ON "recurring_rules"
FOR EACH ROW EXECUTE FUNCTION prevent_recurring_rule_identity_change();

CREATE OR REPLACE FUNCTION enforce_recurring_rule_active_owner()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ledger_members" member
    JOIN "ledgers" ledger ON ledger."id" = member."ledger_id"
    JOIN "users" actor ON actor."id" = member."user_id"
    WHERE member."ledger_id" = NEW."ledger_id"
      AND member."user_id" = NEW."owner_user_id"
      AND member."status" = 'ACTIVE'
      AND ledger."status" = 'ACTIVE'
      AND ledger."deleted_at" IS NULL
      AND actor."status" = 'ACTIVE'
      AND actor."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'RECURRING_RULE_OWNER_NOT_ACTIVE_MEMBER' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_rules_active_owner"
BEFORE INSERT OR UPDATE OF "ledger_id", "owner_user_id" ON "recurring_rules"
FOR EACH ROW EXECUTE FUNCTION enforce_recurring_rule_active_owner();

CREATE OR REPLACE FUNCTION prevent_recurring_run_terminal_change()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('GENERATED', 'CONFIRMED', 'SKIPPED')
     AND ROW(NEW."rule_id", NEW."scheduled_date", NEW."amount_cent", NEW."status", NEW."entry_id",
             NEW."attempts", NEW."last_error", NEW."last_attempt_at", NEW."confirmed_at",
             NEW."confirmation_user_id", NEW."confirmation_idempotency_key", NEW."confirmation_request_hash")
         IS DISTINCT FROM
         ROW(OLD."rule_id", OLD."scheduled_date", OLD."amount_cent", OLD."status", OLD."entry_id",
             OLD."attempts", OLD."last_error", OLD."last_attempt_at", OLD."confirmed_at",
             OLD."confirmation_user_id", OLD."confirmation_idempotency_key", OLD."confirmation_request_hash") THEN
    RAISE EXCEPTION 'terminal recurring run facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."rule_id" IS DISTINCT FROM OLD."rule_id"
     OR NEW."scheduled_date" IS DISTINCT FROM OLD."scheduled_date" THEN
    RAISE EXCEPTION 'recurring run identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_runs_terminal_immutable"
BEFORE UPDATE ON "recurring_runs"
FOR EACH ROW EXECUTE FUNCTION prevent_recurring_run_terminal_change();

CREATE OR REPLACE FUNCTION validate_recurring_run_entry_reference()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."status" IN ('GENERATED', 'CONFIRMED') THEN
    SELECT TRUE INTO valid_reference
    FROM "entries" entry
    JOIN "recurring_rules" rule ON rule."id" = NEW."rule_id"
    WHERE entry."id" = NEW."entry_id"
      AND entry."source_type" = 'RECURRING_RUN'
      AND entry."source_id" = NEW."id"
      AND entry."ledger_id" = rule."ledger_id"
      AND entry."creator_user_id" = rule."owner_user_id"
      AND entry."type" = rule."entry_type"
      AND entry."category_id" = rule."category_id"
      AND entry."amount_cent" = NEW."amount_cent"
      AND entry."business_date" = NEW."scheduled_date"
      AND entry."deleted_at" IS NULL;
    IF valid_reference IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'invalid recurring run entry reference' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."entry_id" IS NOT NULL THEN
    RAISE EXCEPTION 'non-generated recurring run cannot reference entry' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "recurring_runs_entry_reference_valid"
AFTER INSERT OR UPDATE OF "rule_id", "scheduled_date", "amount_cent", "status", "entry_id"
ON "recurring_runs"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_recurring_run_entry_reference();

CREATE OR REPLACE FUNCTION prevent_recurring_source_entry_change()
RETURNS trigger AS $$
BEGIN
  IF OLD."source_type" = 'RECURRING_RUN'
     AND ROW(NEW."ledger_id", NEW."creator_user_id", NEW."type", NEW."amount_cent", NEW."category_id",
             NEW."business_date", NEW."payment_method", NEW."note", NEW."source_type", NEW."source_id",
             NEW."deleted_at")
         IS DISTINCT FROM
         ROW(OLD."ledger_id", OLD."creator_user_id", OLD."type", OLD."amount_cent", OLD."category_id",
             OLD."business_date", OLD."payment_method", OLD."note", OLD."source_type", OLD."source_id",
             OLD."deleted_at") THEN
    RAISE EXCEPTION 'recurring source entry facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entries_recurring_source_immutable"
BEFORE UPDATE ON "entries"
FOR EACH ROW EXECUTE FUNCTION prevent_recurring_source_entry_change();

CREATE OR REPLACE FUNCTION validate_recurring_source_entry()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."source_type" = 'RECURRING_RUN' THEN
    IF NEW."deleted_at" IS NOT NULL THEN
      RAISE EXCEPTION 'recurring source entry cannot be soft deleted' USING ERRCODE = '23514';
    END IF;
    SELECT TRUE INTO valid_reference
    FROM "recurring_runs" run
    JOIN "recurring_rules" rule ON rule."id" = run."rule_id"
    WHERE run."id" = NEW."source_id"
      AND run."entry_id" = NEW."id"
      AND run."status" IN ('GENERATED', 'CONFIRMED')
      AND run."amount_cent" = NEW."amount_cent"
      AND run."scheduled_date" = NEW."business_date"
      AND rule."ledger_id" = NEW."ledger_id"
      AND rule."owner_user_id" = NEW."creator_user_id"
      AND rule."entry_type" = NEW."type"
      AND rule."category_id" = NEW."category_id";
    IF valid_reference IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'invalid recurring source entry' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "entries_recurring_source_valid"
AFTER INSERT OR UPDATE OF "source_type", "source_id", "ledger_id", "creator_user_id", "type", "category_id", "amount_cent", "business_date", "deleted_at"
ON "entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_recurring_source_entry();
