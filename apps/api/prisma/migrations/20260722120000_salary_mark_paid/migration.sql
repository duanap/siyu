-- TASK-016: atomic salary payment confirmation and optional private income linkage.

ALTER TABLE "salary_records"
  ADD COLUMN "payment_idempotency_key" TEXT,
  ADD COLUMN "payment_request_hash" TEXT;

-- Existing paid rows predate the public confirmation contract. Preserve them with
-- deterministic internal facts so the stronger state constraint can be enabled.
UPDATE "salary_records"
SET "payment_idempotency_key" = 'legacy-paid:' || "id"::text,
    "payment_request_hash" = repeat('0', 64)
WHERE "payment_status" = 'PAID';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "salary_records" record
    JOIN "entries" entry ON entry."id" = record."entry_id"
    JOIN "ledgers" ledger ON ledger."id" = entry."ledger_id"
    JOIN "categories" category ON category."id" = entry."category_id"
    WHERE record."payment_status" <> 'PAID'
       OR entry."source_type" <> 'SALARY'
       OR entry."source_id" IS DISTINCT FROM record."id"
       OR entry."creator_user_id" <> record."user_id"
       OR entry."type" <> 'INCOME'
       OR entry."amount_cent" <> record."net_cent"
       OR entry."business_date" <> record."paid_date"
       OR entry."payment_method" IS NOT NULL
       OR entry."deleted_at" IS NOT NULL
       OR ledger."type" <> 'PERSONAL'
       OR ledger."owner_user_id" <> record."user_id"
       OR ledger."deleted_at" IS NOT NULL
       OR category."ledger_id" <> ledger."id"
       OR category."type" <> 'INCOME'
       OR category."template_key" <> 'income.salary'
  ) THEN
    RAISE EXCEPTION 'TASK-016 migration refused inconsistent salary source entry';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "entries" entry
    LEFT JOIN "salary_records" record
      ON record."id" = entry."source_id" AND record."entry_id" = entry."id"
    WHERE entry."source_type" = 'SALARY'
      AND (record."id" IS NULL OR record."payment_status" <> 'PAID')
  ) THEN
    RAISE EXCEPTION 'TASK-016 migration refused orphan salary source entry';
  END IF;
END $$;

ALTER TABLE "salary_records"
  DROP CONSTRAINT "salary_records_payment_consistent",
  ADD CONSTRAINT "salary_records_payment_consistent" CHECK (
    ("payment_status" = 'UNPAID'
      AND "paid_date" IS NULL
      AND "entry_id" IS NULL
      AND "payment_idempotency_key" IS NULL
      AND "payment_request_hash" IS NULL)
    OR
    ("payment_status" = 'PAID'
      AND "paid_date" IS NOT NULL
      AND "payment_idempotency_key" IS NOT NULL
      AND "payment_request_hash" IS NOT NULL)
  ),
  ADD CONSTRAINT "salary_records_payment_idempotency_valid" CHECK (
    "payment_idempotency_key" IS NULL
    OR (
      char_length("payment_idempotency_key") BETWEEN 8 AND 128
      AND "payment_idempotency_key" ~ '^[A-Za-z0-9._:-]+$'
      AND "payment_request_hash" ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX "salary_records_user_payment_idempotency_key"
  ON "salary_records"("user_id", "payment_idempotency_key");

ALTER TABLE "salary_records"
  DROP CONSTRAINT "salary_records_entry_id_fkey",
  ADD CONSTRAINT "salary_records_entry_id_fkey"
    FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION protect_salary_immutable_facts() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'salary_profiles' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.idempotency_key <> OLD.idempotency_key
       OR NEW.create_request_hash <> OLD.create_request_hash THEN
      RAISE EXCEPTION 'salary profile creation facts are immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.user_id <> OLD.user_id OR NEW.profile_id <> OLD.profile_id
       OR NEW.salary_month <> OLD.salary_month OR NEW.idempotency_key <> OLD.idempotency_key
       OR NEW.create_request_hash <> OLD.create_request_hash THEN
      RAISE EXCEPTION 'salary record creation facts are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.payment_status = 'PAID' AND (
      ROW(NEW.gross_cent, NEW.deduction_cent, NEW.net_cent, NEW.salary_month,
          NEW.payment_status, NEW.paid_date, NEW.entry_id,
          NEW.payment_idempotency_key, NEW.payment_request_hash, NEW.deleted_at)
      IS DISTINCT FROM
      ROW(OLD.gross_cent, OLD.deduction_cent, OLD.net_cent, OLD.salary_month,
          OLD.payment_status, OLD.paid_date, OLD.entry_id,
          OLD.payment_idempotency_key, OLD.payment_request_hash, OLD.deleted_at)
    ) THEN
      RAISE EXCEPTION 'paid salary record is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_salary_record_entry_reference()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."entry_id" IS NOT NULL THEN
    SELECT TRUE INTO valid_reference
    FROM "entries" entry
    JOIN "ledgers" ledger ON ledger."id" = entry."ledger_id"
    JOIN "categories" category ON category."id" = entry."category_id"
    WHERE entry."id" = NEW."entry_id"
      AND NEW."payment_status" = 'PAID'
      AND entry."source_type" = 'SALARY'
      AND entry."source_id" = NEW."id"
      AND entry."creator_user_id" = NEW."user_id"
      AND entry."type" = 'INCOME'
      AND entry."amount_cent" = NEW."net_cent"
      AND entry."business_date" = NEW."paid_date"
      AND entry."payment_method" IS NULL
      AND entry."deleted_at" IS NULL
      AND ledger."type" = 'PERSONAL'
      AND ledger."owner_user_id" = NEW."user_id"
      AND ledger."deleted_at" IS NULL
      AND category."ledger_id" = ledger."id"
      AND category."type" = 'INCOME'
      AND category."template_key" = 'income.salary';
    IF valid_reference IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'invalid salary record entry reference' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "salary_records_entry_reference_valid"
AFTER INSERT OR UPDATE OF "user_id", "net_cent", "payment_status", "paid_date", "entry_id"
ON "salary_records"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_salary_record_entry_reference();

CREATE OR REPLACE FUNCTION validate_salary_source_entry()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."source_type" = 'SALARY' THEN
    IF NEW."deleted_at" IS NOT NULL THEN
      RAISE EXCEPTION 'salary source entry cannot be soft deleted' USING ERRCODE = '23514';
    END IF;
    SELECT TRUE INTO valid_reference
    FROM "salary_records" record
    JOIN "ledgers" ledger ON ledger."id" = NEW."ledger_id"
    JOIN "categories" category ON category."id" = NEW."category_id"
    WHERE record."id" = NEW."source_id"
      AND record."entry_id" = NEW."id"
      AND record."payment_status" = 'PAID'
      AND record."user_id" = NEW."creator_user_id"
      AND record."net_cent" = NEW."amount_cent"
      AND record."paid_date" = NEW."business_date"
      AND NEW."type" = 'INCOME'
      AND NEW."payment_method" IS NULL
      AND ledger."type" = 'PERSONAL'
      AND ledger."owner_user_id" = NEW."creator_user_id"
      AND ledger."deleted_at" IS NULL
      AND category."ledger_id" = ledger."id"
      AND category."type" = 'INCOME'
      AND category."template_key" = 'income.salary';
    IF valid_reference IS DISTINCT FROM TRUE THEN
      IF NOT EXISTS (SELECT 1 FROM "salary_records" WHERE "id" = NEW."source_id") THEN
        RAISE EXCEPTION 'invalid salary source entry: record missing' USING ERRCODE = '23514';
      ELSIF NOT EXISTS (
        SELECT 1 FROM "salary_records"
        WHERE "id" = NEW."source_id" AND "entry_id" = NEW."id"
      ) THEN
        RAISE EXCEPTION 'invalid salary source entry: back reference mismatch' USING ERRCODE = '23514';
      ELSIF NOT EXISTS (
        SELECT 1 FROM "salary_records"
        WHERE "id" = NEW."source_id" AND "payment_status" = 'PAID'
          AND "user_id" = NEW."creator_user_id" AND "net_cent" = NEW."amount_cent"
          AND "paid_date" = NEW."business_date"
      ) THEN
        RAISE EXCEPTION 'invalid salary source entry: payment facts mismatch' USING ERRCODE = '23514';
      ELSIF NOT EXISTS (
        SELECT 1 FROM "ledgers"
        WHERE "id" = NEW."ledger_id" AND "type" = 'PERSONAL'
          AND "owner_user_id" = NEW."creator_user_id" AND "deleted_at" IS NULL
      ) THEN
        RAISE EXCEPTION 'invalid salary source entry: ledger scope mismatch' USING ERRCODE = '23514';
      ELSE
        RAISE EXCEPTION 'invalid salary source entry: entry or category facts mismatch' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "entries_salary_source_valid"
AFTER INSERT OR UPDATE OF "ledger_id", "creator_user_id", "type", "amount_cent", "category_id",
  "business_date", "payment_method", "source_type", "source_id", "deleted_at"
ON "entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_salary_source_entry();

CREATE OR REPLACE FUNCTION prevent_salary_source_entry_change()
RETURNS trigger AS $$
BEGIN
  IF OLD."source_type" = 'SALARY'
     AND ROW(NEW."ledger_id", NEW."creator_user_id", NEW."type", NEW."amount_cent", NEW."category_id",
             NEW."business_date", NEW."payment_method", NEW."note", NEW."source_type", NEW."source_id",
             NEW."deleted_at")
         IS DISTINCT FROM
         ROW(OLD."ledger_id", OLD."creator_user_id", OLD."type", OLD."amount_cent", OLD."category_id",
             OLD."business_date", OLD."payment_method", OLD."note", OLD."source_type", OLD."source_id",
             OLD."deleted_at") THEN
    RAISE EXCEPTION 'salary source entry facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entries_salary_source_immutable"
BEFORE UPDATE ON "entries"
FOR EACH ROW EXECUTE FUNCTION prevent_salary_source_entry_change();

CREATE OR REPLACE FUNCTION prevent_salary_source_category_scope_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "entries"
    WHERE "category_id" = OLD."id" AND "source_type" = 'SALARY'
  ) AND ROW(NEW."ledger_id", NEW."type", NEW."template_key") IS DISTINCT FROM
        ROW(OLD."ledger_id", OLD."type", OLD."template_key") THEN
    RAISE EXCEPTION 'salary source category scope is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "categories_salary_source_scope_immutable"
BEFORE UPDATE OF "ledger_id", "type", "template_key" ON "categories"
FOR EACH ROW EXECUTE FUNCTION prevent_salary_source_category_scope_change();

CREATE OR REPLACE FUNCTION prevent_salary_source_ledger_scope_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "entries"
    WHERE "ledger_id" = OLD."id" AND "source_type" = 'SALARY'
  ) AND ROW(NEW."type", NEW."owner_user_id", NEW."deleted_at") IS DISTINCT FROM
        ROW(OLD."type", OLD."owner_user_id", OLD."deleted_at") THEN
    RAISE EXCEPTION 'salary source ledger scope is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledgers_salary_source_scope_immutable"
BEFORE UPDATE OF "type", "owner_user_id", "deleted_at" ON "ledgers"
FOR EACH ROW EXECUTE FUNCTION prevent_salary_source_ledger_scope_change();
