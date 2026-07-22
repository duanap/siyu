-- TASK-015: salary profiles, reusable templates, idempotent monthly records, and database invariants.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM salary_profiles
    WHERE status NOT IN ('ACTIVE', 'INACTIVE')
       OR name <> btrim(name) OR name = ''
       OR employer_name IS NOT NULL AND (employer_name <> btrim(employer_name) OR employer_name = '')
  ) THEN
    RAISE EXCEPTION 'TASK-015 migration refused invalid salary profile text or status';
  END IF;
  IF EXISTS (
    SELECT 1 FROM salary_profiles
    WHERE deleted_at IS NULL AND status = 'ACTIVE'
    GROUP BY user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TASK-015 migration refused multiple active salary profiles for one user';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM salary_records records
    LEFT JOIN (
      SELECT
        salary_record_id,
        COALESCE(sum(amount_cent) FILTER (WHERE item_type = 'EARNING'), 0) AS earning_total,
        COALESCE(sum(amount_cent) FILTER (WHERE item_type = 'DEDUCTION'), 0) AS deduction_total
      FROM salary_items
      GROUP BY salary_record_id
    ) items ON items.salary_record_id = records.id
    WHERE COALESCE(items.earning_total, 0) <= 0
       OR COALESCE(items.deduction_total, 0) > COALESCE(items.earning_total, 0)
       OR records.gross_cent <> COALESCE(items.earning_total, 0)
       OR records.deduction_cent <> COALESCE(items.deduction_total, 0)
       OR records.net_cent <> COALESCE(items.earning_total, 0) - COALESCE(items.deduction_total, 0)
  ) THEN
    RAISE EXCEPTION 'TASK-015 migration refused inconsistent salary record items and totals';
  END IF;
END $$;

ALTER TABLE salary_profiles
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN create_request_hash TEXT;

UPDATE salary_profiles
SET idempotency_key = 'legacy-' || id::text,
    create_request_hash = repeat('0', 64);

ALTER TABLE salary_profiles
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN create_request_hash SET NOT NULL;

CREATE TABLE salary_profile_items (
  id UUID NOT NULL,
  profile_id UUID NOT NULL,
  item_type "SalaryItemType" NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount_cent BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT salary_profile_items_pkey PRIMARY KEY (id),
  CONSTRAINT salary_profile_items_profile_id_fkey FOREIGN KEY (profile_id)
    REFERENCES salary_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE salary_records
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN create_request_hash TEXT;

UPDATE salary_records
SET idempotency_key = 'legacy-' || id::text,
    create_request_hash = repeat('0', 64);

ALTER TABLE salary_records
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN create_request_hash SET NOT NULL;

CREATE UNIQUE INDEX salary_profiles_user_id_idempotency_key_key
  ON salary_profiles(user_id, idempotency_key);
CREATE UNIQUE INDEX salary_profiles_one_active_per_user
  ON salary_profiles(user_id) WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE UNIQUE INDEX salary_profile_items_profile_id_item_code_key
  ON salary_profile_items(profile_id, item_code);
CREATE INDEX salary_profile_items_profile_id_item_type_sort_order_idx
  ON salary_profile_items(profile_id, item_type, sort_order);
CREATE UNIQUE INDEX salary_records_user_id_idempotency_key_key
  ON salary_records(user_id, idempotency_key);
CREATE UNIQUE INDEX salary_items_salary_record_id_item_code_key
  ON salary_items(salary_record_id, item_code);
CREATE INDEX salary_records_user_id_salary_month_id_idx
  ON salary_records(user_id, salary_month DESC, id DESC) WHERE deleted_at IS NULL;

ALTER TABLE salary_profiles
  ADD CONSTRAINT salary_profiles_text_valid CHECK (
    char_length(name) BETWEEN 1 AND 100 AND name = btrim(name)
    AND (employer_name IS NULL OR char_length(employer_name) BETWEEN 1 AND 100 AND employer_name = btrim(employer_name))
    AND status IN ('ACTIVE', 'INACTIVE')
  ),
  ADD CONSTRAINT salary_profiles_idempotency_valid CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
    AND idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    AND create_request_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE salary_profile_items
  ADD CONSTRAINT salary_profile_items_text_valid CHECK (
    char_length(item_code) BETWEEN 1 AND 50 AND item_code = btrim(item_code)
    AND item_code ~ '^[a-z][a-z0-9_]*$'
    AND char_length(item_name) BETWEEN 1 AND 100 AND item_name = btrim(item_name)
  ),
  ADD CONSTRAINT salary_profile_items_amount_valid CHECK (
    amount_cent BETWEEN 0 AND 9007199254740991 AND sort_order >= 0
  );

ALTER TABLE salary_records
  ADD CONSTRAINT salary_records_idempotency_valid CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 128
    AND idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    AND create_request_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE salary_items
  ADD CONSTRAINT salary_items_text_valid CHECK (
    char_length(item_code) BETWEEN 1 AND 50 AND item_code = btrim(item_code)
    AND item_code ~ '^[a-z][a-z0-9_]*$'
    AND char_length(item_name) BETWEEN 1 AND 100 AND item_name = btrim(item_name)
  );

CREATE FUNCTION check_salary_record_items_consistent() RETURNS trigger AS $$
DECLARE
  target_id UUID;
  record_row salary_records%ROWTYPE;
  earning_total BIGINT;
  deduction_total BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'salary_records' THEN
    target_id := COALESCE(NEW.id, OLD.id);
  ELSE
    target_id := COALESCE(NEW.salary_record_id, OLD.salary_record_id);
  END IF;
  SELECT * INTO record_row FROM salary_records WHERE id = target_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT
    COALESCE(sum(amount_cent) FILTER (WHERE item_type = 'EARNING'), 0),
    COALESCE(sum(amount_cent) FILTER (WHERE item_type = 'DEDUCTION'), 0)
  INTO earning_total, deduction_total
  FROM salary_items WHERE salary_record_id = target_id;

  IF earning_total <= 0 OR deduction_total > earning_total
     OR record_row.gross_cent <> earning_total
     OR record_row.deduction_cent <> deduction_total
     OR record_row.net_cent <> earning_total - deduction_total THEN
    RAISE EXCEPTION 'salary record items and totals are inconsistent' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER salary_records_items_consistent
AFTER INSERT OR UPDATE OF gross_cent, deduction_cent, net_cent ON salary_records
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION check_salary_record_items_consistent();

CREATE CONSTRAINT TRIGGER salary_items_record_consistent
AFTER INSERT OR UPDATE OR DELETE ON salary_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION check_salary_record_items_consistent();

CREATE FUNCTION protect_salary_immutable_facts() RETURNS trigger AS $$
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
      NEW.gross_cent <> OLD.gross_cent OR NEW.deduction_cent <> OLD.deduction_cent
      OR NEW.net_cent <> OLD.net_cent OR NEW.salary_month <> OLD.salary_month
    ) THEN
      RAISE EXCEPTION 'paid salary record is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER salary_profiles_immutable_facts
BEFORE UPDATE ON salary_profiles FOR EACH ROW EXECUTE FUNCTION protect_salary_immutable_facts();
CREATE TRIGGER salary_records_immutable_facts
BEFORE UPDATE ON salary_records FOR EACH ROW EXECUTE FUNCTION protect_salary_immutable_facts();

CREATE FUNCTION protect_paid_salary_items() RETURNS trigger AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.salary_record_id;
  ELSE
    target_id := NEW.salary_record_id;
  END IF;
  IF EXISTS (SELECT 1 FROM salary_records WHERE id = target_id AND payment_status = 'PAID') THEN
    RAISE EXCEPTION 'paid salary items are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER salary_items_paid_immutable
BEFORE INSERT OR UPDATE OR DELETE ON salary_items
FOR EACH ROW EXECUTE FUNCTION protect_paid_salary_items();
