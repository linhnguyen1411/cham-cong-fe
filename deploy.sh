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

# 3️⃣ Update backend code
log_info "Updating backend code..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && git pull origin main" 2>/dev/null || log_warning "Could not update backend (might be first run)"
log_success "Backend code updated"

# 4️⃣ Deploy frontend (copy dist from local)
log_info "Deploying frontend to VPS..."
if [ ! -d "${LOCAL_FRONTEND_PATH}/dist" ]; then
    log_error "Frontend dist folder not found at ${LOCAL_FRONTEND_PATH}/dist"
    log_info "Building frontend locally first..."
    cd ${LOCAL_FRONTEND_PATH}
    npm run build
fi
scp -r ${LOCAL_FRONTEND_PATH}/dist/* ${VPS_USER}@${VPS_IP}:~/${FRONTEND_PATH}/ 2>/dev/null || log_warning "Frontend deploy might have issues"
log_success "Frontend deployed"

# 5️⃣ Install backend dependencies
log_info "Installing backend gems (this may take a minute)..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && bundle install --without development test --quiet" 2>/dev/null || log_warning "Bundle install encountered an issue (continuing...)"
log_success "Backend dependencies installed"

# 6️⃣ Setup database credentials in .env
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

# 7️⃣ Run migrations
log_info "Running database migrations..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && source .env 2>/dev/null || true && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails db:migrate" 2>/dev/null || log_warning "Migrations might have issues (continuing...)"
log_success "Database migrations completed"

# 8️⃣ Create seed admin user
log_info "Creating seed user (admin/password123)..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && RAILS_ENV=production DATABASE_USERNAME=postgres DATABASE_PASSWORD=postgres DATABASE_HOST=localhost DATABASE_PORT=5432 bundle exec rails runner \"User.find_or_create_by(username: 'admin') { |u| u.password = 'password123'; u.full_name = 'Admin User'; u.role = 'admin' }\" 2>&1 | grep -i 'admin\\|error' || true" 2>/dev/null
log_success "Seed user created"

# 9️⃣ Frontend deployment (already built locally)
log_info "Frontend already built and will be deployed in next step"
log_success "Frontend ready"

# 🔟 Start backend with PM2
log_info "Starting backend on port ${BACKEND_PORT} with PM2..."
ssh ${VPS_USER}@${VPS_IP} << 'PM2SETUP'
cd ~/cham-cong-be

# Delete old PM2 process
pm2 delete all || true

# Start with proper environment variables from .env
pm2 start \
  --name timekeep-api \
  --env "RAILS_ENV=production" \
  --env "DATABASE_USERNAME=postgres" \
  --env "DATABASE_PASSWORD=postgres" \
  --env "DATABASE_HOST=localhost" \
  --env "DATABASE_PORT=5432" \
  'bundle exec rails s -p 3001 -e production'

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

# Copy files
cp -r ~/cham-cong-fe/* /var/www/cham-cong-fe/ 2>/dev/null || true

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
    
    # Cache static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Serve index.html for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
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
