#!/bin/bash

# Restore Database to Production VPS
# Usage: ./restore-production.sh <backup_file.sql.gz>

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKUP_FILE=$1
LOCAL_BACKUP_DIR="/Users/linhnguyen21/workspace/cham-cong/backups"
VPS_IP="112.213.87.124"
VPS_USER="root"
DB_NAME="workspace_production"
DB_USER="postgres"
DB_PASSWORD="postgres"

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
echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠️  WARNING: RESTORE TO PRODUCTION DATABASE ⚠️       ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
log_warning "This will OVERWRITE the production database!"
log_warning "All current production data will be LOST!"
echo ""
read -p "Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
    log_error "Restore cancelled"
    exit 1
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    🔄 Restore Database to Production VPS        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

log_info "Backup file: ${BACKUP_FILE}"
log_info "Target: ${VPS_IP}"
log_info "Database: ${DB_NAME}"

# Check VPS connectivity
log_info "Checking VPS connectivity..."
if ! ssh -q ${VPS_USER}@${VPS_IP} "echo 'Connected'" >/dev/null 2>&1; then
    log_error "Cannot connect to VPS at ${VPS_IP}"
    exit 1
fi
log_success "VPS is reachable"

# Upload backup
log_info "Uploading backup to VPS..."
scp ${LOCAL_BACKUP_DIR}/${BACKUP_FILE} ${VPS_USER}@${VPS_IP}:/tmp/ 2>/dev/null

if [ $? -ne 0 ]; then
    log_error "Failed to upload backup"
    exit 1
fi
log_success "Backup uploaded"

# Stop Rails app
log_info "Stopping Rails application..."
ssh ${VPS_USER}@${VPS_IP} "pm2 stop timekeep-api" 2>/dev/null
log_success "Rails app stopped"

# Extract backup on VPS
log_info "Extracting backup on VPS..."
SQL_FILE=$(echo ${BACKUP_FILE} | sed 's/\.gz$//')
ssh ${VPS_USER}@${VPS_IP} "cd /tmp && gunzip ${BACKUP_FILE}" 2>/dev/null

if [ $? -ne 0 ]; then
    log_error "Failed to extract backup on VPS"
    ssh ${VPS_USER}@${VPS_IP} "pm2 start timekeep-api"
    exit 1
fi
log_success "Backup extracted"

# Restore database
log_info "Restoring database (this may take a while)..."
ssh ${VPS_USER}@${VPS_IP} << EOF
export PGPASSWORD=${DB_PASSWORD}
psql -h localhost -U ${DB_USER} -d ${DB_NAME} < /tmp/${SQL_FILE} 2>&1 | grep -v "NOTICE:" | grep -v "WARNING:" | tail -10
EOF

if [ $? -eq 0 ]; then
    log_success "Restore completed successfully!"
else
    log_error "Restore failed!"
    ssh ${VPS_USER}@${VPS_IP} "pm2 start timekeep-api"
    ssh ${VPS_USER}@${VPS_IP} "rm -f /tmp/${SQL_FILE}"
    exit 1
fi

# Start Rails app
log_info "Starting Rails application..."
ssh ${VPS_USER}@${VPS_IP} "pm2 start timekeep-api && sleep 2 && pm2 status" 2>/dev/null
log_success "Rails app started"

# Verify restore
echo ""
log_info "Verifying restore..."
VERIFY_RESULT=$(ssh ${VPS_USER}@${VPS_IP} << EOF
export PGPASSWORD=${DB_PASSWORD}
psql -h localhost -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs
EOF
)

if [ -n "$VERIFY_RESULT" ]; then
    log_success "Verification complete:"
    echo "   👥 Users: ${VERIFY_RESULT}"
else
    log_warning "Could not verify restore"
fi

# Clean up
log_info "Cleaning up..."
ssh ${VPS_USER}@${VPS_IP} "rm -f /tmp/${SQL_FILE}" 2>/dev/null
log_success "Cleanup complete"

echo ""
log_success "Done! Production database restored"
echo ""
log_info "Check application: http://${VPS_IP}:5173"
echo ""

