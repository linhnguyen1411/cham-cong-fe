#!/bin/bash

# Compare two databases (Local vs Production)
# Usage: ./compare-db.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
LOCAL_DB="workspace_development"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PASSWORD="postgres"

PROD_DB="workspace_production"
PROD_USER="postgres"
PROD_PASSWORD="postgres"
PROD_HOST="localhost"
VPS_IP="112.213.87.124"
VPS_USER="root"

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_diff() {
    echo -e "${CYAN}📊 $1${NC}"
}

log_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         🔍 Database Comparison Tool                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to get table list
get_tables() {
    local db=$1
    local user=$2
    local host=$3
    local password=$4
    local is_remote=$5
    
    if [ "$is_remote" = "yes" ]; then
        ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${password}' && psql -h ${host} -U ${user} -d ${db} -t -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\" 2>/dev/null" | xargs
    else
        PGPASSWORD=${password} psql -h ${host} -U ${user} -d ${db} -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null | xargs
    fi
}

# Function to get table schema
get_table_schema() {
    local db=$1
    local user=$2
    local host=$3
    local password=$4
    local table=$5
    local is_remote=$6
    
    if [ "$is_remote" = "yes" ]; then
        ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${password}' && psql -h ${host} -U ${user} -d ${db} -c \"\\d ${table}\" 2>/dev/null"
    else
        PGPASSWORD=${password} psql -h ${host} -U ${user} -d ${db} -c "\\d ${table}" 2>/dev/null
    fi
}

# Function to get row count
get_row_count() {
    local db=$1
    local user=$2
    local host=$3
    local password=$4
    local table=$5
    local is_remote=$6
    
    if [ "$is_remote" = "yes" ]; then
        ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${password}' && psql -h ${host} -U ${user} -d ${db} -t -c \"SELECT COUNT(*) FROM ${table};\" 2>/dev/null" | xargs
    else
        PGPASSWORD=${password} psql -h ${host} -U ${user} -d ${db} -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | xargs
    fi
}

# Function to get migrations
get_migrations() {
    local db=$1
    local user=$2
    local host=$3
    local password=$4
    local is_remote=$5
    
    if [ "$is_remote" = "yes" ]; then
        ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${password}' && psql -h ${host} -U ${user} -d ${db} -t -c \"SELECT version FROM schema_migrations ORDER BY version;\" 2>/dev/null" | xargs
    else
        PGPASSWORD=${password} psql -h ${host} -U ${user} -d ${db} -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | xargs
    fi
}

# Check connectivity
log_info "Checking local database connection..."
if ! PGPASSWORD=${LOCAL_PASSWORD} psql -h ${LOCAL_HOST} -U ${LOCAL_USER} -d ${LOCAL_DB} -c "SELECT 1;" >/dev/null 2>&1; then
    log_error "Cannot connect to local database"
    exit 1
fi
log_success "Local database connected"

log_info "Checking production database connection..."
if ! ssh -q ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${PROD_PASSWORD}' && psql -h ${PROD_HOST} -U ${PROD_USER} -d ${PROD_DB} -c 'SELECT 1;' >/dev/null 2>&1"; then
    log_error "Cannot connect to production database"
    exit 1
fi
log_success "Production database connected"

echo ""
log_section "📋 COMPARING SCHEMA MIGRATIONS"
echo ""

# Compare migrations
log_info "Getting migrations from local database..."
LOCAL_MIGRATIONS=$(get_migrations ${LOCAL_DB} ${LOCAL_USER} ${LOCAL_HOST} ${LOCAL_PASSWORD} "no")
LOCAL_MIG_COUNT=$(echo "$LOCAL_MIGRATIONS" | wc -w | xargs)

log_info "Getting migrations from production database..."
PROD_MIGRATIONS=$(get_migrations ${PROD_DB} ${PROD_USER} ${PROD_HOST} ${PROD_PASSWORD} "yes")
PROD_MIG_COUNT=$(echo "$PROD_MIGRATIONS" | wc -w | xargs)

echo ""
log_diff "Local migrations: ${LOCAL_MIG_COUNT}"
log_diff "Production migrations: ${PROD_MIG_COUNT}"
echo ""

# Find missing migrations
MISSING_IN_PROD=$(comm -23 <(echo "$LOCAL_MIGRATIONS" | tr ' ' '\n' | sort) <(echo "$PROD_MIGRATIONS" | tr ' ' '\n' | sort))
MISSING_IN_LOCAL=$(comm -13 <(echo "$LOCAL_MIGRATIONS" | tr ' ' '\n' | sort) <(echo "$PROD_MIGRATIONS" | tr ' ' '\n' | sort))

if [ -n "$MISSING_IN_PROD" ]; then
    log_warning "Migrations in LOCAL but NOT in PRODUCTION:"
    echo "$MISSING_IN_PROD" | while read mig; do
        echo "  → $mig"
    done
fi

if [ -n "$MISSING_IN_LOCAL" ]; then
    log_warning "Migrations in PRODUCTION but NOT in LOCAL:"
    echo "$MISSING_IN_LOCAL" | while read mig; do
        echo "  → $mig"
    done
fi

if [ -z "$MISSING_IN_PROD" ] && [ -z "$MISSING_IN_LOCAL" ]; then
    log_success "Migrations are in sync!"
fi

echo ""
log_section "📊 COMPARING TABLES"
echo ""

# Get table lists
log_info "Getting table list from local database..."
LOCAL_TABLES=$(get_tables ${LOCAL_DB} ${LOCAL_USER} ${LOCAL_HOST} ${LOCAL_PASSWORD} "no")
LOCAL_TABLE_COUNT=$(echo "$LOCAL_TABLES" | wc -w | xargs)

log_info "Getting table list from production database..."
PROD_TABLES=$(get_tables ${PROD_DB} ${PROD_USER} ${PROD_HOST} ${PROD_PASSWORD} "yes")
PROD_TABLE_COUNT=$(echo "$PROD_TABLES" | wc -w | xargs)

log_diff "Local tables: ${LOCAL_TABLE_COUNT}"
log_diff "Production tables: ${PROD_TABLE_COUNT}"
echo ""

# Find missing tables
MISSING_TABLES_IN_PROD=$(comm -23 <(echo "$LOCAL_TABLES" | tr ' ' '\n' | sort) <(echo "$PROD_TABLES" | tr ' ' '\n' | sort))
MISSING_TABLES_IN_LOCAL=$(comm -13 <(echo "$LOCAL_TABLES" | tr ' ' '\n' | sort) <(echo "$PROD_TABLES" | tr ' ' '\n' | sort))

if [ -n "$MISSING_TABLES_IN_PROD" ]; then
    log_warning "Tables in LOCAL but NOT in PRODUCTION:"
    echo "$MISSING_TABLES_IN_PROD" | while read table; do
        echo "  → $table"
    done
fi

if [ -n "$MISSING_TABLES_IN_LOCAL" ]; then
    log_warning "Tables in PRODUCTION but NOT in LOCAL:"
    echo "$MISSING_TABLES_IN_LOCAL" | while read table; do
        echo "  → $table"
    done
fi

echo ""
log_section "📈 COMPARING DATA COUNTS"
echo ""

# Compare row counts for common tables
COMMON_TABLES=$(comm -12 <(echo "$LOCAL_TABLES" | tr ' ' '\n' | sort) <(echo "$PROD_TABLES" | tr ' ' '\n' | sort))

if [ -n "$COMMON_TABLES" ]; then
    printf "%-30s %15s %15s %10s\n" "Table" "Local" "Production" "Diff"
    echo "─────────────────────────────────────────────────────────────────────"
    
    echo "$COMMON_TABLES" | while read table; do
        LOCAL_COUNT=$(get_row_count ${LOCAL_DB} ${LOCAL_USER} ${LOCAL_HOST} ${LOCAL_PASSWORD} "$table" "no")
        PROD_COUNT=$(get_row_count ${PROD_DB} ${PROD_USER} ${PROD_HOST} ${PROD_PASSWORD} "$table" "yes")
        
        if [ -n "$LOCAL_COUNT" ] && [ -n "$PROD_COUNT" ]; then
            DIFF=$((LOCAL_COUNT - PROD_COUNT))
            if [ $DIFF -ne 0 ]; then
                printf "%-30s %15s %15s %10s\n" "$table" "$LOCAL_COUNT" "$PROD_COUNT" "$DIFF"
            fi
        fi
    done
    
    echo ""
    log_info "Showing only tables with different row counts"
fi

echo ""
log_section "🔍 DETAILED SCHEMA DIFFERENCES"
echo ""

# Ask if user wants detailed schema diff
read -p "Show detailed schema differences? (y/n): " show_schema

if [ "$show_schema" = "y" ] || [ "$show_schema" = "Y" ]; then
    echo ""
    log_info "Comparing table schemas..."
    echo ""
    
    echo "$COMMON_TABLES" | while read table; do
        log_diff "Table: $table"
        
        LOCAL_SCHEMA=$(get_table_schema ${LOCAL_DB} ${LOCAL_USER} ${LOCAL_HOST} ${LOCAL_PASSWORD} "$table" "no")
        PROD_SCHEMA=$(get_table_schema ${PROD_DB} ${PROD_USER} ${PROD_HOST} ${PROD_PASSWORD} "$table" "yes")
        
        if [ "$LOCAL_SCHEMA" != "$PROD_SCHEMA" ]; then
            log_warning "Schema differences found in table: $table"
            echo ""
            echo "--- LOCAL SCHEMA ---"
            echo "$LOCAL_SCHEMA"
            echo ""
            echo "--- PRODUCTION SCHEMA ---"
            echo "$PROD_SCHEMA"
            echo ""
            echo "─────────────────────────────────────────────────────────────"
            echo ""
        fi
    done
fi

echo ""
log_section "📝 SUMMARY"
echo ""

# Summary
echo "Local Database:"
echo "  → Migrations: ${LOCAL_MIG_COUNT}"
echo "  → Tables: ${LOCAL_TABLE_COUNT}"
echo ""

echo "Production Database:"
echo "  → Migrations: ${PROD_MIG_COUNT}"
echo "  → Tables: ${PROD_TABLE_COUNT}"
echo ""

if [ -n "$MISSING_IN_PROD" ] || [ -n "$MISSING_IN_LOCAL" ]; then
    log_warning "⚠️  Migration mismatch detected!"
    log_info "Run migrations on the database that is missing them"
fi

if [ -n "$MISSING_TABLES_IN_PROD" ] || [ -n "$MISSING_TABLES_IN_LOCAL" ]; then
    log_warning "⚠️  Table mismatch detected!"
    log_info "Some tables exist in one database but not the other"
fi

echo ""
log_success "Comparison complete!"
echo ""

