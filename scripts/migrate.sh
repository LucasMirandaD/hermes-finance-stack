#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_CONTAINER="${DB_CONTAINER:-expenses-postgres}"
DB_USER="${EXPENSES_DB_USER:-expenses_user}"
DB_NAME="${EXPENSES_DB_NAME:-expenses_db}"
NORMALIZE_CATEGORIES="false"
DEFAULT_MEMBER_NAME=""
DEFAULT_MEMBER_SLUG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-container)
      DB_CONTAINER="$2"
      shift 2
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --normalize-categories)
      NORMALIZE_CATEGORIES="true"
      shift
      ;;
    --backfill-owner)
      DEFAULT_MEMBER_NAME="$2"
      DEFAULT_MEMBER_SLUG="$(echo "$2" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [options]

Safely migrates an existing Hermes Finance Stack PostgreSQL database to v2.0.0:
  1. Takes a pg_dump backup in /tmp
  2. Applies idempotent SQL migrations (001 & 002)
  3. Optionally normalizes legacy category names (--normalize-categories)
  4. Optionally creates a default member and backfills paid_by_member_id (--backfill-owner "Name")

Options:
  --db-container <name>     PostgreSQL container name (default: expenses-postgres)
  --db-user <user>          PostgreSQL user (default: expenses_user)
  --db-name <db>            PostgreSQL database (default: expenses_db)
  --normalize-categories    Normalize legacy categories (SUPERMERCADOS, GASTRONOMIA, PRESTAMOS_Y_CUOTAS)
  --backfill-owner <name>   Create default member and assign NULL paid_by_member_id expenses to it
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=== Hermes Finance Stack v1 -> v2 Migration ==="
echo "Container : $DB_CONTAINER"
echo "Database  : $DB_NAME (user: $DB_USER)"
echo ""

BACKUP_FILE="/tmp/${DB_NAME}_backup_$(date +%Y%m%d_%H%M%S).sql"
echo "1) Creating safety backup at ${BACKUP_FILE}..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"

echo ""
echo "2) Applying idempotent SQL migrations..."
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  < "$ROOT_DIR/backend/sql/001_multiuser_budgets_fixed_expenses.sql"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  < "$ROOT_DIR/backend/sql/002_outings.sql"

if [[ "$NORMALIZE_CATEGORIES" == "true" ]]; then
  echo ""
  echo "3) Normalizing legacy category names..."
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
UPDATE expenses SET category = 'SUPERMERCADO' WHERE UPPER(category) = 'SUPERMERCADOS';
UPDATE expenses SET category = 'COMIDA_Y_SALIDAS' WHERE UPPER(category) = 'GASTRONOMIA';
UPDATE expenses SET category = 'PRESTAMOS_Y_SEGUROS' WHERE UPPER(category) = 'PRESTAMOS_Y_CUOTAS';
SQL
fi

if [[ -n "$DEFAULT_MEMBER_NAME" ]]; then
  echo ""
  echo "4) Creating default member '${DEFAULT_MEMBER_NAME}' (${DEFAULT_MEMBER_SLUG}) and backfilling NULL paid_by_member_id..."
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -v member_name="$DEFAULT_MEMBER_NAME" -v member_slug="$DEFAULT_MEMBER_SLUG" <<'SQL'
INSERT INTO members (slug, display_name, is_active)
VALUES (:'member_slug', :'member_name', TRUE)
ON CONFLICT (slug) DO NOTHING;

UPDATE expenses
SET paid_by_member_id = (SELECT id FROM members WHERE slug = :'member_slug')
WHERE paid_by_member_id IS NULL;
SQL
fi

echo ""
echo "5) Verifying tables and row counts..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'expenses' AS table_name, COUNT(*) AS rows FROM expenses
UNION ALL SELECT 'expense_installments', COUNT(*) FROM expense_installments
UNION ALL SELECT 'credit_cards', COUNT(*) FROM credit_cards
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'outings', COUNT(*) FROM outings
UNION ALL SELECT 'recurring_expenses', COUNT(*) FROM recurring_expenses
UNION ALL SELECT 'category_budgets', COUNT(*) FROM category_budgets;
"

echo ""
echo "✅ Migration complete! Backup saved at ${BACKUP_FILE}."
