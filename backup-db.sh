#!/bin/bash

# TimeKeep Pro - Database Backup Script
# Downloads a database backup from VPS to local machine

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="112.213.87.124"
VPS_USER="root"
# Auto-detect database name from Rails config, fallback to default
LOCAL_BACKEND_PATH="/Users/linhnguyen21/workspace/cham-cong/cham-cong-be"
DB_NAME=$(grep -A 2 "^production:" ${LOCAL_BACKEND_PATH}/config/database.yml 2>/dev/null | grep "database:" | awk '{print $2}' | tr -d '"' || echo "workspace_production")
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"

# Local backup folder
LOCAL_BACKUP_DIR="/Users/linhnguyen21/workspace/cham-cong/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="cham_cong_backup_${TIMESTAMP}.sql"
BACKUP_FILENAME_GZ="${BACKUP_FILENAME}.gz"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Main backup process
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    💾 TimeKeep Pro - Database Backup Script    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Create local backup directory if not exists
mkdir -p "${LOCAL_BACKUP_DIR}"
log_info "Backup directory: ${LOCAL_BACKUP_DIR}"

# 1️⃣ Check VPS connectivity
log_info "Checking VPS connectivity..."
if ! ssh -q ${VPS_USER}@${VPS_IP} "echo 'Connected'" >/dev/null 2>&1; then
    log_error "Cannot connect to VPS at ${VPS_IP}"
    exit 1
fi
log_success "VPS is reachable"

# 1️⃣.5️⃣ Check if database exists
log_info "Detecting database name on VPS..."
log_info "Expected database: ${DB_NAME}"

# List all databases
AVAILABLE_DBS=$(ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${DB_PASSWORD}' && psql -h ${DB_HOST} -U ${DB_USER} -lqt 2>/dev/null | cut -d \| -f 1 | sed 's/^[[:space:]]*//' | grep -v '^$' | grep -v 'template' | grep -v 'postgres'")

if [ -n "$AVAILABLE_DBS" ]; then
    log_info "Available databases on VPS:"
    echo "$AVAILABLE_DBS" | while read db; do
        if [ -n "$db" ]; then
            log_info "  → $db"
        fi
    done
fi

# Check if expected database exists
DB_EXISTS=$(ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${DB_PASSWORD}' && psql -h ${DB_HOST} -U ${DB_USER} -lqt 2>/dev/null | cut -d \| -f 1 | sed 's/^[[:space:]]*//' | grep -qw '${DB_NAME}' && echo 'yes' || echo 'no'")

if [ "$DB_EXISTS" != "yes" ]; then
    # Try to find a similar database name
    FOUND_DB=$(echo "$AVAILABLE_DBS" | grep -iE "(workspace|cham.?cong|production)" | head -1 | xargs)
    
    if [ -n "$FOUND_DB" ]; then
        log_warning "Database '${DB_NAME}' not found, but found similar: '${FOUND_DB}'"
        log_info "Using '${FOUND_DB}' for backup..."
        DB_NAME="$FOUND_DB"
        DB_EXISTS="yes"
    else
        log_error "Database '${DB_NAME}' does not exist on VPS"
        log_info "Available databases listed above"
        log_info "Cannot create backup - database not found"
        exit 1
    fi
fi
log_success "Database found: ${DB_NAME}"

# 1️⃣.6️⃣ Test PostgreSQL connection
log_info "Testing PostgreSQL connection..."
PG_ACCESS=$(ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${DB_PASSWORD}' && psql -h ${DB_HOST} -U ${DB_USER} -d postgres -c 'SELECT 1;' >/dev/null 2>&1 && echo 'yes' || echo 'no'")

if [ "$PG_ACCESS" != "yes" ]; then
    log_error "Cannot connect to PostgreSQL"
    log_info "Please check database credentials and connection"
    exit 1
fi
log_success "PostgreSQL connection OK"

# 2️⃣ Create backup on VPS
log_info "Creating database backup on VPS..."
BACKUP_RESULT=$(ssh ${VPS_USER}@${VPS_IP} bash << EOF
cd /tmp
rm -f /tmp/cham_cong_backup_*.sql.gz
export PGPASSWORD='${DB_PASSWORD}'
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -F p --clean --if-exists > /tmp/${BACKUP_FILENAME} 2>&1
DUMP_EXIT_CODE=\$?
if [ \$DUMP_EXIT_CODE -eq 0 ] && [ -f /tmp/${BACKUP_FILENAME} ] && [ -s /tmp/${BACKUP_FILENAME} ]; then
    gzip -f /tmp/${BACKUP_FILENAME}
    if [ -f /tmp/${BACKUP_FILENAME_GZ} ]; then
        echo "BACKUP_SUCCESS"
        ls -lh /tmp/${BACKUP_FILENAME_GZ} | awk '{print \$5}'
    else
        echo "BACKUP_FAILED: Compression failed"
    fi
else
    echo "BACKUP_FAILED: pg_dump exit code: \$DUMP_EXIT_CODE"
    if [ -f /tmp/${BACKUP_FILENAME} ]; then
        echo "Error details:"
        head -5 /tmp/${BACKUP_FILENAME} 2>/dev/null || echo "Cannot read file"
    fi
fi
EOF
)

# 3️⃣ Check if backup exists on VPS
log_info "Verifying backup on VPS..."
if echo "$BACKUP_RESULT" | grep -q "BACKUP_SUCCESS"; then
    BACKUP_SIZE=$(echo "$BACKUP_RESULT" | grep -v "BACKUP_SUCCESS" | head -1)
    log_success "Backup created on VPS (${BACKUP_SIZE})"
else
    log_error "Backup creation failed"
    echo "$BACKUP_RESULT" | grep -v "BACKUP_" | while read line; do
        log_info "  → $line"
    done
    exit 1
fi

# 4️⃣ Download backup to local machine
log_info "Downloading backup to local machine..."
scp ${VPS_USER}@${VPS_IP}:/tmp/${BACKUP_FILENAME_GZ} "${LOCAL_BACKUP_DIR}/"

if [ -f "${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}" ]; then
    BACKUP_SIZE=$(ls -lh "${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}" | awk '{print $5}')
    log_success "Backup downloaded successfully!"
    echo ""
    echo -e "${GREEN}📁 Backup saved: ${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}${NC}"
    echo -e "${GREEN}📦 Size: ${BACKUP_SIZE}${NC}"
else
    log_error "Failed to download backup"
    exit 1
fi

# 5️⃣ Clean up old backups (keep last 10)
log_info "Cleaning up old backups (keeping last 10)..."
cd "${LOCAL_BACKUP_DIR}"
ls -t cham_cong_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
BACKUP_COUNT=$(ls -1 cham_cong_backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
log_success "Current backups: ${BACKUP_COUNT}"

# 6️⃣ Clean up remote backup
log_info "Cleaning up backup on VPS..."
ssh ${VPS_USER}@${VPS_IP} "rm -f /tmp/${BACKUP_FILENAME_GZ}"
log_success "Remote cleanup complete"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         💾 Backup Completed! 💾                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Backup Details:${NC}"
echo -e "   📁 File: ${CYAN}${BACKUP_FILENAME_GZ}${NC}"
echo -e "   📍 Location: ${CYAN}${LOCAL_BACKUP_DIR}${NC}"
echo -e "   📦 Size: ${CYAN}${BACKUP_SIZE}${NC}"
echo -e "   🕐 Time: ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""
echo -e "${YELLOW}📖 To restore this backup:${NC}"
echo -e "   ${BLUE}gunzip -k ${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}${NC}"
echo -e "   ${BLUE}psql -h localhost -U postgres -d cham_cong_development < ${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME}${NC}"
echo ""

# Return backup path for use in other scripts
echo "${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}"

