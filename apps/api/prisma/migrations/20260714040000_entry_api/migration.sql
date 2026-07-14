-- TASK-007 / BR-ENTRY-001..: ordinary entry API invariants, optimistic locking and replay safety.
CREATE TYPE "EntryPaymentMethod" AS ENUM ('CASH', 'WECHAT', 'ALIPAY', 'BANK_CARD', 'OTHER');

ALTER TABLE "entries"
  ADD COLUMN "create_request_hash" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Normalize values that already have an unambiguous approved representation. Unknown payment
-- methods are rejected below instead of being silently reclassified.
UPDATE "entries"
SET "note" = NULLIF(btrim("note"), '')
WHERE "note" IS NOT NULL;

UPDATE "entries"
SET "payment_method" = upper(btrim("payment_method"))
WHERE "payment_method" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "entries"
    WHERE "payment_method" IS NOT NULL
      AND "payment_method" NOT IN ('CASH', 'WECHAT', 'ALIPAY', 'BANK_CARD', 'OTHER')
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: entries contain an unknown payment_method';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "entries"
    WHERE char_length(btrim("idempotency_key")) NOT BETWEEN 8 AND 128
       OR btrim("idempotency_key") !~ '^[A-Za-z0-9._:-]+$'
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: entries contain an invalid idempotency_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "entries"
    GROUP BY "creator_user_id", btrim("idempotency_key")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: trimming idempotency_key would create a duplicate';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "entries"
    WHERE "note" IS NOT NULL AND char_length("note") > 500
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: entries contain a note longer than 500 characters';
  END IF;
END $$;

UPDATE "entries" SET "idempotency_key" = btrim("idempotency_key");
UPDATE "entries" SET "create_request_hash" = 'legacy:' || "id"::text;

ALTER TABLE "entries"
  ALTER COLUMN "payment_method" TYPE "EntryPaymentMethod"
    USING "payment_method"::"EntryPaymentMethod",
  ALTER COLUMN "create_request_hash" SET NOT NULL;

-- Repair only a provably valid missing OWNER membership. Anything else is historical corruption
-- and must stop the migration rather than granting a synthetic LEFT membership.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "entries" entry
    JOIN "ledgers" ledger ON ledger."id" = entry."ledger_id"
    JOIN "users" actor ON actor."id" = entry."creator_user_id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "ledger_members" member
      WHERE member."ledger_id" = entry."ledger_id"
        AND member."user_id" = entry."creator_user_id"
    )
      AND NOT (
        entry."creator_user_id" = ledger."owner_user_id"
        AND ledger."status" = 'ACTIVE'
        AND ledger."deleted_at" IS NULL
        AND actor."status" = 'ACTIVE'
        AND actor."deleted_at" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ledger_members" owner_member
          WHERE owner_member."ledger_id" = ledger."id"
            AND owner_member."status" = 'ACTIVE'
            AND owner_member."role" = 'OWNER'
        )
      )
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: an Entry creator has no valid ledger membership and is not a repairable OWNER';
  END IF;
END $$;

INSERT INTO "ledger_members" ("id", "ledger_id", "user_id", "role", "status")
SELECT DISTINCT
  overlay(
    overlay(md5('task-007-owner:' || entry."ledger_id"::text || ':' || entry."creator_user_id"::text)
      placing '4' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  entry."ledger_id",
  entry."creator_user_id",
  'OWNER'::"MemberRole",
  'ACTIVE'::"MemberStatus"
FROM "entries" entry
JOIN "ledgers" ledger ON ledger."id" = entry."ledger_id"
JOIN "users" actor ON actor."id" = entry."creator_user_id"
WHERE entry."creator_user_id" = ledger."owner_user_id"
  AND ledger."status" = 'ACTIVE'
  AND ledger."deleted_at" IS NULL
  AND actor."status" = 'ACTIVE'
  AND actor."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ledger_members" member
    WHERE member."ledger_id" = entry."ledger_id"
      AND member."user_id" = entry."creator_user_id"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "entries" entry
    WHERE NOT EXISTS (
      SELECT 1 FROM "ledger_members" member
      WHERE member."ledger_id" = entry."ledger_id"
        AND member."user_id" = entry."creator_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration: Entry creator membership repair was incomplete';
  END IF;
END $$;

ALTER TABLE "entries"
  ADD CONSTRAINT "entries_creator_membership_fkey"
    FOREIGN KEY ("ledger_id", "creator_user_id")
    REFERENCES "ledger_members"("ledger_id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "entries_version_valid" CHECK ("version" >= 1),
  ADD CONSTRAINT "entries_note_valid" CHECK (
    "note" IS NULL OR ("note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500)
  ),
  ADD CONSTRAINT "entries_idempotency_key_valid" CHECK (
    "idempotency_key" = btrim("idempotency_key")
    AND char_length("idempotency_key") BETWEEN 8 AND 128
    AND "idempotency_key" ~ '^[A-Za-z0-9._:-]+$'
  ),
  ADD CONSTRAINT "entries_create_request_hash_valid" CHECK (
    "create_request_hash" ~ '^[0-9a-f]{64}$'
    OR "create_request_hash" ~ '^legacy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  ADD CONSTRAINT "entries_id_uuid_v4" CHECK (
    substring("id"::text from 15 for 1) = '4'
    AND substring("id"::text from 20 for 1) IN ('8', '9', 'a', 'b')
  );

CREATE OR REPLACE FUNCTION "enforce_entry_create_request_hash_immutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."create_request_hash" IS DISTINCT FROM OLD."create_request_hash" THEN
    RAISE EXCEPTION 'ENTRY_CREATE_REQUEST_HASH_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "entries_create_request_hash_immutable"
BEFORE UPDATE OF "create_request_hash" ON "entries"
FOR EACH ROW EXECUTE FUNCTION "enforce_entry_create_request_hash_immutable"();

CREATE OR REPLACE FUNCTION "enforce_entry_active_creator"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ledger_members" member
    JOIN "ledgers" ledger ON ledger."id" = member."ledger_id"
    JOIN "users" actor ON actor."id" = member."user_id"
    WHERE member."ledger_id" = NEW."ledger_id"
      AND member."user_id" = NEW."creator_user_id"
      AND member."status" = 'ACTIVE'
      AND ledger."status" = 'ACTIVE'
      AND ledger."deleted_at" IS NULL
      AND actor."status" = 'ACTIVE'
      AND actor."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'ENTRY_CREATOR_NOT_ACTIVE_MEMBER' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "entries_active_creator"
BEFORE INSERT OR UPDATE OF "ledger_id", "creator_user_id" ON "entries"
FOR EACH ROW EXECUTE FUNCTION "enforce_entry_active_creator"();

DROP INDEX "entries_ledger_id_business_date_idx";
DROP INDEX "entries_ledger_id_type_business_date_idx";
DROP INDEX "entries_ledger_id_category_id_business_date_idx";
DROP INDEX "entries_ledger_id_creator_user_id_business_date_idx";

CREATE INDEX "entries_ledger_id_business_date_idx"
ON "entries"("ledger_id", "business_date" DESC, "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "entries_ledger_id_type_business_date_idx"
ON "entries"("ledger_id", "type", "business_date" DESC, "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "entries_ledger_id_category_id_business_date_idx"
ON "entries"("ledger_id", "category_id", "business_date" DESC, "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "entries_ledger_id_creator_user_id_business_date_idx"
ON "entries"("ledger_id", "creator_user_id", "business_date" DESC, "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;
