-- TASK-005 / BR-COUPLE-001..014: invitation idempotency and database-level membership bounds.
ALTER TABLE "ledgers" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "ledger_invitations" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "ledgers_owner_idempotency_key_unique"
ON "ledgers" ("owner_user_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "ledger_invitations_inviter_idempotency_key_unique"
ON "ledger_invitations" ("inviter_user_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "ledger_invitations_one_pending_per_ledger"
ON "ledger_invitations" ("ledger_id")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "ledger_members_one_active_owner_per_ledger"
ON "ledger_members" ("ledger_id")
WHERE "status" = 'ACTIVE' AND "role" = 'OWNER';

CREATE OR REPLACE FUNCTION "enforce_couple_membership_bounds"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_type "LedgerType";
  target_status "LedgerStatus";
  other_member_count integer;
  other_couple_count integer;
BEGIN
  IF NEW."status" <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT "type", "status" INTO target_type, target_status
  FROM "ledgers"
  WHERE "id" = NEW."ledger_id";

  IF target_type <> 'COUPLE' OR target_status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('siyu:couple-ledger:' || NEW."ledger_id"::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('siyu:couple-user:' || NEW."user_id"::text, 0));

  -- Preserve the existing (ledger_id, user_id) unique-constraint error for exact duplicates.
  IF EXISTS (
    SELECT 1 FROM "ledger_members"
    WHERE "ledger_id" = NEW."ledger_id"
      AND "user_id" = NEW."user_id"
      AND "id" <> NEW."id"
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO other_member_count
  FROM "ledger_members"
  WHERE "ledger_id" = NEW."ledger_id"
    AND "status" = 'ACTIVE'
    AND "id" <> NEW."id";

  IF other_member_count >= 2 THEN
    RAISE EXCEPTION 'COUPLE_LEDGER_FULL' USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO other_couple_count
  FROM "ledger_members" member
  JOIN "ledgers" ledger ON ledger."id" = member."ledger_id"
  WHERE member."user_id" = NEW."user_id"
    AND member."status" = 'ACTIVE'
    AND member."id" <> NEW."id"
    AND ledger."type" = 'COUPLE'
    AND ledger."status" = 'ACTIVE';

  IF other_couple_count >= 1 THEN
    RAISE EXCEPTION 'COUPLE_ALREADY_JOINED' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_members_couple_bounds"
BEFORE INSERT OR UPDATE OF "ledger_id", "user_id", "status" ON "ledger_members"
FOR EACH ROW EXECUTE FUNCTION "enforce_couple_membership_bounds"();
