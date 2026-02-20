#!/bin/bash

# Oracle Cloud Free Tier VM Setup Script for Platinum Tier AI Employee
# This script provisions and configures an Oracle Cloud VM for 24/7 operations

set -e

echo "=================================================="
echo "Oracle Cloud AI Employee - Platinum Tier Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VM_SHAPE="VM.Standard.E2.1.Micro"  # Free tier eligible
VM_OS="Ubuntu 22.04"
VM_MEMORY="1GB"
VM_DISK="50GB"

echo -e "${GREEN}Step 1: System Update${NC}"
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

echo ""
echo -e "${GREEN}Step 2: Install Docker${NC}"
echo "Installing Docker and Docker Compose..."

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo ""
echo -e "${GREEN}Step 3: Install Git and Node.js${NC}"
echo "Installing development tools..."

# Install Git
sudo apt-get install -y git

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
echo ""
echo "Versions installed:"
docker --version
docker-compose --version
git --version
node --version
npm --version

echo ""
echo -e "${GREEN}Step 4: Configure Firewall${NC}"
echo "Setting up firewall rules..."

# Oracle Cloud uses iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8069 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save

echo ""
echo -e "${GREEN}Step 5: Create Application Directory${NC}"
echo "Setting up application directories..."

# Create app directory
sudo mkdir -p /opt/ai-employee
sudo chown $USER:$USER /opt/ai-employee
cd /opt/ai-employee

# Create subdirectories
mkdir -p docker/cloud docker/odoo logs vault backups scripts

echo ""
echo -e "${GREEN}Step 6: Clone Vault Repository${NC}"
echo "Setting up Git repository for vault synchronization..."

# Prompt for Git repository URL
read -p "Enter your Git repository URL: " GIT_REPO_URL
read -p "Enter your Git username: " GIT_USERNAME
read -sp "Enter your Git token/password: " GIT_PASSWORD
echo ""

# Clone repository
cd /opt/ai-employee
git clone $GIT_REPO_URL vault

# Configure Git
cd vault
git config user.name "AI Employee Cloud Agent"
git config user.email "cloud-agent@ai-employee.local"

# Set up Git credential helper
git config credential.helper store
echo "https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com" > ~/.git-credentials

echo ""
echo -e "${GREEN}Step 7: Set Up SSH Deploy Key${NC}"
echo "Configuring SSH for secure Git access..."

# Generate SSH key for deployment
ssh-keygen -t ed25519 -C "ai-employee-cloud@oracle" -f ~/.ssh/ai-employee-deploy -N ""

echo ""
echo -e "${YELLOW}IMPORTANT: Add this public key to your Git repository as a deploy key:${NC}"
echo ""
cat ~/.ssh/ai-employee-deploy.pub
echo ""
read -p "Press Enter after adding the deploy key to your repository..."

# Configure SSH
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/ai-employee-deploy
    StrictHostKeyChecking no
EOF

chmod 600 ~/.ssh/config

echo ""
echo -e "${GREEN}Step 8: Configure Environment Variables${NC}"
echo "Setting up cloud-safe environment variables..."

# Create cloud .env file (read-only credentials)
cat > /opt/ai-employee/.env.cloud << 'EOF'
# Cloud Agent Environment Variables (Read-Only Operations)
AGENT_ID=cloud
AGENT_ROLE=draft_generator
NODE_ENV=production

# Vault Configuration
VAULT_PATH=/opt/ai-employee/vault

# Gmail Read-Only OAuth
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN_READ_ONLY=your-read-only-refresh-token

# Odoo Read-Only
ODOO_CLOUD_URL=https://your-odoo-instance.com
ODOO_DB=your-database
ODOO_READ_ONLY_KEY=your-read-only-api-key

# Monitoring
SLACK_WEBHOOK_URL=your-slack-webhook
ADMIN_EMAIL=your-email@example.com

# Git Configuration
GIT_REMOTE=origin
GIT_BRANCH=main
EOF

echo ""
echo -e "${YELLOW}Please edit /opt/ai-employee/.env.cloud with your actual credentials${NC}"
echo "Use only read-only credentials for cloud agent!"
read -p "Press Enter after editing .env.cloud..."

echo ""
echo -e "${GREEN}Step 9: Set Up Automated Backups${NC}"
echo "Configuring backup system..."

# Create backup script
cat > /opt/ai-employee/scripts/backup.sh << 'EOF'
#!/bin/bash
# Daily backup script for AI Employee vault and logs

BACKUP_DIR="/opt/ai-employee/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup vault
tar -czf $BACKUP_DIR/vault-$DATE.tar.gz /opt/ai-employee/vault

# Backup logs
tar -czf $BACKUP_DIR/logs-$DATE.tar.gz /opt/ai-employee/logs

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/ai-employee/scripts/backup.sh

# Add cron job for daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ai-employee/scripts/backup.sh") | crontab -

echo ""
echo -e "${GREEN}Step 10: Install System Service${NC}"
echo "Setting up systemd service for auto-start..."

# Create systemd service
sudo cat > /etc/systemd/system/ai-employee-cloud.service << EOF
[Unit]
Description=AI Employee Cloud Agent
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ai-employee/docker/cloud
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=$USER

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable ai-employee-cloud.service

echo ""
echo -e "${GREEN}Step 11: Install Monitoring Tools${NC}"
echo "Setting up health monitoring..."

# Install monitoring packages
sudo apt-get install -y htop iotop nethogs

# Install log rotation
sudo apt-get install -y logrotate

# Configure log rotation
sudo cat > /etc/logrotate.d/ai-employee << EOF
/opt/ai-employee/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
}
EOF

echo ""
echo -e "${GREEN}Step 12: Security Hardening${NC}"
echo "Applying security best practices..."

# Disable password authentication for SSH (key-only)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Enable automatic security updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Install fail2ban for brute-force protection
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo ""
echo "=================================================="
echo -e "${GREEN}Oracle Cloud Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Copy Docker files to cloud VM:"
echo "   scp -r docker/cloud/* user@your-oracle-ip:/opt/ai-employee/docker/cloud/"
echo ""
echo "2. Edit cloud environment file:"
echo "   nano /opt/ai-employee/.env.cloud"
echo ""
echo "3. Start cloud services:"
echo "   cd /opt/ai-employee/docker/cloud"
echo "   docker-compose --env-file /opt/ai-employee/.env.cloud up -d"
echo ""
echo "4. Check service status:"
echo "   docker-compose ps"
echo "   docker-compose logs -f cloud-agent"
echo ""
echo "5. Verify health dashboard:"
echo "   curl http://localhost:8080/health"
echo ""
echo "6. Monitor logs:"
echo "   tail -f /opt/ai-employee/logs/*.log"
echo ""
echo -e "${YELLOW}IMPORTANT SECURITY REMINDERS:${NC}"
echo "- Cloud agent has READ-ONLY credentials"
echo "- No secrets or tokens for sending/posting"
echo "- All sensitive operations require local approval"
echo "- Review firewall rules in Oracle Cloud Console"
echo ""
echo "Happy deploying! 🚀"
echo ""
