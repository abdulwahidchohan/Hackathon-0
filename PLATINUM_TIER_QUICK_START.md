# Platinum Tier - Quick Start Guide

Get your AI Employee running 24/7 in the cloud in under 30 minutes!

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] ✅ Gold Tier fully completed and verified
- [ ] 🐳 Docker Desktop installed on Windows
- [ ] 🔧 Git installed and configured
- [ ] ☁️ Oracle Cloud account created (free tier)
- [ ] 🔑 GitHub repository for vault (private)
- [ ] 📧 Gmail OAuth credentials ready
- [ ] 💻 SSH key generated for server access

## Quick Deploy (30 Minutes)

### Step 1: Local Setup (5 minutes)

```powershell
# Navigate to vault
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"

# Verify Gold Tier is complete
node verify_gold_tier.js

# Create Platinum directories
mkdir In_Progress\cloud, In_Progress\local, Updates -Force

# Initialize Git repository
git init
git remote add origin https://github.com/YOUR_USERNAME/ai-employee-vault.git

# Create .gitignore to protect secrets
Copy-Item .gitignore.example .gitignore

# Commit and push
git add .
git commit -m "Platinum Tier initial setup"
git push -u origin main
```

### Step 2: Oracle Cloud VM (10 minutes)

1. **Login to Oracle Cloud Console**: https://cloud.oracle.com
2. **Create Free Tier VM:**
   - Navigate to **Compute → Instances → Create Instance**
   - Name: `ai-employee-cloud`
   - Image: **Ubuntu 22.04**
   - Shape: **VM.Standard.E2.1.Micro** (Always Free)
   - Upload your **SSH public key**
   - Click **Create**

3. **Note the Public IP address**

4. **Configure Firewall:**
   - Navigate to **Networking → Virtual Cloud Networks**
   - Select your VCN → **Security Lists**
   - Add Ingress Rules for ports: **22, 80, 443, 8080**

### Step 3: Cloud VM Setup (10 minutes)

```bash
# SSH into Oracle Cloud VM
ssh ubuntu@YOUR_ORACLE_IP

# Download and run automated setup
wget https://raw.githubusercontent.com/YOUR_REPO/ai-employee-vault/main/scripts/deployment/oracle-cloud-setup.sh
chmod +x oracle-cloud-setup.sh
./oracle-cloud-setup.sh
```

**Follow the prompts:**
- Enter Git repository URL
- Enter Git credentials
- Add deploy key to GitHub when prompted
- Edit `/opt/ai-employee/.env.cloud` with read-only credentials

### Step 4: Deploy Services (5 minutes)

**On Cloud VM:**
```bash
cd /opt/ai-employee/docker/cloud
docker-compose --env-file /opt/ai-employee/.env.cloud up -d

# Verify services
docker-compose ps
curl http://localhost:8080/health
```

**On Local Machine:**
```powershell
cd docker\local
docker-compose --env-file ..\..\\.env.local up -d

# Verify services
docker-compose ps
curl http://localhost:8081/health
```

### Step 5: Test & Verify (5 minutes)

**Test vault synchronization:**
```powershell
# Create test file
echo "Test from local" > Needs_Action\test_sync.md
git add Needs_Action\test_sync.md
git commit -m "Test sync"
git push

# Wait 5 minutes, then check on cloud
ssh ubuntu@YOUR_ORACLE_IP
ls /opt/ai-employee/vault/Needs_Action/
# Should see test_sync.md
```

**Test minimum passing gate:**
1. Stop local Docker services
2. Send email to monitored address
3. Wait 5-10 minutes
4. Check cloud created draft in `/Pending_Approval/email/`
5. Start local services
6. Approve draft (move to `/Approved/`)
7. Verify local sends email

## Configuration Files Summary

### Local Machine (.env.local) - FULL CREDENTIALS
```bash
# KEEP LOCAL ONLY - DO NOT SYNC TO GIT!
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password
# ... all other secrets
```

### Cloud VM (.env.cloud) - READ-ONLY CREDENTIALS
```bash
# Safe for cloud - NO sending/posting credentials
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_REFRESH_TOKEN_READ_ONLY=your-read-only-token
ODOO_READ_ONLY_KEY=your-read-only-api-key
# NO EMAIL_PASSWORD, NO posting tokens, NO banking
```

## Architecture at a Glance

```
┌─────────────┐         Git Sync         ┌─────────────┐
│   CLOUD     │◄────────────────────────►│    LOCAL    │
│   (Draft)   │    Every 5 minutes       │  (Execute)  │
└──────┬──────┘                          └──────┬──────┘
       │                                        │
    ┌──▼──────────────────────────────────────▼──┐
    │         SYNCHRONIZED VAULT                 │
    │  /Needs_Action/ → /In_Progress/           │
    │  → /Pending_Approval/ → /Approved/        │
    │  → /Done/                                  │
    └────────────────────────────────────────────┘
```

## Security Principles

1. **Cloud Drafts, Local Executes**
   - Cloud can only create drafts
   - Cloud has NO credentials to send/post
   - Local has approval authority

2. **Secrets Stay Local**
   - `.env.local` never synced to Git
   - Cloud has read-only API keys only
   - WhatsApp sessions remain local only

3. **Claim-by-Move Protocol**
   - Atomic file operations prevent races
   - First agent to move file wins
   - No duplicate work

## Common Commands

### Check Service Status
```bash
# Cloud
ssh ubuntu@YOUR_ORACLE_IP
docker-compose -f /opt/ai-employee/docker/cloud/docker-compose.yml ps

# Local
docker-compose -f docker\local\docker-compose.yml ps
```

### View Logs
```bash
# Cloud
ssh ubuntu@YOUR_ORACLE_IP
docker-compose -f /opt/ai-employee/docker/cloud/docker-compose.yml logs -f cloud-agent

# Local
docker-compose -f docker\local\docker-compose.yml logs -f local-agent
```

### Manual Vault Sync
```bash
# Local
node scripts\sync\vault-sync.js

# Cloud
ssh ubuntu@YOUR_ORACLE_IP
VAULT_PATH=/opt/ai-employee/vault AGENT_ID=cloud node /opt/ai-employee/scripts/sync/vault-sync.js
```

### Restart Services
```bash
# Cloud
ssh ubuntu@YOUR_ORACLE_IP
docker-compose -f /opt/ai-employee/docker/cloud/docker-compose.yml restart

# Local
docker-compose -f docker\local\docker-compose.yml restart
```

## Monitoring URLs

- **Cloud Health Dashboard**: `http://YOUR_ORACLE_IP:8080/health`
- **Local Health Dashboard**: `http://localhost:8081/health`
- **Odoo (if deployed)**: `http://YOUR_ORACLE_IP:8069`

## Troubleshooting Quick Fixes

### Cloud Agent Not Starting
```bash
docker-compose logs cloud-agent
# Check .env.cloud for missing variables
# Verify Git authentication
```

### Vault Sync Not Working
```bash
# Test Git access
ssh ubuntu@YOUR_ORACLE_IP
cd /opt/ai-employee/vault
git pull
# If fails, check deploy key in GitHub
```

### Local Can't Send Email
```powershell
# Verify SMTP credentials in .env.local
# Test with:
node test_email_send.js
```

### Both Agents Working on Same Task
```bash
# Check claim-by-move is working
ls In_Progress\cloud\
ls In_Progress\local\
# Should see different files, not duplicates
```

## Next Steps After Deployment

1. **Monitor for 24 hours** to ensure stability
2. **Set up Slack alerts** for critical issues
3. **Configure backup restoration** procedures
4. **Optimize sync intervals** based on usage
5. **Deploy Odoo on cloud** for 24/7 accounting (optional)

## Support

- Full documentation: `PLATINUM_TIER_DEPLOYMENT_GUIDE.md`
- Architecture details: `README.md` (Platinum Tier section)
- Troubleshooting: See deployment guide

---

**Congratulations! Your AI Employee is now running 24/7 in the cloud!** 🎉

The system will:
- ✅ Monitor emails even when your laptop is off
- ✅ Draft replies and social posts autonomously
- ✅ Wait for your approval before sending/posting
- ✅ Execute approved actions securely from local machine
- ✅ Keep complete audit trail in Git

**You've achieved Platinum Tier!** 🏆
