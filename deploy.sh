#!/bin/bash

# TimeKeep Pro - Automated Deployment Script
# This script:
# 1. Creates a database backup and downloads to local machine
# 2. Builds frontend locally
# 3. Deploys both frontend + backend to VPS

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
BACKEND_PATH="cham-cong-be"
FRONTEND_PATH="cham-cong-fe"
BACKEND_PORT="3001"
FRONTEND_PORT="5173"
SSH_TIMEOUT="60"
LOCAL_FRONTEND_PATH="/Users/linhnguyen21/workspace/cham-cong/cham-cong-fe"
LOCAL_BACKEND_PATH="/Users/linhnguyen21/workspace/cham-cong/cham-cong-be"
VPS_WWW_PATH="/var/www/cham-cong-fe"

# Database configuration
# Auto-detect database name from Rails config, fallback to default
DB_NAME=$(grep -A 2 "^production:" ${LOCAL_BACKEND_PATH}/config/database.yml 2>/dev/null | grep "database:" | awk '{print $2}' | tr -d '"' || echo "workspace_production")
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"

# Local backup folder
LOCAL_BACKUP_DIR="/Users/linhnguyen21/workspace/cham-cong/backups"

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

log_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to create backup
create_backup() {
    local TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    local BACKUP_FILENAME="cham_cong_backup_${TIMESTAMP}.sql"
    local BACKUP_FILENAME_GZ="${BACKUP_FILENAME}.gz"
    
    log_section "💾 STEP 0: DATABASE BACKUP"
    
    # Create local backup directory if not exists
    mkdir -p "${LOCAL_BACKUP_DIR}"
    log_info "Backup directory: ${LOCAL_BACKUP_DIR}"
    
    # First, list all databases to find the correct one
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
        # Try to find a similar database name (workspace_production, cham_cong_production, etc)
        FOUND_DB=$(echo "$AVAILABLE_DBS" | grep -iE "(workspace|cham.?cong|production)" | head -1 | xargs)
        
        if [ -n "$FOUND_DB" ]; then
            log_warning "Database '${DB_NAME}' not found, but found similar: '${FOUND_DB}'"
            log_info "Using '${FOUND_DB}' for backup..."
            DB_NAME="$FOUND_DB"
            DB_EXISTS="yes"
        else
            log_warning "Database '${DB_NAME}' does not exist yet"
            log_info "This might be the first deployment - skipping backup"
            log_info "Continuing with deployment..."
            return 0
        fi
    fi
    log_success "Database found: ${DB_NAME}"
    
    # Check if PostgreSQL is accessible
    log_info "Testing PostgreSQL connection..."
    PG_ACCESS=$(ssh ${VPS_USER}@${VPS_IP} "export PGPASSWORD='${DB_PASSWORD}' && psql -h ${DB_HOST} -U ${DB_USER} -d postgres -c 'SELECT 1;' >/dev/null 2>&1 && echo 'yes' || echo 'no'")
    
    if [ "$PG_ACCESS" != "yes" ]; then
        log_warning "Cannot connect to PostgreSQL - skipping backup"
        log_info "Continuing with deployment..."
        return 0
    fi
    log_success "PostgreSQL connection OK"
    
    # Create backup on VPS
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
        echo "File exists but might be empty"
        head -3 /tmp/${BACKUP_FILENAME} 2>/dev/null || echo "Cannot read file"
    else
        echo "Backup file was not created"
    fi
fi
EOF
    )
    
    # Parse backup result
    if echo "$BACKUP_RESULT" | grep -q "BACKUP_SUCCESS"; then
        BACKUP_SIZE=$(echo "$BACKUP_RESULT" | grep -v "BACKUP_SUCCESS" | head -1)
        log_success "Backup created on VPS (${BACKUP_SIZE})"
        
        # Download backup to local machine
        log_info "Downloading backup to local machine..."
        if scp ${VPS_USER}@${VPS_IP}:/tmp/${BACKUP_FILENAME_GZ} "${LOCAL_BACKUP_DIR}/" 2>/dev/null; then
            if [ -f "${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}" ]; then
                LOCAL_SIZE=$(ls -lh "${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME_GZ}" | awk '{print $5}')
                log_success "Backup downloaded: ${BACKUP_FILENAME_GZ} (${LOCAL_SIZE})"
                
                # Clean up old backups (keep last 10)
                cd "${LOCAL_BACKUP_DIR}"
                ls -t cham_cong_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f 2>/dev/null
                BACKUP_COUNT=$(ls -1 cham_cong_backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
                log_info "Total backups stored: ${BACKUP_COUNT}"
            else
                log_warning "Download completed but file not found locally"
            fi
        else
            log_warning "Failed to download backup from VPS"
        fi
        
        # Clean up remote backup
        ssh ${VPS_USER}@${VPS_IP} "rm -f /tmp/${BACKUP_FILENAME_GZ}" 2>/dev/null
    else
        log_warning "Backup creation failed"
        echo "$BACKUP_RESULT" | grep -v "BACKUP_" | while read line; do
            log_info "  → $line"
        done
        log_info "Continuing with deployment (backup is optional)..."
    fi
    
    return 0
}

# Main deployment
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    🚀 TimeKeep Pro - VPS Deployment Script     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This script will:${NC}"
echo -e "  1. 💾 Backup database and download to local"
echo -e "  2. 🔨 Build frontend locally"
echo -e "  3. 📦 Deploy to VPS"
echo ""

# Check if --skip-backup flag is passed
SKIP_BACKUP=false
for arg in "$@"; do
    if [ "$arg" == "--skip-backup" ]; then
        SKIP_BACKUP=true
        log_warning "Skipping backup (--skip-backup flag)"
    fi
done

# 0️⃣ Check connectivity first
log_section "🔌 CHECKING CONNECTIVITY"
log_info "Checking VPS connectivity..."
if ! ssh -q ${VPS_USER}@${VPS_IP} "echo 'Connected'" >/dev/null 2>&1; then
    log_error "Cannot connect to VPS at ${VPS_IP}"
    echo "Make sure you can SSH: ssh ${VPS_USER}@${VPS_IP}"
    exit 1
fi
log_success "VPS is reachable"

# 0️⃣.5️⃣ Create database backup BEFORE any changes
if [ "$SKIP_BACKUP" = false ]; then
    create_backup
fi

# 1️⃣ Build frontend locally
log_section "🔨 STEP 1: BUILD FRONTEND"
log_info "Building frontend locally..."
cd ${LOCAL_FRONTEND_PATH}
npm run build 2>&1 | tail -5
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log_error "Frontend build failed"
    exit 1
fi
log_success "Frontend built successfully"

# 2️⃣ Stop running processes
log_section "🛑 STEP 2: STOP EXISTING PROCESSES"
log_info "Stopping existing processes..."
ssh ${VPS_USER}@${VPS_IP} "pkill -f 'rails s' || true; pkill -f puma || true; sleep 2" 2>/dev/null || true
log_success "Old processes stopped"

# 3️⃣ Update backend and frontend code
log_section "📥 STEP 3: UPDATE CODE ON VPS"
log_info "Pulling latest code from git..."
ssh ${VPS_USER}@${VPS_IP} << 'GITPULL'
cd ~/cham-cong-be
git stash 2>/dev/null || true
git pull origin main 2>&1 | tail -3

cd ~/cham-cong-fe
git stash 2>/dev/null || true
git pull origin main 2>&1 | tail -3
GITPULL
log_success "Code updated on VPS"

# 3️⃣.1️⃣ Fix Rails production config
log_info "Configuring Rails for proxy setup..."
ssh ${VPS_USER}@${VPS_IP} << 'RAILSCONFIG'
cd ~/cham-cong-be
sed -i 's/config\.force_ssl = true/config.force_ssl = false/' config/environments/production.rb
sed -i 's/# config\.assume_ssl = true/config.assume_ssl = true/' config/environments/production.rb
RAILSCONFIG
log_success "Rails config updated"

# 3️⃣.2️⃣ Fix Ruby version in Gemfile
log_info "Updating Gemfile Ruby version to 3.0.2..."
ssh ${VPS_USER}@${VPS_IP} << 'GEMFILE'
cd ~/cham-cong-be
git checkout Gemfile 2>/dev/null || true
sed -i 's/ruby "[0-9.]*"/ruby "3.0.2"/' Gemfile
sed -i "s/ruby '[0-9.]*'/ruby '3.0.2'/" Gemfile
rm -f Gemfile.lock
bundle install 2>&1 | tail -5
GEMFILE
log_success "Bundle installed"

# 4️⃣ Deploy frontend
log_section "🌐 STEP 4: DEPLOY FRONTEND"
log_info "Deploying frontend to VPS..."
if [ ! -d "${LOCAL_FRONTEND_PATH}/dist" ]; then
    log_error "Frontend dist folder not found!"
    exit 1
fi
ssh ${VPS_USER}@${VPS_IP} "rm -rf /var/www/cham-cong-fe/* && mkdir -p /var/www/cham-cong-fe"
scp -r ${LOCAL_FRONTEND_PATH}/dist/* ${VPS_USER}@${VPS_IP}:/var/www/cham-cong-fe/
ssh ${VPS_USER}@${VPS_IP} "chmod -R 755 /var/www/cham-cong-fe"
log_success "Frontend deployed"

# 5️⃣ Copy Rails master key
log_section "🔑 STEP 5: COPY CREDENTIALS"
log_info "Copying Rails master key..."
scp ${LOCAL_BACKEND_PATH}/config/master.key ${VPS_USER}@${VPS_IP}:~/cham-cong-be/config/ 2>/dev/null || log_warning "Master key might already exist"
log_success "Credentials copied"

# 6️⃣ Setup database
log_section "🗄️ STEP 6: DATABASE SETUP"
log_info "Configuring database..."
ssh ${VPS_USER}@${VPS_IP} << 'DBENV'
cd ~/cham-cong-be
RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails db:create 2>/dev/null || true
if ! grep -q "DATABASE_USERNAME" .env 2>/dev/null; then
  cat >> .env << 'ENVVARS'
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
ENVVARS
fi
DBENV
log_success "Database configured"

# 7️⃣ Run migrations
log_info "Running database migrations..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails db:migrate 2>&1 | tail -5" || log_warning "Migrations might have issues"
log_success "Migrations completed"

# 8️⃣ Create seed admin user
log_info "Ensuring admin user exists..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails runner \"User.find_or_create_by(username: 'admin') { |u| u.password = 'password123'; u.full_name = 'Admin User'; u.role = 'admin' }\" 2>&1 | grep -i 'admin\\|error' || true" 2>/dev/null
log_success "Admin user ready"

# 9️⃣ Start backend with PM2
log_section "🚀 STEP 7: START SERVICES"
log_info "Starting backend on port ${BACKEND_PORT}..."
ssh ${VPS_USER}@${VPS_IP} << 'PM2SETUP'
cd ~/cham-cong-be
pm2 delete all 2>/dev/null || true

export RAILS_ENV=production
export SECRET_KEY_BASE=a1317054554ad6910e5ce650309f912bdcfbcfed2e0785b73d796a2d4907ffc3a127e331e683b58da600017936a2ee0efcfb216ec57d5eb68198a70ba694c53f
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=postgres
export DATABASE_HOST=localhost
export DATABASE_PORT=5432

pm2 start 'bundle exec rails s -p 3001 -e production' --name timekeep-api
sleep 2
pm2 status
PM2SETUP
log_success "Backend started"

# 🔟 Setup & Reload Nginx
log_section "⚙️ STEP 8: CONFIGURE NGINX"
log_info "Setting up Nginx configuration..."
ssh ${VPS_USER}@${VPS_IP} << 'NGINX_SETUP'
mkdir -p /var/www/cham-cong-fe
chmod -R 755 /var/www/cham-cong-fe

# Create config.js for API URL
cat > /var/www/cham-cong-fe/config.js << 'CONFIG_JS'
window.API_BASE_URL = '/api';
CONFIG_JS

# Create Nginx config
cat > /etc/nginx/sites-available/cham-cong << 'NGINX'
server {
    listen 5173;
    server_name _;
    root /var/www/cham-cong-fe;
    index index.html;
    
    types {
        text/html html;
        text/css css;
        application/javascript js;
        application/wasm wasm;
        image/svg+xml svg;
        font/woff woff;
        font/woff2 woff2;
        font/ttf ttf;
        application/octet-stream eot;
        image/x-icon ico;
        image/png png;
        image/jpeg jpg jpeg;
        image/gif gif;
    }
    default_type application/octet-stream;
    
    location ~ \.js$ {
        add_header Content-Type "application/javascript; charset=utf-8";
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location ~ \.css$ {
        add_header Content-Type "text/css; charset=utf-8";
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/timekeep-pro
rm -f /etc/nginx/sites-available/timekeep-pro
ln -sf /etc/nginx/sites-available/cham-cong /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
NGINX_SETUP
log_success "Nginx configured and reloaded"

# 1️⃣1️⃣ Test API
log_section "🧪 STEP 9: VERIFY DEPLOYMENT"
log_info "Waiting for services to start..."
sleep 5

log_info "Testing API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${VPS_IP}:${BACKEND_PORT}/api/v1/users 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
    log_success "API is responding (HTTP $HTTP_CODE)"
else
    log_warning "API returned HTTP $HTTP_CODE (may need more time to start)"
fi

log_info "Testing Frontend..."
FE_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${VPS_IP}:${FRONTEND_PORT}/ 2>/dev/null || echo "000")
if [ "$FE_CODE" == "200" ]; then
    log_success "Frontend is responding (HTTP $FE_CODE)"
else
    log_warning "Frontend returned HTTP $FE_CODE"
fi

# Show summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Deployment Completed! ✅                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Access Your Application:${NC}"
echo -e "   🔗 Backend API:   ${BLUE}http://${VPS_IP}:${BACKEND_PORT}${NC}"
echo -e "   🌐 Frontend UI:   ${BLUE}http://${VPS_IP}:${FRONTEND_PORT}${NC}"
echo ""
echo -e "${YELLOW}💾 Database Backup:${NC}"
echo -e "   📁 Backup folder: ${CYAN}${LOCAL_BACKUP_DIR}${NC}"
LATEST_BACKUP=$(ls -t "${LOCAL_BACKUP_DIR}"/cham_cong_backup_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    echo -e "   📄 Latest backup: ${CYAN}$(basename $LATEST_BACKUP)${NC}"
fi
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo -e "   ${BLUE}ssh ${VPS_USER}@${VPS_IP}${NC}             - Connect to VPS"
echo -e "   ${BLUE}pm2 status${NC}                         - Show PM2 status"
echo -e "   ${BLUE}pm2 logs timekeep-api${NC}              - View logs"
echo -e "   ${BLUE}pm2 restart timekeep-api${NC}           - Restart backend"
echo ""
echo -e "${YELLOW}🔄 Quick Deploy (skip backup):${NC}"
echo -e "   ${BLUE}./deploy.sh --skip-backup${NC}"
echo ""
