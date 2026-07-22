-- TASK-013: confirmation-mode recurring runs notify each actionable recipient once.
CREATE INDEX "notifications_user_type_related_idx"
ON "notifications"("user_id", "type", "related_type", "related_id");

CREATE UNIQUE INDEX "notifications_recurring_confirmation_unique"
ON "notifications"("user_id", "related_id")
WHERE "type" = 'RECURRING_CONFIRMATION_DUE'
  AND "related_type" = 'RECURRING_RUN'
  AND "related_id" IS NOT NULL;
