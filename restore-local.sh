#!/bin/bash

# Restore Database to Local Development
# Usage: ./restore-local.sh <backup_file.sql.gz>

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_FILE=$1
LOCAL_BACKUP_DIR="/Users/linhnguyen21/workspace/cham-cong/backups"
DB_NAME="workspace_development"
DB_USER="postgres"
DB_HOST="localhost"

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

# Check if backup file provided
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup_file.sql.gz>"
    echo ""
    log_info "Available backups:"
    ls -lh ${LOCAL_BACKUP_DIR}/*.sql.gz 2>/dev/null | tail -5 | awk '{print "  → " $9 " (" $5 ")"}'
    exit 1
fi

# Check if file exists
if [ ! -f "${LOCAL_BACKUP_DIR}/${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${LOCAL_BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    🔄 Restore Database to Local Development     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

log_info "Backup file: ${BACKUP_FILE}"
log_info "Target database: ${DB_NAME}"

# Extract backup
log_info "Extracting backup..."
cd ${LOCAL_BACKUP_DIR}
gunzip -k ${BACKUP_FILE} 2>/dev/null

if [ $? -ne 0 ]; then
    log_error "Failed to extract backup file"
    exit 1
fi

SQL_FILE=$(echo ${BACKUP_FILE} | sed 's/\.gz$//')

if [ ! -f "${SQL_FILE}" ]; then
    log_error "Extracted SQL file not found: ${SQL_FILE}"
    exit 1
fi

log_success "Backup extracted"

# Check if database exists
log_info "Checking if database exists..."
DB_EXISTS=$(PGPASSWORD=postgres psql -h ${DB_HOST} -U ${DB_USER} -lqt 2>/dev/null | cut -d \| -f 1 | sed 's/^[[:space:]]*//' | grep -qw "${DB_NAME}" && echo "yes" || echo "no")

if [ "$DB_EXISTS" != "yes" ]; then
    log_warning "Database '${DB_NAME}' does not exist"
    log_info "Creating database..."
    PGPASSWORD=postgres createdb -h ${DB_HOST} -U ${DB_USER} ${DB_NAME} 2>/dev/null
    if [ $? -eq 0 ]; then
        log_success "Database created"
    else
        log_error "Failed to create database"
        rm -f ${SQL_FILE}
        exit 1
    fi
fi

# Restore database
log_info "Restoring database (this may take a while)..."
PGPASSWORD=postgres psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} < ${SQL_FILE} 2>&1 | grep -v "NOTICE:" | grep -v "WARNING:" | tail -10

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log_success "Restore completed successfully!"
else
    log_error "Restore failed!"
    rm -f ${SQL_FILE}
    exit 1
fi

# Verify restore
echo ""
log_info "Verifying restore..."
USER_COUNT=$(PGPASSWORD=postgres psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
SESSION_COUNT=$(PGPASSWORD=postgres psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM work_sessions;" 2>/dev/null | xargs)

if [ -n "$USER_COUNT" ] && [ -n "$SESSION_COUNT" ]; then
    log_success "Verification complete:"
    echo "   👥 Users: ${USER_COUNT}"
    echo "   📋 Work Sessions: ${SESSION_COUNT}"
else
    log_warning "Could not verify restore (database might be empty)"
fi

# Clean up extracted SQL file
rm -f ${SQL_FILE}
log_info "Cleaned up extracted SQL file"

echo ""
log_success "Done! Database restored to ${DB_NAME}"
echo ""

