# Lucky Map - VPS Deployment Guide

Complete guide to deploy the Lucky Map application to a VPS server.

## Prerequisites

- A VPS with Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Domain name (optional but recommended)
- At least 1GB RAM and 10GB storage

## Step 1: Initial VPS Setup

### 1.1 Connect to your VPS

```bash
ssh root@your-vps-ip
```

### 1.2 Update system packages

```bash
apt update && apt upgrade -y
```

### 1.3 Create a non-root user (recommended)

```bash
adduser luckymap
usermod -aG sudo luckymap
su - luckymap
```

## Step 2: Install Required Software

### 2.1 Install Node.js (v18.x LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### 2.2 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.3 Install Nginx (Web Server)

```bash
sudo apt install -y nginx
```

### 2.4 Install Git

```bash
sudo apt install -y git
```

## Step 3: Deploy Application

### 3.1 Clone or upload your project

**Option A: Using Git** (if your code is in a repository)
```bash
cd /home/luckymap
git clone https://github.com/yourusername/luckymap.git
cd luckymap
```

**Option B: Upload files manually using SCP**
From your local machine:
```bash
# Create a tarball of your project
cd /Users/tony/Documents/Vcyber
tar -czf luckymap.tar.gz luckymap/

# Upload to VPS
scp luckymap.tar.gz luckymap@your-vps-ip:/home/luckymap/

# On VPS, extract the files
ssh luckymap@your-vps-ip
cd /home/luckymap
tar -xzf luckymap.tar.gz
cd luckymap
```

**Option C: Using rsync** (recommended for updates)
From your local machine:
```bash
rsync -avz --exclude 'node_modules' \
  /Users/tony/Documents/Vcyber/luckymap/ \
  luckymap@your-vps-ip:/home/luckymap/luckymap/
```

### 3.2 Install dependencies

```bash
cd /home/luckymap/luckymap
npm install --production
```

### 3.3 Test the application

```bash
node server.js
```

Visit `http://your-vps-ip:3000` to verify it works. Press `Ctrl+C` to stop.

## Step 4: Configure PM2 for Production

### 4.1 Create PM2 ecosystem file

Create a file named `ecosystem.config.js`:

```bash
nano ecosystem.config.js
```

Add the following content:

```javascript
module.exports = {
  apps: [{
    name: 'luckymap',
    script: './server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 4.2 Create logs directory

```bash
mkdir -p logs
```

### 4.3 Start application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Follow the command output to enable PM2 on system boot.

### 4.4 Verify PM2 status

```bash
pm2 status
pm2 logs luckymap
```

## Step 5: Configure Nginx as Reverse Proxy

### 5.1 Create Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/luckymap
```

**For IP-based access:**

```nginx
server {
    listen 80;
    server_name your-vps-ip;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**For domain-based access:**

```nginx
server {
    listen 80;
    server_name luckymap.yourdomain.com www.luckymap.yourdomain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/luckymap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5.3 Configure firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## Step 6: Setup SSL Certificate (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL certificate

Make sure your domain DNS is pointing to your VPS IP, then:

```bash
sudo certbot --nginx -d luckymap.yourdomain.com -d www.luckymap.yourdomain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

### 6.3 Verify auto-renewal

```bash
sudo certbot renew --dry-run
```

## Step 7: Monitoring and Maintenance

### 7.1 View application logs

```bash
pm2 logs luckymap
pm2 logs luckymap --lines 100
```

### 7.2 Monitor performance

```bash
pm2 monit
```

### 7.3 Restart application

```bash
pm2 restart luckymap
```

### 7.4 Update application

When you have new code:

```bash
# Upload new files (using rsync or scp)
# Then:
cd /home/luckymap/luckymap
npm install --production
pm2 restart luckymap
```

### 7.5 Check Nginx logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Step 8: Performance Optimization (Optional)

### 8.1 Update server.js to use environment PORT

Modify `server.js` line 502:

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 8.2 Enable Nginx caching for static assets

Add to your Nginx config inside the `server` block:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    proxy_pass http://localhost:3000;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 8.3 Enable Gzip compression in Nginx

```bash
sudo nano /etc/nginx/nginx.conf
```

Ensure these lines are uncommented in the `http` block:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

## Troubleshooting

### Application not starting

```bash
pm2 logs luckymap --err
cd /home/luckymap/luckymap
node server.js  # Test directly
```

### Port 3000 already in use

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
pm2 restart luckymap
```

### Nginx 502 Bad Gateway

Check if app is running:
```bash
pm2 status
curl http://localhost:3000
```

Check Nginx config:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Permission issues

```bash
sudo chown -R luckymap:luckymap /home/luckymap/luckymap
chmod -R 755 /home/luckymap/luckymap
```

## Security Best Practices

1. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Configure firewall properly:**
   ```bash
   sudo ufw status
   ```

3. **Change SSH port** (optional):
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Change Port 22 to something else
   sudo systemctl restart sshd
   ```

4. **Disable root login:**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   sudo systemctl restart sshd
   ```

5. **Setup fail2ban:**
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

## Quick Reference Commands

```bash
# Start app
pm2 start ecosystem.config.js

# Stop app
pm2 stop luckymap

# Restart app
pm2 restart luckymap

# View logs
pm2 logs luckymap

# Monitor
pm2 monit

# Restart Nginx
sudo systemctl restart nginx

# Test Nginx config
sudo nginx -t

# View Nginx status
sudo systemctl status nginx
```

## Backup Strategy

### Backup your application

```bash
# Create backup script
nano /home/luckymap/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/luckymap/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/luckymap_$DATE.tar.gz /home/luckymap/luckymap
# Keep only last 7 backups
ls -t $BACKUP_DIR/luckymap_*.tar.gz | tail -n +8 | xargs rm -f
```

Make executable:
```bash
chmod +x /home/luckymap/backup.sh
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
# Add: 0 2 * * * /home/luckymap/backup.sh
```

## Summary

Your Lucky Map application should now be:
- ✅ Running on VPS with PM2
- ✅ Accessible via Nginx reverse proxy
- ✅ Auto-starting on system reboot
- ✅ Protected by SSL (if configured)
- ✅ Production-ready and monitored

Access your application at:
- HTTP: `http://your-vps-ip` or `http://luckymap.yourdomain.com`
- HTTPS: `https://luckymap.yourdomain.com` (after SSL setup)

For support, contact: ndducnha@gmail.com
