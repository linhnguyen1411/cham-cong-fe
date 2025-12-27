#!/bin/bash

# Sync migrations between Local and Production
# Usage: ./sync-migrations.sh [direction]
# direction: local-to-prod (default) or prod-to-local

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DIRECTION=${1:-local-to-prod}

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

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         🔄 Migration Sync Tool                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DIRECTION" = "local-to-prod" ]; then
    log_info "Direction: Local → Production"
    SOURCE_DB=$LOCAL_DB
    SOURCE_USER=$LOCAL_USER
    SOURCE_HOST=$LOCAL_HOST
    SOURCE_PASSWORD=$LOCAL_PASSWORD
    SOURCE_IS_REMOTE="no"
    
    TARGET_DB=$PROD_DB
    TARGET_USER=$PROD_USER
    TARGET_HOST=$PROD_HOST
    TARGET_PASSWORD=$PROD_PASSWORD
    TARGET_IS_REMOTE="yes"
    TARGET_VPS_IP=$VPS_IP
    TARGET_VPS_USER=$VPS_USER
    
    log_warning "This will run migrations on PRODUCTION database!"
elif [ "$DIRECTION" = "prod-to-local" ]; then
    log_info "Direction: Production → Local"
    SOURCE_DB=$PROD_DB
    SOURCE_USER=$PROD_USER
    SOURCE_HOST=$PROD_HOST
    SOURCE_PASSWORD=$PROD_PASSWORD
    SOURCE_IS_REMOTE="yes"
    SOURCE_VPS_IP=$VPS_IP
    SOURCE_VPS_USER=$VPS_USER
    
    TARGET_DB=$LOCAL_DB
    TARGET_USER=$LOCAL_USER
    TARGET_HOST=$LOCAL_HOST
    TARGET_PASSWORD=$LOCAL_PASSWORD
    TARGET_IS_REMOTE="no"
else
    log_error "Invalid direction: $DIRECTION"
    echo "Usage: $0 [local-to-prod|prod-to-local]"
    exit 1
fi

# Get migrations from source
log_info "Getting migrations from source database..."
if [ "$SOURCE_IS_REMOTE" = "yes" ]; then
    SOURCE_MIGRATIONS=$(ssh ${SOURCE_VPS_USER}@${SOURCE_VPS_IP} "export PGPASSWORD='${SOURCE_PASSWORD}' && psql -h ${SOURCE_HOST} -U ${SOURCE_USER} -d ${SOURCE_DB} -t -c \"SELECT version FROM schema_migrations ORDER BY version;\" 2>/dev/null" | xargs)
else
    SOURCE_MIGRATIONS=$(PGPASSWORD=${SOURCE_PASSWORD} psql -h ${SOURCE_HOST} -U ${SOURCE_USER} -d ${SOURCE_DB} -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | xargs)
fi

# Get migrations from target
log_info "Getting migrations from target database..."
if [ "$TARGET_IS_REMOTE" = "yes" ]; then
    TARGET_MIGRATIONS=$(ssh ${TARGET_VPS_USER}@${TARGET_VPS_IP} "export PGPASSWORD='${TARGET_PASSWORD}' && psql -h ${TARGET_HOST} -U ${TARGET_USER} -d ${TARGET_DB} -t -c \"SELECT version FROM schema_migrations ORDER BY version;\" 2>/dev/null" | xargs)
else
    TARGET_MIGRATIONS=$(PGPASSWORD=${TARGET_PASSWORD} psql -h ${TARGET_HOST} -U ${TARGET_USER} -d ${TARGET_DB} -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | xargs)
fi

# Find missing migrations
MISSING_MIGRATIONS=$(comm -23 <(echo "$SOURCE_MIGRATIONS" | tr ' ' '\n' | sort) <(echo "$TARGET_MIGRATIONS" | tr ' ' '\n' | sort))

if [ -z "$MISSING_MIGRATIONS" ]; then
    log_success "Migrations are already in sync!"
    exit 0
fi

echo ""
log_warning "Missing migrations in target database:"
echo "$MISSING_MIGRATIONS" | while read mig; do
    echo "  → $mig"
done
echo ""

if [ "$DIRECTION" = "local-to-prod" ]; then
    read -p "Run these migrations on PRODUCTION? (yes/no): " confirm
else
    read -p "Run these migrations on LOCAL? (yes/no): " confirm
fi

if [ "$confirm" != "yes" ]; then
    log_error "Sync cancelled"
    exit 1
fi

# Run migrations on target
log_info "Running migrations on target database..."

if [ "$TARGET_IS_REMOTE" = "yes" ]; then
    # On VPS - need to run Rails migrations
    log_info "Stopping Rails app..."
    ssh ${TARGET_VPS_USER}@${TARGET_VPS_IP} "pm2 stop timekeep-api" 2>/dev/null
    
    log_info "Running migrations..."
    ssh ${TARGET_VPS_USER}@${TARGET_VPS_IP} << EOF
cd ~/cham-cong-be
export RAILS_ENV=production
export DATABASE_USERNAME=${TARGET_USER}
export DATABASE_PASSWORD=${TARGET_PASSWORD}
export DATABASE_HOST=${TARGET_HOST}
export DATABASE_PORT=5432
bundle exec rails db:migrate
EOF
    
    log_info "Starting Rails app..."
    ssh ${TARGET_VPS_USER}@${TARGET_VPS_IP} "pm2 start timekeep-api && sleep 2 && pm2 status" 2>/dev/null
else
    # Local - run Rails migrations
    cd /Users/linhnguyen21/workspace/cham-cong/cham-cong-be
    log_info "Running migrations locally..."
    bundle exec rails db:migrate
fi

if [ $? -eq 0 ]; then
    log_success "Migrations synced successfully!"
else
    log_error "Migration sync failed!"
    exit 1
fi

echo ""
log_success "Done!"
echo ""

