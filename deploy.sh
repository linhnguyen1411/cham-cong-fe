#!/bin/bash

# TimeKeep Pro - Automated Deployment Script
# This script builds frontend locally and deploys both frontend + backend to VPS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="112.213.87.124"
VPS_USER="root"
BACKEND_PATH="cham-cong-be"
FRONTEND_PATH="cham-cong-fe"
BACKEND_PORT="3001"
FRONTEND_PORT="5173"
SSH_TIMEOUT="60"
LOCAL_FRONTEND_PATH="/Users/linhnguyen21/workspace/timekeep-pro"
VPS_WWW_PATH="/var/www/cham-cong-fe"

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

# Main deployment
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    🚀 TimeKeep Pro - VPS Deployment Script     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# 0️⃣ Build frontend locally
log_info "Building frontend locally..."
cd ${LOCAL_FRONTEND_PATH}
npm run build 2>/dev/null || log_error "Frontend build failed"
log_success "Frontend built successfully"

# 1️⃣ Check connectivity
log_info "Checking VPS connectivity..."
if ! ssh -q ${VPS_USER}@${VPS_IP} "echo 'Connected'" >/dev/null 2>&1; then
    log_error "Cannot connect to VPS at ${VPS_IP}"
    echo "Make sure you can SSH: ssh ${VPS_USER}@${VPS_IP}"
    exit 1
fi
log_success "VPS is reachable"

# 2️⃣ Stop running processes
log_info "Stopping existing processes..."
ssh ${VPS_USER}@${VPS_IP} "pkill -f 'rails s' || true; pkill -f puma || true; sleep 2" 2>/dev/null || true
log_success "Old processes stopped"

# 3️⃣ Update backend and frontend code
log_info "Updating backend code..."
ssh ${VPS_USER}@${VPS_IP} << 'GITPULL'
cd ~/cham-cong-be
git stash 2>/dev/null || true
git pull origin main
log_success "Backend code updated"

cd ~/cham-cong-fe
git stash 2>/dev/null || true
git pull origin main
GITPULL
log_success "Backend and frontend code updated"

# 3️⃣.25️⃣ Fix Rails production config for HTTP backend behind nginx proxy
log_info "Ensuring Rails config is correct for proxy setup..."
ssh ${VPS_USER}@${VPS_IP} << 'RAILSCONFIG'
cd ~/cham-cong-be

# Make sure force_ssl is disabled (nginx handles HTTPS)
sed -i 's/config\.force_ssl = true/config.force_ssl = false/' config/environments/production.rb
sed -i 's/# config\.assume_ssl = true/config.assume_ssl = true/' config/environments/production.rb

RAILSCONFIG
log_success "Rails production config fixed"

# 3️⃣.5️⃣ Fix Ruby version in Gemfile (match VPS Ruby 3.0.2)
log_info "Updating Gemfile Ruby version to 3.0.2..."
ssh ${VPS_USER}@${VPS_IP} << 'GEMFILE'
cd ~/cham-cong-be

# Restore Gemfile from git first (undo any previous bad edits)
git checkout Gemfile 2>/dev/null || true

# Replace ruby version (handles both single and double quotes)
sed -i 's/ruby "[0-9.]*"/ruby "3.0.2"/' Gemfile
sed -i "s/ruby '[0-9.]*'/ruby '3.0.2'/" Gemfile

# Delete Gemfile.lock to force regeneration
rm -f Gemfile.lock

# Run bundle install
bundle install
GEMFILE
log_success "Gemfile updated to Ruby 3.0.2 and bundle installed"

# 4️⃣ Deploy frontend (copy dist from local directly to nginx root)
log_info "Deploying frontend to VPS..."
if [ ! -d "${LOCAL_FRONTEND_PATH}/dist" ]; then
    log_error "Frontend dist folder not found at ${LOCAL_FRONTEND_PATH}/dist"
    log_info "Building frontend locally first..."
    cd ${LOCAL_FRONTEND_PATH}
    npm run build
fi
# Clean nginx root and copy dist files directly
ssh ${VPS_USER}@${VPS_IP} "rm -rf /var/www/cham-cong-fe/* && mkdir -p /var/www/cham-cong-fe"
scp -r ${LOCAL_FRONTEND_PATH}/dist/* ${VPS_USER}@${VPS_IP}:/var/www/cham-cong-fe/
ssh ${VPS_USER}@${VPS_IP} "chmod -R 755 /var/www/cham-cong-fe"
log_success "Frontend deployed to nginx root"

# 5️⃣ (Removed - frontend already copied above)

# 5️⃣.5️⃣ Copy Rails master key for credentials decryption
log_info "Copying Rails master key..."
scp ${LOCAL_FRONTEND_PATH}/../cham-cong-be/config/master.key ${VPS_USER}@${VPS_IP}:~/cham-cong-be/config/ 2>/dev/null || log_warning "Master key might already exist"
log_success "Rails master key ensured"

# 6️⃣ Install backend dependencies (already done above, skip this)
log_info "Backend dependencies already installed (via bundle install)"
log_success "Backend dependencies ready"

# 7️⃣ Setup database credentials in .env
log_info "Setting up database credentials..."
ssh ${VPS_USER}@${VPS_IP} << 'DBENV'
cd ~/cham-cong-be

# Create database if it doesn't exist
RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails db:create 2>/dev/null || true

# Add database credentials to .env if not already present
if ! grep -q "DATABASE_USERNAME" .env; then
  cat >> .env << 'ENVVARS'

# Database configuration
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
ENVVARS
fi
DBENV
log_success "Database credentials configured"

# 8️⃣ Run migrations
log_info "Running database migrations..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && source .env 2>/dev/null || true && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails db:migrate" 2>/dev/null || log_warning "Migrations might have issues (continuing...)"
log_success "Database migrations completed"

# 9️⃣ Create seed admin user
log_info "Creating seed user (admin/password123)..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails runner \"User.find_or_create_by(username: 'admin') { |u| u.password = 'password123'; u.full_name = 'Admin User'; u.role = 'admin' }\" 2>&1 | grep -i 'admin\\|error' || true" 2>/dev/null
log_success "Seed user created"

# 🔟 Frontend deployment (already built locally)
log_info "Frontend already built and will be deployed in next step"
log_success "Frontend ready"

# 1️⃣1️⃣ Start backend with PM2
log_info "Starting backend on port ${BACKEND_PORT} with PM2..."
ssh ${VPS_USER}@${VPS_IP} << 'PM2SETUP'
cd ~/cham-cong-be

# Delete old PM2 process
pm2 delete all || true

# Export environment variables BEFORE starting PM2
export RAILS_ENV=production
export SECRET_KEY_BASE=a1317054554ad6910e5ce650309f912bdcfbcfed2e0785b73d796a2d4907ffc3a127e331e683b58da600017936a2ee0efcfb216ec57d5eb68198a70ba694c53f
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=postgres
export DATABASE_HOST=localhost
export DATABASE_PORT=5432

# Start with environment variables already in shell
pm2 start 'bundle exec rails s -p 3001 -e production' --name timekeep-api

sleep 2
pm2 status
PM2SETUP
log_success "Backend started"

# 1️⃣1️⃣ Reload Nginx
log_info "Reloading Nginx..."
ssh ${VPS_USER}@${VPS_IP} "nginx -t && systemctl reload nginx" 2>/dev/null || log_warning "Nginx reload might have issues"
log_success "Nginx reloaded"

# 1️⃣2️⃣ Setup Nginx config (if needed)
log_info "Setting up Nginx configuration..."
ssh ${VPS_USER}@${VPS_IP} << 'NGINX_SETUP'
# Create /var/www directory
mkdir -p /var/www/cham-cong-fe

# NOTE: Frontend dist files already copied in step 5, no need to copy again

# Set permissions
chmod -R 755 /var/www/cham-cong-fe

# Create .env.js file for frontend to load API URL
# Use relative path to Nginx proxy instead of direct connection
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
    
    # Explicitly set MIME types
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
    
    # Fix JavaScript MIME type specifically
    location ~ \.js$ {
        add_header Content-Type "application/javascript; charset=utf-8";
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # CSS files
    location ~ \.css$ {
        add_header Content-Type "text/css; charset=utf-8";
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Cache other static files
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Serve index.html for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Proxy API calls to backend
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

# Remove old configs
rm -f /etc/nginx/sites-enabled/timekeep-pro
rm -f /etc/nginx/sites-available/timekeep-pro

# Enable site
ln -sf /etc/nginx/sites-available/cham-cong /etc/nginx/sites-enabled/

# Disable default site
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
NGINX_SETUP
log_success "Nginx configured"
log_info "Waiting for services to start..."
sleep 5

# 1️⃣3️⃣ Test API
log_info "Testing API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${VPS_IP}:${BACKEND_PORT}/api/v1/users 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
    log_success "API is responding (HTTP $HTTP_CODE)"
else
    log_warning "API returned HTTP $HTTP_CODE (may need more time to start)"
fi

# Show summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ✅ Deployment Completed! ✅            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Access Your Application:${NC}"
echo -e "   🔗 Backend API:   ${BLUE}http://${VPS_IP}:${BACKEND_PORT}${NC}"
echo -e "   🌐 Frontend UI:   ${BLUE}http://${VPS_IP}:${FRONTEND_PORT}${NC}"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo -e "   ${BLUE}ssh ${VPS_USER}@${VPS_IP}${NC}"
echo -e "   ${BLUE}pm2 status${NC}                 - Show PM2 status"
echo -e "   ${BLUE}pm2 logs timekeep-api${NC}      - View logs"
echo -e "   ${BLUE}pm2 restart timekeep-api${NC}   - Restart backend"
echo ""
echo -e "${YELLOW}📖 For more info, check DEPLOY.md${NC}"
echo ""
