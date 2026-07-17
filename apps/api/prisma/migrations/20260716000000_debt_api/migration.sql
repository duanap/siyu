-- TASK-010 / BR-DEBT-001..010: private debt API, immutable idempotency facts,
-- and deferred source-entry consistency.

ALTER TABLE "debts"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "create_request_hash" TEXT;

UPDATE "debts"
SET
  "idempotency_key" = 'legacy:' || "id"::text,
  "create_request_hash" = 'legacy:' || "id"::text
WHERE "idempotency_key" IS NULL OR "create_request_hash" IS NULL;

ALTER TABLE "debts"
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "create_request_hash" SET NOT NULL;

ALTER TABLE "debt_transactions"
  ADD COLUMN "request_hash" TEXT;

UPDATE "debt_transactions"
SET "request_hash" = 'legacy:' || "id"::text
WHERE "request_hash" IS NULL;

ALTER TABLE "debt_transactions"
  ALTER COLUMN "request_hash" SET NOT NULL;

-- Status is derived from the existing amount/date/deletion facts. This is a
-- deterministic forward repair and does not rewrite any financial amount.
UPDATE "debts"
SET "status" = CASE
  WHEN "deleted_at" IS NOT NULL THEN 'CANCELLED'::"DebtStatus"
  WHEN "remaining_cent" = 0 THEN 'SETTLED'::"DebtStatus"
  WHEN "due_date" IS NOT NULL AND "due_date" < CURRENT_DATE THEN 'OVERDUE'::"DebtStatus"
  ELSE 'ACTIVE'::"DebtStatus"
END;

ALTER TABLE "debts"
  ADD CONSTRAINT "debts_user_id_idempotency_key_key" UNIQUE ("user_id", "idempotency_key"),
  ADD CONSTRAINT "debts_text_valid" CHECK (
    "counterparty_name" = btrim("counterparty_name")
    AND char_length("counterparty_name") BETWEEN 1 AND 100
    AND ("note" IS NULL OR ("note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500))
  ),
  ADD CONSTRAINT "debts_idempotency_valid" CHECK (
    ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$' OR "idempotency_key" = 'legacy:' || "id"::text)
    AND ("create_request_hash" ~ '^[0-9a-f]{64}$' OR "create_request_hash" = 'legacy:' || "id"::text)
  ),
  ADD CONSTRAINT "debts_status_consistent" CHECK (
    ("deleted_at" IS NOT NULL AND "status" = 'CANCELLED')
    OR ("deleted_at" IS NULL AND "remaining_cent" = 0 AND "status" = 'SETTLED')
    OR ("deleted_at" IS NULL AND "remaining_cent" > 0 AND "status" IN ('ACTIVE', 'OVERDUE'))
  );

ALTER TABLE "debt_transactions"
  ADD CONSTRAINT "debt_transactions_text_valid" CHECK (
    "idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'
    AND ("request_hash" ~ '^[0-9a-f]{64}$' OR "request_hash" = 'legacy:' || "id"::text)
    AND ("note" IS NULL OR ("note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500))
  );

CREATE INDEX "debts_user_active_created_idx"
  ON "debts" ("user_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;

CREATE OR REPLACE FUNCTION prevent_debt_idempotency_fact_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
     OR NEW."create_request_hash" IS DISTINCT FROM OLD."create_request_hash" THEN
    RAISE EXCEPTION 'debt idempotency facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "debts_idempotency_facts_immutable"
BEFORE UPDATE OF "idempotency_key", "create_request_hash" ON "debts"
FOR EACH ROW EXECUTE FUNCTION prevent_debt_idempotency_fact_change();

CREATE OR REPLACE FUNCTION prevent_debt_core_fact_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."user_id" IS DISTINCT FROM OLD."user_id"
     OR NEW."direction" IS DISTINCT FROM OLD."direction"
     OR NEW."principal_cent" IS DISTINCT FROM OLD."principal_cent"
     OR NEW."start_date" IS DISTINCT FROM OLD."start_date" THEN
    RAISE EXCEPTION 'debt owner, direction, principal and start date are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "debts_core_facts_immutable"
BEFORE UPDATE OF "user_id", "direction", "principal_cent", "start_date" ON "debts"
FOR EACH ROW EXECUTE FUNCTION prevent_debt_core_fact_change();

CREATE OR REPLACE FUNCTION prevent_debt_transaction_request_hash_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."request_hash" IS DISTINCT FROM OLD."request_hash" THEN
    RAISE EXCEPTION 'debt transaction request hash is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "debt_transactions_request_hash_immutable"
BEFORE UPDATE OF "request_hash" ON "debt_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_debt_transaction_request_hash_change();

CREATE OR REPLACE FUNCTION prevent_debt_transaction_fact_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."debt_id" IS DISTINCT FROM OLD."debt_id"
     OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
     OR NEW."amount_cent" IS DISTINCT FROM OLD."amount_cent"
     OR NEW."business_date" IS DISTINCT FROM OLD."business_date"
     OR NEW."sync_entry" IS DISTINCT FROM OLD."sync_entry"
     OR NEW."entry_id" IS DISTINCT FROM OLD."entry_id"
     OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
     OR NEW."note" IS DISTINCT FROM OLD."note" THEN
    RAISE EXCEPTION 'debt transaction facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "debt_transactions_facts_immutable"
BEFORE UPDATE OF "debt_id", "user_id", "amount_cent", "business_date", "sync_entry", "entry_id", "idempotency_key", "note"
ON "debt_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_debt_transaction_fact_change();

CREATE OR REPLACE FUNCTION validate_debt_transaction_entry_reference()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."sync_entry" THEN
    IF NEW."deleted_at" IS NOT NULL THEN
      RAISE EXCEPTION 'synced debt transaction cannot be soft deleted' USING ERRCODE = '23514';
    END IF;
    SELECT TRUE INTO valid_reference
    FROM "entries" e
    JOIN "debts" d ON d."id" = NEW."debt_id" AND d."user_id" = NEW."user_id"
    JOIN "ledgers" l ON l."id" = e."ledger_id"
    WHERE e."id" = NEW."entry_id"
      AND e."source_type" = 'DEBT_TRANSACTION'
      AND e."source_id" = NEW."id"
      AND e."creator_user_id" = NEW."user_id"
      AND e."amount_cent" = NEW."amount_cent"
      AND e."business_date" = NEW."business_date"
      AND e."deleted_at" IS NULL
      AND l."type" = 'PERSONAL'
      AND l."owner_user_id" = NEW."user_id"
      AND l."status" = 'ACTIVE'
      AND l."deleted_at" IS NULL
      AND e."type" = CASE d."direction" WHEN 'BORROWED' THEN 'EXPENSE'::"EntryType" ELSE 'INCOME'::"EntryType" END;
    IF valid_reference IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'invalid debt transaction entry reference' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."entry_id" IS NOT NULL THEN
    RAISE EXCEPTION 'unsynced debt transaction cannot reference entry' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "debt_transactions_entry_reference_valid"
AFTER INSERT OR UPDATE OF "debt_id", "user_id", "amount_cent", "business_date", "sync_entry", "entry_id", "deleted_at"
ON "debt_transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_debt_transaction_entry_reference();

CREATE OR REPLACE FUNCTION validate_debt_source_entry()
RETURNS trigger AS $$
DECLARE
  valid_reference boolean;
BEGIN
  IF NEW."source_type" = 'DEBT_TRANSACTION' THEN
    SELECT TRUE INTO valid_reference
    FROM "debt_transactions" t
    JOIN "debts" d ON d."id" = t."debt_id" AND d."user_id" = t."user_id"
    JOIN "ledgers" l ON l."id" = NEW."ledger_id"
    WHERE t."id" = NEW."source_id"
      AND t."entry_id" = NEW."id"
      AND t."sync_entry" = TRUE
      AND t."deleted_at" IS NULL
      AND t."user_id" = NEW."creator_user_id"
      AND t."amount_cent" = NEW."amount_cent"
      AND t."business_date" = NEW."business_date"
      AND l."type" = 'PERSONAL'
      AND l."owner_user_id" = NEW."creator_user_id"
      AND l."status" = 'ACTIVE'
      AND l."deleted_at" IS NULL
      AND NEW."type" = CASE d."direction" WHEN 'BORROWED' THEN 'EXPENSE'::"EntryType" ELSE 'INCOME'::"EntryType" END;
    IF valid_reference IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'invalid debt source entry' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "entries_debt_source_valid"
AFTER INSERT OR UPDATE OF "ledger_id", "creator_user_id", "type", "amount_cent", "business_date", "source_type", "source_id", "deleted_at"
ON "entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_debt_source_entry();
