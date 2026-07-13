-- TASK-006: convert global/user categories into ledger-scoped category instances.
ALTER TABLE "categories" RENAME COLUMN "owner_user_id" TO "creator_user_id";
ALTER TABLE "categories"
  ADD COLUMN "ledger_id" UUID,
  ADD COLUMN "color" TEXT NOT NULL DEFAULT '#64748B',
  ADD COLUMN "template_key" TEXT,
  ADD COLUMN "template_version" INTEGER,
  ADD COLUMN "idempotency_key" TEXT;

DROP INDEX IF EXISTS "categories_owner_user_id_type_is_enabled_idx";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_owner_user_id_fkey";

CREATE TEMP TABLE category_ledger_map ON COMMIT DROP AS
WITH referenced AS (
  SELECT DISTINCT c.id AS old_id, e.ledger_id
  FROM "categories" c
  JOIN "entries" e ON e.category_id = c.id
  UNION
  SELECT DISTINCT c.id AS old_id, r.ledger_id
  FROM "categories" c
  JOIN "recurring_rules" r ON r.category_id = c.id
), targets AS (
  SELECT old_id, ledger_id FROM referenced
  UNION
  SELECT c.id, l.id
  FROM "categories" c
  JOIN "ledgers" l
    ON l.owner_user_id = c.creator_user_id
   AND l.type = 'PERSONAL'
   AND l.status = 'ACTIVE'
   AND l.deleted_at IS NULL
  WHERE NOT c.is_system
    AND NOT EXISTS (SELECT 1 FROM referenced r WHERE r.old_id = c.id)
  UNION
  SELECT c.id, l.id
  FROM "categories" c
  CROSS JOIN "ledgers" l
  WHERE c.is_system
    AND l.status = 'ACTIVE'
    AND l.deleted_at IS NULL
)
SELECT old_id, ledger_id,
       overlay(
         overlay(md5(old_id::text || ':' || ledger_id::text) placing '4' from 13 for 1)
         placing '8' from 17 for 1
       )::uuid AS new_id
FROM targets;

DO $$
DECLARE
  old_count INTEGER;
  mapped_count INTEGER;
BEGIN
  SELECT count(*) INTO old_count FROM "categories";
  SELECT count(DISTINCT old_id) INTO mapped_count FROM category_ledger_map;
  IF old_count <> mapped_count THEN
    RAISE EXCEPTION 'Cannot assign every legacy category to a ledger (% mapped of %)', mapped_count, old_count;
  END IF;
END $$;

INSERT INTO "categories" (
  "id", "ledger_id", "creator_user_id", "type", "name", "icon", "color", "sort_order",
  "is_system", "is_enabled", "template_key", "template_version", "idempotency_key",
  "created_at", "updated_at"
)
SELECT
  m.new_id,
  m.ledger_id,
  CASE WHEN c.is_system THEN NULL ELSE COALESCE(c.creator_user_id, l.owner_user_id) END,
  c.type,
  btrim(c.name),
  CASE
    WHEN c.icon IN (
      'food', 'shopping', 'transport', 'housing', 'entertainment', 'medical', 'education',
      'gift', 'salary', 'bonus', 'part_time', 'investment', 'red_packet', 'refund', 'other'
    ) THEN c.icon
    WHEN c.type = 'EXPENSE' AND c.name = '餐饮' THEN 'food'
    WHEN c.type = 'EXPENSE' AND c.name = '购物' THEN 'shopping'
    WHEN c.type = 'EXPENSE' AND c.name = '交通' THEN 'transport'
    WHEN c.type = 'EXPENSE' AND c.name = '居住' THEN 'housing'
    WHEN c.type = 'EXPENSE' AND c.name = '娱乐' THEN 'entertainment'
    WHEN c.type = 'EXPENSE' AND c.name = '医疗' THEN 'medical'
    WHEN c.type = 'EXPENSE' AND c.name = '教育' THEN 'education'
    WHEN c.type = 'EXPENSE' AND c.name = '人情' THEN 'gift'
    WHEN c.type = 'INCOME' AND c.name = '工资' THEN 'salary'
    WHEN c.type = 'INCOME' AND c.name = '奖金' THEN 'bonus'
    WHEN c.type = 'INCOME' AND c.name = '兼职' THEN 'part_time'
    WHEN c.type = 'INCOME' AND c.name = '理财' THEN 'investment'
    WHEN c.type = 'INCOME' AND c.name = '红包' THEN 'red_packet'
    WHEN c.type = 'INCOME' AND c.name = '退款' THEN 'refund'
    ELSE 'other'
  END,
  '#64748B',
  GREATEST(c.sort_order, 0),
  c.is_system,
  c.is_enabled,
  CASE
    WHEN NOT c.is_system THEN NULL
    WHEN c.type = 'EXPENSE' AND c.name = '餐饮' THEN 'expense.food'
    WHEN c.type = 'EXPENSE' AND c.name = '购物' THEN 'expense.shopping'
    WHEN c.type = 'EXPENSE' AND c.name = '交通' THEN 'expense.transport'
    WHEN c.type = 'EXPENSE' AND c.name = '居住' THEN 'expense.housing'
    WHEN c.type = 'EXPENSE' AND c.name = '娱乐' THEN 'expense.entertainment'
    WHEN c.type = 'EXPENSE' AND c.name = '医疗' THEN 'expense.medical'
    WHEN c.type = 'EXPENSE' AND c.name = '教育' THEN 'expense.education'
    WHEN c.type = 'EXPENSE' AND c.name = '人情' THEN 'expense.gift'
    WHEN c.type = 'EXPENSE' AND c.name = '其他支出' THEN 'expense.other'
    WHEN c.type = 'INCOME' AND c.name = '工资' THEN 'income.salary'
    WHEN c.type = 'INCOME' AND c.name = '奖金' THEN 'income.bonus'
    WHEN c.type = 'INCOME' AND c.name = '兼职' THEN 'income.part_time'
    WHEN c.type = 'INCOME' AND c.name = '理财' THEN 'income.investment'
    WHEN c.type = 'INCOME' AND c.name = '红包' THEN 'income.red_packet'
    WHEN c.type = 'INCOME' AND c.name = '退款' THEN 'income.refund'
    WHEN c.type = 'INCOME' AND c.name = '其他收入' THEN 'income.other'
    ELSE 'legacy.system.' || c.id::text
  END,
  CASE WHEN c.is_system THEN 1 ELSE NULL END,
  NULL,
  c.created_at,
  c.updated_at
FROM category_ledger_map m
JOIN "categories" c ON c.id = m.old_id
JOIN "ledgers" l ON l.id = m.ledger_id;

UPDATE "entries" e
SET category_id = m.new_id
FROM category_ledger_map m
WHERE e.category_id = m.old_id AND e.ledger_id = m.ledger_id;

UPDATE "recurring_rules" r
SET category_id = m.new_id
FROM category_ledger_map m
WHERE r.category_id = m.old_id AND r.ledger_id = m.ledger_id;

DELETE FROM "categories" WHERE "ledger_id" IS NULL;

-- Keep legacy custom categories enabled when they conflict with system/default names. Any further
-- duplicates remain available for history but start disabled so the active-name invariant can hold.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY ledger_id, type, lower(btrim(name))
           ORDER BY is_system ASC, created_at ASC, id ASC
         ) AS active_rank
  FROM "categories"
  WHERE is_enabled
)
UPDATE "categories" category
SET is_enabled = false
FROM ranked
WHERE category.id = ranked.id AND ranked.active_rank > 1;

CREATE TEMP TABLE default_category_templates (
  type "EntryType" NOT NULL,
  template_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO default_category_templates VALUES
  ('EXPENSE', 'expense.food', '餐饮', 'food', '#E85D5D', 100),
  ('EXPENSE', 'expense.shopping', '购物', 'shopping', '#EC4899', 200),
  ('EXPENSE', 'expense.transport', '交通', 'transport', '#3B82F6', 300),
  ('EXPENSE', 'expense.housing', '居住', 'housing', '#8B5CF6', 400),
  ('EXPENSE', 'expense.entertainment', '娱乐', 'entertainment', '#F5A623', 500),
  ('EXPENSE', 'expense.medical', '医疗', 'medical', '#22A06B', 600),
  ('EXPENSE', 'expense.education', '教育', 'education', '#5B7CFA', 700),
  ('EXPENSE', 'expense.gift', '人情', 'gift', '#E67E22', 800),
  ('EXPENSE', 'expense.other', '其他支出', 'other', '#64748B', 900),
  ('INCOME', 'income.salary', '工资', 'salary', '#22A06B', 100),
  ('INCOME', 'income.bonus', '奖金', 'bonus', '#F5A623', 200),
  ('INCOME', 'income.part_time', '兼职', 'part_time', '#3B82F6', 300),
  ('INCOME', 'income.investment', '理财', 'investment', '#8B5CF6', 400),
  ('INCOME', 'income.red_packet', '红包', 'red_packet', '#E85D5D', 500),
  ('INCOME', 'income.refund', '退款', 'refund', '#5B7CFA', 600),
  ('INCOME', 'income.other', '其他收入', 'other', '#64748B', 700);

INSERT INTO "categories" (
  "id", "ledger_id", "creator_user_id", "type", "name", "icon", "color", "sort_order",
  "is_system", "is_enabled", "template_key", "template_version", "updated_at"
)
SELECT
  overlay(
    overlay(md5(l.id::text || ':' || t.template_key) placing '4' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  l.id,
  NULL,
  t.type,
  t.name,
  t.icon,
  t.color,
  t.sort_order,
  true,
  NOT EXISTS (
    SELECT 1 FROM "categories" existing
    WHERE existing.ledger_id = l.id
      AND existing.type = t.type
      AND existing.is_enabled
      AND lower(existing.name) = lower(t.name)
  ),
  t.template_key,
  1,
  CURRENT_TIMESTAMP
FROM "ledgers" l
CROSS JOIN default_category_templates t
WHERE l.status = 'ACTIVE'
  AND l.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "categories" existing
    WHERE existing.ledger_id = l.id AND existing.template_key = t.template_key
  );

ALTER TABLE "categories"
  ALTER COLUMN "ledger_id" SET NOT NULL,
  ALTER COLUMN "icon" SET NOT NULL,
  ALTER COLUMN "color" DROP DEFAULT;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_ledger_id_fkey"
    FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "categories_creator_user_id_fkey"
    FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "categories_name_valid"
    CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 50),
  ADD CONSTRAINT "categories_sort_order_valid" CHECK ("sort_order" >= 0),
  ADD CONSTRAINT "categories_color_valid" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "categories_icon_valid" CHECK ("icon" IN (
    'food', 'shopping', 'transport', 'housing', 'entertainment', 'medical', 'education',
    'gift', 'salary', 'bonus', 'part_time', 'investment', 'red_packet', 'refund', 'other'
  )),
  ADD CONSTRAINT "categories_template_shape_valid" CHECK (
    ("is_system" AND "creator_user_id" IS NULL AND "template_key" IS NOT NULL AND "template_version" IS NOT NULL)
    OR
    (NOT "is_system" AND "creator_user_id" IS NOT NULL AND "template_key" IS NULL AND "template_version" IS NULL)
  ),
  ADD CONSTRAINT "categories_idempotency_key_valid" CHECK (
    "idempotency_key" IS NULL OR char_length("idempotency_key") BETWEEN 8 AND 128
  );

CREATE UNIQUE INDEX "categories_ledger_id_template_key_key"
  ON "categories"("ledger_id", "template_key");
CREATE UNIQUE INDEX "categories_creator_user_id_idempotency_key_key"
  ON "categories"("creator_user_id", "idempotency_key");
CREATE UNIQUE INDEX "categories_id_ledger_id_type_key"
  ON "categories"("id", "ledger_id", "type");
CREATE UNIQUE INDEX "categories_active_name_key"
  ON "categories"("ledger_id", "type", lower("name")) WHERE "is_enabled";
CREATE INDEX "categories_ledger_id_type_is_enabled_sort_order_id_idx"
  ON "categories"("ledger_id", "type", "is_enabled", "sort_order", "id");

ALTER TABLE "entries" DROP CONSTRAINT "entries_category_id_fkey";
ALTER TABLE "entries"
  ADD CONSTRAINT "entries_category_scope_fkey"
  FOREIGN KEY ("category_id", "ledger_id", "type")
  REFERENCES "categories"("id", "ledger_id", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_rules" DROP CONSTRAINT "recurring_rules_category_id_fkey";
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_category_scope_fkey"
  FOREIGN KEY ("category_id", "ledger_id", "entry_type")
  REFERENCES "categories"("id", "ledger_id", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_entry_category_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c.id = NEW.category_id
      AND c.ledger_id = NEW.ledger_id
      AND c.type = NEW.type
      AND c.is_enabled
  ) THEN
    RAISE EXCEPTION 'Entry category must be active and belong to the same ledger and type'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entries_category_scope_active"
BEFORE INSERT OR UPDATE OF "category_id", "ledger_id", "type" ON "entries"
FOR EACH ROW EXECUTE FUNCTION validate_entry_category_reference();

CREATE OR REPLACE FUNCTION validate_recurring_category_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c.id = NEW.category_id
      AND c.ledger_id = NEW.ledger_id
      AND c.type = NEW.entry_type
      AND c.is_enabled
  ) THEN
    RAISE EXCEPTION 'Recurring category must be active and belong to the same ledger and type'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_rules_category_scope_active"
BEFORE INSERT OR UPDATE OF "category_id", "ledger_id", "entry_type" ON "recurring_rules"
FOR EACH ROW EXECUTE FUNCTION validate_recurring_category_reference();
