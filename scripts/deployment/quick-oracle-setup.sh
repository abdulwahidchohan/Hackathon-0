#!/bin/bash

# Quick Oracle Cloud Setup for Platinum Tier AI Employee
# Optimized for immediate deployment

set -e

echo ""
echo "=========================================="
echo "AI Employee - Quick Cloud Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Step 1: Installing Docker${NC}"
echo "This will take 2-3 minutes..."

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo ""
echo -e "${GREEN}Step 2: Installing Git and Node.js${NC}"

# Install Git
sudo apt-get install -y git

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo ""
echo -e "${GREEN}Step 3: Configuring Firewall${NC}"

# Configure iptables for Oracle Cloud
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 4: Creating Application Directory${NC}"

# Create directory structure
sudo mkdir -p /opt/ai-employee
sudo chown ubuntu:ubuntu /opt/ai-employee
cd /opt/ai-employee

mkdir -p docker/cloud logs vault scripts/sync commands

echo ""
echo -e "${GREEN}Step 5: Git Configuration${NC}"
echo ""
echo "We need your Git repository information to sync the vault."
echo ""

read -p "Enter your GitHub username: " GIT_USERNAME
read -p "Enter your GitHub repository name (e.g., ai-employee-vault): " GIT_REPO
read -sp "Enter your GitHub Personal Access Token: " GIT_TOKEN
echo ""

GIT_REPO_URL="https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/${GIT_USERNAME}/${GIT_REPO}.git"

echo ""
echo -e "${YELLOW}Cloning vault repository...${NC}"

# Clone with credentials
git clone $GIT_REPO_URL vault

# Configure git
cd vault
git config user.name "AI Employee Cloud Agent"
git config user.email "cloud-agent@ai-employee.local"

echo ""
echo -e "${GREEN}Step 6: Generating SSH Deploy Key${NC}"

# Generate SSH key
ssh-keygen -t ed25519 -C "ai-employee-cloud@oracle" -f ~/.ssh/ai-employee-deploy -N ""

echo ""
echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}IMPORTANT: Add this Deploy Key to GitHub${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""
cat ~/.ssh/ai-employee-deploy.pub
echo ""
echo "Steps:"
echo "1. Go to: https://github.com/${GIT_USERNAME}/${GIT_REPO}/settings/keys"
echo "2. Click 'Add deploy key'"
echo "3. Title: 'AI Employee Cloud Agent'"
echo "4. Key: Copy the key above"
echo "5. ✅ Check 'Allow write access'"
echo "6. Click 'Add key'"
echo ""
read -p "Press Enter after adding the deploy key..."

# Configure SSH
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/ai-employee-deploy
    StrictHostKeyChecking no
EOF

chmod 600 ~/.ssh/config

# Test SSH connection
echo ""
echo -e "${YELLOW}Testing SSH connection to GitHub...${NC}"
ssh -T git@github.com 2>&1 | grep "successfully authenticated" && echo "✅ SSH connection works!" || echo "⚠️ SSH test completed"

# Switch to SSH URL
cd /opt/ai-employee/vault
git remote set-url origin git@github.com:${GIT_USERNAME}/${GIT_REPO}.git

echo ""
echo -e "${GREEN}Step 7: Installing Dependencies${NC}"

# Copy necessary files
cd /opt/ai-employee/vault

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing Node.js dependencies..."
    npm install --production
fi

echo ""
echo -e "${GREEN}Step 8: Setting up Automated Backups${NC}"

# Create backup script
cat > /opt/ai-employee/scripts/backup.sh << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/ai-employee/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup vault
tar -czf $BACKUP_DIR/vault-$DATE.tar.gz /opt/ai-employee/vault 2>/dev/null

# Backup logs
tar -czf $BACKUP_DIR/logs-$DATE.tar.gz /opt/ai-employee/logs 2>/dev/null

# Keep only last 30 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
BACKUP_SCRIPT

chmod +x /opt/ai-employee/scripts/backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ai-employee/scripts/backup.sh") | crontab -

echo ""
echo -e "${GREEN}Step 9: Security Hardening${NC}"

# Disable password authentication for SSH
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Install fail2ban
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Install unattended-upgrades
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "System Information:"
docker --version
docker-compose --version
git --version
node --version
echo ""
echo "Next Steps:"
echo ""
echo "1. Configure cloud environment file:"
echo "   nano /opt/ai-employee/.env.cloud"
echo ""
echo "2. Create Docker Compose file:"
echo "   nano /opt/ai-employee/docker-compose.yml"
echo ""
echo "3. Start cloud services:"
echo "   cd /opt/ai-employee"
echo "   docker-compose up -d"
echo ""
echo "4. Check health:"
echo "   curl http://localhost:8080/health"
echo ""
echo -e "${YELLOW}Note: Logout and login again for Docker group to take effect${NC}"
echo ""
