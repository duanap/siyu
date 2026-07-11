#!/usr/bin/env bash
set -euo pipefail

required=(
  "AGENTS.md"
  "docs/index.md"
  "docs/product/BRAND_IDENTITY.md"
  "docs/product/PRODUCT_REQUIREMENTS.md"
  "docs/product/BUSINESS_RULES.md"
  "docs/product/ACCEPTANCE_CRITERIA.md"
  "docs/product/GLOSSARY.md"
  "docs/design/UI_DESIGN_GUIDE.md"
  "docs/design/INFORMATION_ARCHITECTURE.md"
  "docs/architecture/TECH_ARCHITECTURE.md"
  "docs/architecture/DATABASE_SCHEMA.md"
  "docs/architecture/API_CONTRACT.md"
  "docs/architecture/openapi.yaml"
  "docs/plans/active/TASK-000-project-bootstrap.md"
  "docs/project-memory/CURRENT_STATE.md"
  "docs/project-memory/CHANGELOG_AI.md"
  "docs/project-memory/KNOWN_ISSUES.md"
  "docs/project-memory/DECISIONS.md"
  "docs/quality/DEFINITION_OF_DONE.md"
  "docs/quality/TEST_STRATEGY.md"
  "docs/quality/RELEASE_CHECKLIST.md"
)

missing=0
for file in "${required[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "Missing or empty: $file"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

if [[ -e BRAND_IDENTITY.md ]]; then
  echo "Brand source must live at docs/product/BRAND_IDENTITY.md, not repository root."
  exit 1
fi

if ! grep -q 'product/BRAND_IDENTITY.md' docs/index.md; then
  echo "docs/index.md does not reference the brand source of truth."
  exit 1
fi

echo "Required project documents are present."
