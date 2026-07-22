-- TASK-019: harden saving goals and contributions for scoped idempotency,
-- membership ownership, transactional aggregation, and reversible completion.

ALTER TABLE "saving_goals"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "create_request_hash" TEXT;

ALTER TABLE "saving_contributions"
  ADD COLUMN "create_request_hash" TEXT;

UPDATE "saving_goals"
SET
  "idempotency_key" = 'legacy:' || "id"::text,
  "create_request_hash" = 'legacy:' || "id"::text
WHERE "idempotency_key" IS NULL OR "create_request_hash" IS NULL;

UPDATE "saving_contributions"
SET "create_request_hash" = 'legacy:' || "id"::text
WHERE "create_request_hash" IS NULL;

ALTER TABLE "saving_goals"
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "create_request_hash" SET NOT NULL;

ALTER TABLE "saving_contributions"
  ALTER COLUMN "create_request_hash" SET NOT NULL;

-- Preserve valid owner-created historical goals even if an older snapshot missed
-- the corresponding membership row. Non-owner anomalies fail closed below.
INSERT INTO "ledger_members" (
  "id", "ledger_id", "user_id", "role", "status", "joined_at"
)
SELECT
  gen_random_uuid(), goal."ledger_id", goal."creator_user_id",
  'OWNER'::"MemberRole", 'ACTIVE'::"MemberStatus", CURRENT_TIMESTAMP
FROM "saving_goals" goal
JOIN "ledgers" ledger ON ledger."id" = goal."ledger_id"
JOIN "users" actor ON actor."id" = goal."creator_user_id"
WHERE goal."creator_user_id" = ledger."owner_user_id"
  AND ledger."status" = 'ACTIVE'
  AND ledger."deleted_at" IS NULL
  AND actor."status" = 'ACTIVE'
  AND actor."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ledger_members" member
    WHERE member."ledger_id" = goal."ledger_id"
      AND member."user_id" = goal."creator_user_id"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "saving_goals" goal
    WHERE NOT EXISTS (
      SELECT 1 FROM "ledger_members" member
      WHERE member."ledger_id" = goal."ledger_id"
        AND member."user_id" = goal."creator_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'TASK-019 migration: saving goal creator membership is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "saving_contributions" contribution
    JOIN "saving_goals" goal ON goal."id" = contribution."goal_id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "ledger_members" member
      WHERE member."ledger_id" = goal."ledger_id"
        AND member."user_id" = contribution."user_id"
    )
  ) THEN
    RAISE EXCEPTION 'TASK-019 migration: saving contribution membership is invalid';
  END IF;
END $$;

-- Normalize legacy summaries and completion status before installing strict checks.
UPDATE "saving_goals" goal
SET "saved_cent" = goal."initial_cent" + COALESCE((
  SELECT SUM(contribution."amount_cent")
  FROM "saving_contributions" contribution
  WHERE contribution."goal_id" = goal."id"
    AND contribution."deleted_at" IS NULL
), 0);

UPDATE "saving_goals"
SET "status" = CASE
  WHEN "deleted_at" IS NOT NULL THEN 'CANCELLED'::"SavingGoalStatus"
  WHEN "saved_cent" >= "target_cent" THEN 'COMPLETED'::"SavingGoalStatus"
  ELSE 'ACTIVE'::"SavingGoalStatus"
END;

ALTER TABLE "saving_goals"
  DROP CONSTRAINT "saving_goals_amounts_valid",
  ADD CONSTRAINT "saving_goals_creator_user_id_idempotency_key_key"
    UNIQUE ("creator_user_id", "idempotency_key"),
  ADD CONSTRAINT "saving_goals_creator_membership_fkey"
    FOREIGN KEY ("ledger_id", "creator_user_id")
    REFERENCES "ledger_members"("ledger_id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "saving_goals_amounts_valid" CHECK (
    "target_cent" BETWEEN 1 AND 9007199254740991
    AND "initial_cent" BETWEEN 0 AND 9007199254740991
    AND "saved_cent" BETWEEN "initial_cent" AND 9007199254740991
  ),
  ADD CONSTRAINT "saving_goals_text_valid" CHECK (
    "name" = btrim("name")
    AND char_length("name") BETWEEN 1 AND 100
    AND ("note" IS NULL OR (
      "note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500
    ))
    AND ("cover_url" IS NULL OR (
      "cover_url" = btrim("cover_url")
      AND char_length("cover_url") BETWEEN 1 AND 2048
      AND "cover_url" ~ '^https?://'
    ))
  ),
  ADD CONSTRAINT "saving_goals_idempotency_valid" CHECK (
    ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$' OR "idempotency_key" = 'legacy:' || "id"::text)
    AND ("create_request_hash" ~ '^[0-9a-f]{64}$' OR "create_request_hash" = 'legacy:' || "id"::text)
  ),
  ADD CONSTRAINT "saving_goals_status_consistent" CHECK (
    ("deleted_at" IS NOT NULL AND "status" = 'CANCELLED')
    OR (
      "deleted_at" IS NULL
      AND (
        ("saved_cent" >= "target_cent" AND "status" = 'COMPLETED')
        OR ("saved_cent" < "target_cent" AND "status" = 'ACTIVE')
      )
    )
  );

ALTER TABLE "saving_contributions"
  ADD CONSTRAINT "saving_contributions_text_valid" CHECK (
    "note" IS NULL OR (
      "note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500
    )
  ),
  ADD CONSTRAINT "saving_contributions_idempotency_valid" CHECK (
    "idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  ADD CONSTRAINT "saving_contributions_request_hash_valid" CHECK (
    "create_request_hash" ~ '^[0-9a-f]{64}$'
    OR "create_request_hash" = 'legacy:' || "id"::text
  );

CREATE INDEX "saving_goals_active_ledger_created_idx"
ON "saving_goals"("ledger_id", "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "saving_contributions_active_goal_date_idx"
ON "saving_contributions"("goal_id", "business_date" DESC, "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE OR REPLACE FUNCTION "enforce_saving_goal_active_creator"()
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
    RAISE EXCEPTION 'SAVING_GOAL_CREATOR_NOT_ACTIVE_MEMBER' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "saving_goals_active_creator"
BEFORE INSERT OR UPDATE OF "ledger_id", "creator_user_id" ON "saving_goals"
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_goal_active_creator"();

CREATE OR REPLACE FUNCTION "enforce_saving_contribution_active_member"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "saving_goals" goal
    JOIN "ledgers" ledger ON ledger."id" = goal."ledger_id"
    JOIN "ledger_members" member
      ON member."ledger_id" = goal."ledger_id" AND member."user_id" = NEW."user_id"
    JOIN "users" actor ON actor."id" = member."user_id"
    WHERE goal."id" = NEW."goal_id"
      AND goal."deleted_at" IS NULL
      AND goal."status" IN ('ACTIVE', 'COMPLETED')
      AND ledger."status" = 'ACTIVE'
      AND ledger."deleted_at" IS NULL
      AND member."status" = 'ACTIVE'
      AND actor."status" = 'ACTIVE'
      AND actor."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'SAVING_CONTRIBUTOR_NOT_ACTIVE_MEMBER' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "saving_contributions_active_member"
BEFORE INSERT OR UPDATE ON "saving_contributions"
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_contribution_active_member"();

CREATE OR REPLACE FUNCTION "enforce_saving_goal_create_facts_immutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."ledger_id" IS DISTINCT FROM OLD."ledger_id"
    OR NEW."creator_user_id" IS DISTINCT FROM OLD."creator_user_id"
    OR NEW."initial_cent" IS DISTINCT FROM OLD."initial_cent"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."create_request_hash" IS DISTINCT FROM OLD."create_request_hash"
  THEN
    RAISE EXCEPTION 'SAVING_GOAL_CREATE_FACTS_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "saving_goals_create_facts_immutable"
BEFORE UPDATE OF "ledger_id", "creator_user_id", "initial_cent", "idempotency_key", "create_request_hash"
ON "saving_goals"
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_goal_create_facts_immutable"();

CREATE OR REPLACE FUNCTION "enforce_saving_contribution_create_facts_immutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."goal_id" IS DISTINCT FROM OLD."goal_id"
    OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."create_request_hash" IS DISTINCT FROM OLD."create_request_hash"
  THEN
    RAISE EXCEPTION 'SAVING_CONTRIBUTION_CREATE_FACTS_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "saving_contributions_create_facts_immutable"
BEFORE UPDATE OF "goal_id", "user_id", "idempotency_key", "create_request_hash"
ON "saving_contributions"
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_contribution_create_facts_immutable"();

CREATE OR REPLACE FUNCTION "check_saving_goal_summary"(target_goal_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  expected_saved bigint;
  actual_saved bigint;
BEGIN
  SELECT
    goal."initial_cent" + COALESCE(SUM(contribution."amount_cent")
      FILTER (WHERE contribution."deleted_at" IS NULL), 0),
    goal."saved_cent"
  INTO expected_saved, actual_saved
  FROM "saving_goals" goal
  LEFT JOIN "saving_contributions" contribution ON contribution."goal_id" = goal."id"
  WHERE goal."id" = target_goal_id
  GROUP BY goal."id", goal."initial_cent", goal."saved_cent";

  IF FOUND AND actual_saved IS DISTINCT FROM expected_saved THEN
    RAISE EXCEPTION 'SAVING_GOAL_SUMMARY_MISMATCH' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "enforce_saving_goal_summary_from_goal"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "check_saving_goal_summary"(NEW."id");
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "enforce_saving_goal_summary_from_contribution"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "check_saving_goal_summary"(COALESCE(NEW."goal_id", OLD."goal_id"));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "saving_goals_summary_consistent"
AFTER INSERT OR UPDATE ON "saving_goals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_goal_summary_from_goal"();

CREATE CONSTRAINT TRIGGER "saving_contributions_summary_consistent"
AFTER INSERT OR UPDATE OR DELETE ON "saving_contributions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_saving_goal_summary_from_contribution"();
