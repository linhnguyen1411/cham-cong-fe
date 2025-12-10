# 🚀 TimeKeep Pro - VPS Deployment Guide

## 📋 Điều kiện tiên quyết

- VPS IP: `112.213.87.124`
- Root access via SSH
- Project backend: `/root/cham-cong-be` (hoặc `/home/timekeep-pro`)
- Project frontend: `/### 6️⃣ Setup Rails Master Key & PM2

**⚠️ Important for Rails 7.1+**: Rails uses encrypted credentials which require `RAILS_MASTER_KEY`

```bash
# Check if master.key exists
cat ~/cham-cong-be/config/master.key

# If not, create it:
cd ~/cham-cong-be
rails credentials:edit --environment production
# (Press Ctrl+X to exit editor, Rails will create master.key automatically)
```

**Setup PM2:**

```bash
npm install -g pm2

cd ~/cham-cong-be

# Delete any old processes
pm2 delete all || true

# Start with RAILS_MASTER_KEY
RAILS_ENV=production \
RAILS_MASTER_KEY=$(cat config/master.key) \
RAILS_SERVE_STATIC_FILES=true \
RAILS_LOG_TO_STDOUT=true \
pm2 start "bundle exec rails s -p 3001 -e production" --name "timekeep-api"

# Setup auto-start on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs timekeep-api
```cong-fe` (hoặc `/home/timekeep-pro`)
- Port backend: `3001`
- Port frontend: `5173`

---

## 🔧 Cách deploy

### Option 1: Deploy Script (Tự động - Khuyến khích)

#### 1️⃣ Tạo deploy script

```bash
# Trên local machine
cat > deploy.sh << 'EOF'
#!/bin/bash

set -e

echo "🚀 TimeKeep Pro - Deployment Script"
echo "===================================="

VPS_IP="112.213.87.124"
VPS_USER="root"
BACKEND_PATH="/root/cham-cong-be"
FRONTEND_PATH="/root/cham-cong-fe"
BACKEND_PORT="3001"

# 1️⃣ Kill existing processes
echo "🔄 Stopping existing processes..."
ssh ${VPS_USER}@${VPS_IP} "pkill -f 'rails s' || true; pkill -f puma || true; sleep 2"

# 2️⃣ Update backend code
echo "📝 Updating backend code..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && git pull origin main"

# 3️⃣ Update frontend code  
echo "📝 Updating frontend code..."
ssh ${VPS_USER}@${VPS_IP} "cd ${FRONTEND_PATH} && git pull origin main"

# 4️⃣ Install backend dependencies
echo "💎 Installing backend gems..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && bundle install --without development test"

# 5️⃣ Run migrations
echo "🗄️ Running database migrations..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && source .env 2>/dev/null || true && RAILS_ENV=production bundle exec rails db:migrate"

# 6️⃣ Install frontend dependencies
echo "📦 Installing frontend dependencies..."
ssh ${VPS_USER}@${VPS_IP} "cd ${FRONTEND_PATH} && npm install"

# 7️⃣ Build frontend
echo "🏗️ Building frontend..."
ssh ${VPS_USER}@${VPS_IP} "cd ${FRONTEND_PATH} && npm run build"

# 8️⃣ Start backend (PM2)
echo "🚀 Starting backend on port ${BACKEND_PORT}..."
ssh ${VPS_USER}@${VPS_IP} "cd ${BACKEND_PATH} && pm2 start 'bundle exec rails s -p ${BACKEND_PORT} -e production' --name 'timekeep-api' --force"

# 9️⃣ Reload Nginx
echo "🌐 Reloading Nginx..."
ssh ${VPS_USER}@${VPS_IP} "nginx -t && systemctl reload nginx"

# 🔟 Wait and test
echo "⏳ Waiting for application to start..."
sleep 5

# 1️⃣1️⃣ Test API
echo "🧪 Testing API..."
if curl -s http://${VPS_IP}:${BACKEND_PORT}/api/v1/users > /dev/null 2>&1; then
  echo "✅ Backend is running!"
else
  echo "⚠️ Backend might be slow to start, checking logs..."
  ssh ${VPS_USER}@${VPS_IP} "pm2 logs timekeep-api --lines 20"
fi

# 1️⃣2️⃣ Show status
echo ""
echo "✅ Deployment Complete!"
echo "===================================="
echo "📊 Backend API: http://${VPS_IP}:${BACKEND_PORT}"
echo "🌐 Frontend UI: http://${VPS_IP}:5173"
echo "📋 PM2 Status: pm2 status (run on VPS)"
echo "📜 Logs: pm2 logs timekeep-api"
echo ""
EOF

chmod +x deploy.sh
```

#### 2️⃣ Chạy deploy

```bash
./deploy.sh
```

---

### Option 2: Manual Deployment (Nếu script có vấn đề)

#### Step 1: SSH vào VPS

```bash
ssh root@112.213.87.124
```

#### Step 2: Update Backend

```bash
cd /root/cham-cong-be
git pull origin main
source .env 2>/dev/null || true
bundle install --without development test
RAILS_ENV=production rails db:migrate
```

#### Step 3: Update Frontend

```bash
cd /root/cham-cong-fe
git pull origin main
npm install
npm run build
```

#### Step 4: Restart Backend

```bash
# Kill old processes
pm2 delete all || true

# Start with RAILS_MASTER_KEY (important!)
RAILS_ENV=production \
RAILS_MASTER_KEY=$(cat config/master.key) \
RAILS_SERVE_STATIC_FILES=true \
RAILS_LOG_TO_STDOUT=true \
pm2 start "bundle exec rails s -p 3001 -e production" --name "timekeep-api"

# View logs
pm2 logs timekeep-api
```

#### Step 5: Reload Nginx

```bash
nginx -t
systemctl reload nginx
```

---

## 🔐 Initial Setup (Lần đầu tiên)

### 1️⃣ SSH vào VPS

```bash
ssh root@112.213.87.124
```

### 2️⃣ Clone Projects

```bash
# Backend
git clone https://github.com/linhnguyen1411/cham-cong-be.git /root/cham-cong-be
cd /root/cham-cong-be

# Frontend
git clone https://github.com/linhnguyen1411/cham-cong-fe.git /root/cham-cong-fe
```

### 3️⃣ Setup Environment

```bash
cd /root/cham-cong-be

# Tạo .env
cat > .env << 'ENV'
RAILS_ENV=production
SECRET_KEY_BASE=$(rails secret)
PORT=3001
DATABASE_URL=postgresql://...
RAILS_SERVE_STATIC_FILES=true
RAILS_LOG_TO_STDOUT=true
ENV

# Cài dependencies
gem install bundler
bundle install

# Setup database
rails db:create RAILS_ENV=production
rails db:migrate RAILS_ENV=production
rails db:seed RAILS_ENV=production
```

### 4️⃣ Setup Frontend

```bash
cd /root/cham-cong-fe

# Update API URL
# Sửa services/api.ts:
# export const BASE_URL = 'http://112.213.87.124:3001'

npm install
npm run build
```

### 5️⃣ Setup PM2 (Process Manager)

```bash
npm install -g pm2

cd /root/cham-cong-be
pm2 start "bundle exec rails s -p 3001 -e production" --name "timekeep-api"
pm2 startup
pm2 save
```

### 6️⃣ Setup Nginx

```bash
cat > /etc/nginx/sites-available/timekeep-pro << 'NGINX'
# Backend API (Port 3001)
server {
    listen 3001;
    server_name _;
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}

# Frontend (Port 5173)
server {
    listen 5173;
    server_name _;
    root /root/cham-cong-fe/dist;
    
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

# Enable site
ln -s /etc/nginx/sites-available/timekeep-pro /etc/nginx/sites-enabled/

# Test & start
nginx -t
systemctl restart nginx
```

---

## 📊 Monitoring & Logs

### PM2 Commands

```bash
# Xem status tất cả process
pm2 status

# Xem logs
pm2 logs timekeep-api

# Xem logs chi tiết
pm2 logs timekeep-api --lines 50

# Stop/start/restart
pm2 stop timekeep-api
pm2 start timekeep-api
pm2 restart timekeep-api
```

### Nginx Logs

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

### Rails Logs

```bash
cd /root/cham-cong-be
tail -f log/production.log
```

---

## 🧪 Testing

### Test Backend API

```bash
# Từ local machine
curl http://112.213.87.124:3001/api/v1/users

# Hoặc
curl -H "Authorization: Bearer TOKEN" \
  http://112.213.87.124:3001/api/v1/dashboard
```

### Test Frontend

```bash
# Mở browser
http://112.213.87.124:5173
```

### Test Nginx Config

```bash
ssh root@112.213.87.124
nginx -t
```

---

## 🔧 Troubleshooting

### Port 3001 đã được dùng

```bash
# Kill process đang dùng port
lsof -i :3001
kill -9 <PID>

# Hoặc
pkill -f "rails s"
```

### Database error

```bash
cd /root/cham-cong-be
source .env
RAILS_ENV=production rails db:reset
RAILS_ENV=production rails db:seed
```

### Nginx không reload

```bash
# Check syntax
nginx -t

# Force reload
systemctl force-reload nginx
```

### Frontend không load

```bash
# Rebuild
cd /root/cham-cong-fe
npm run build

# Check if dist folder exists
ls -la dist/
```

### PM2 không start

```bash
# Kiểm tra error
pm2 logs timekeep-api

# Kill tất cả
pm2 kill
pm2 delete all

# ⚠️ IMPORTANT: Rails 7.1+ requires RAILS_MASTER_KEY
# Start lại với master key
RAILS_ENV=production \
RAILS_MASTER_KEY=$(cat config/master.key) \
RAILS_SERVE_STATIC_FILES=true \
RAILS_LOG_TO_STDOUT=true \
pm2 start "bundle exec rails s -p 3001 -e production" --name "timekeep-api"
```

---

## 📈 Performance Tips

### 1. Enable Gzip Compression

```nginx
gzip on;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
```

### 2. Add Cache Headers

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000";
}
```

### 3. Monitor CPU/Memory

```bash
# Real-time monitoring
top

# PM2 monitoring
pm2 monit

# Check disk space
df -h
```

---

## 🚀 Quick Reference

```bash
# SSH vào VPS
ssh root@112.213.87.124

# Deploy (from local)
./deploy.sh

# Restart backend
ssh root@112.213.87.124 "pm2 restart timekeep-api"

# View logs
ssh root@112.213.87.124 "pm2 logs timekeep-api"

# Check status
ssh root@112.213.87.124 "pm2 status"

# Rebuild frontend
ssh root@112.213.87.124 "cd /root/cham-cong-fe && npm run build && systemctl reload nginx"
```

---

## ✅ Checklist

- [ ] VPS access (SSH)
- [ ] Git repositories cloned
- [ ] Environment variables set (.env)
- [ ] Database setup (create, migrate, seed)
- [ ] Backend running (PM2)
- [ ] Frontend built
- [ ] Nginx configured
- [ ] Backend API responds (curl test)
- [ ] Frontend loads (browser test)
- [ ] PM2 startup configured
- [ ] Logs monitored

---

## 📞 Support

Nếu có lỗi, check:
1. `pm2 logs timekeep-api`
2. `tail -f /var/log/nginx/error.log`
3. `cd /root/cham-cong-be && RAILS_ENV=production rails console`

