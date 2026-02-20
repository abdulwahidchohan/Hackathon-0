## Platinum Tier Deployment Guide

**Always-On Cloud + Local Executive AI Employee**

This guide walks you through deploying the Platinum Tier AI Employee system with 24/7 cloud operations and local execution authority.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Local Setup](#phase-1-local-setup)
4. [Phase 2: Oracle Cloud Setup](#phase-2-oracle-cloud-setup)
5. [Phase 3: Docker Deployment](#phase-3-docker-deployment)
6. [Phase 4: Vault Synchronization](#phase-4-vault-synchronization)
7. [Phase 5: Testing & Validation](#phase-5-testing--validation)
8. [Phase 6: Production Monitoring](#phase-6-production-monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Machine Requirements
- ✅ Windows 10/11 with Docker Desktop installed
- ✅ Git installed and configured
- ✅ Node.js 18+ installed
- ✅ Minimum 8GB RAM, 50GB free disk space

### Cloud Requirements
- ✅ Oracle Cloud Free Tier account (or AWS/DigitalOcean/Azure)
- ✅ GitHub repository for vault (private repository recommended)
- ✅ SSH key for server access

### Credentials Needed
- 📧 Gmail OAuth credentials (read-only for cloud)
- 🔑 LinkedIn API credentials
- 🐦 Twitter/X API credentials
- 📘 Facebook API credentials
- 💼 Odoo credentials (if using accounting)
- 📱 WhatsApp Twilio credentials (local only)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATINUM TIER ARCHITECTURE               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │   CLOUD AGENT    │◄────────►│   LOCAL AGENT   │        │
│  │   (24/7 Drafts)  │   Git   │ (Approval+Exec) │        │
│  └──────────────────┘  Sync   └──────────────────┘        │
│           │                              │                 │
│           │                              │                 │
│      ┌────▼────┐                    ┌────▼────┐           │
│      │ Watchers│                    │All MCP  │           │
│      │ Gmail   │                    │ Servers │           │
│      │ Files   │                    │ (Full)  │           │
│      └─────────┘                    └─────────┘           │
│           │                              │                 │
│           │                              │                 │
│      ┌────▼─────────────────────────────▼────┐           │
│      │         SYNCHRONIZED VAULT            │           │
│      │    (Git-Based with Claim-by-Move)     │           │
│      └──────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Work Zone Specialization

**Cloud Agent Responsibilities (Draft-Only):**
- ✅ Email monitoring and triage
- ✅ Draft email replies
- ✅ Draft social media posts
- ✅ Document processing
- ✅ Health monitoring
- ❌ NO sending/posting credentials
- ❌ NO WhatsApp sessions
- ❌ NO payment processing

**Local Agent Responsibilities (Execution Authority):**
- ✅ Review and approve drafts
- ✅ Send approved emails
- ✅ Post approved social media content
- ✅ WhatsApp messaging
- ✅ Payment processing
- ✅ All sensitive operations
- ✅ Secret management

---

## Phase 1: Local Setup

### Step 1.1: Prepare Your Vault

```bash
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"

# Ensure all Gold Tier requirements are complete
node verify_gold_tier.js

# Create Platinum Tier directories
mkdir -p In_Progress/cloud In_Progress/local Updates
```

### Step 1.2: Initialize Git Repository

```bash
# Initialize git if not already done
git init

# Create .gitignore for secrets
cat > .gitignore << 'EOF'
# Secrets (NEVER sync to cloud)
.env
.env.local
.env.cloud
.linkedin_token.json
credentials.json
whatsapp-session/
*.key
*.pem

# Node modules
node_modules/
package-lock.json

# Logs
*.log
logs/

# Temporary files
temp/
.DS_Store
Thumbs.db
EOF

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/ai-employee-vault.git

# Initial commit
git add .
git commit -m "Initial Platinum Tier setup"
git push -u origin main
```

### Step 1.3: Install Docker Desktop

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Verify installation:

```bash
docker --version
docker-compose --version
```

### Step 1.4: Configure Local Environment

Create `.env.local` with **FULL credentials** (stays local only):

```bash
# Agent Configuration
AGENT_ID=local
AGENT_ROLE=executor
VAULT_PATH=C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault

# Email Credentials (SMTP - Full Access)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# LinkedIn Credentials
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_MEMBER_ID=your-member-id

# Twitter/X Credentials
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_TOKEN_SECRET=your-access-token-secret

# Facebook Credentials
FACEBOOK_ACCESS_TOKEN=your-access-token
FACEBOOK_PAGE_ID=your-page-id

# Odoo Credentials (Full Access)
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your-database
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password

# WhatsApp (Twilio)
WHATSAPP_ACCOUNT_SID=your-account-sid
WHATSAPP_AUTH_TOKEN=your-auth-token
WHATSAPP_NUMBER=your-whatsapp-number

# Git Configuration
GIT_REMOTE=origin
GIT_BRANCH=main
```

### Step 1.5: Test Local Docker Setup

```bash
cd docker/local

# Start local services
docker-compose --env-file ../../.env.local up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f local-agent

# Test health endpoint
curl http://localhost:8081/health
```

---

## Phase 2: Oracle Cloud Setup

### Step 2.1: Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Sign up for Oracle Cloud Free Tier
3. Verify email and complete account setup

### Step 2.2: Provision Free Tier VM

1. **Login to Oracle Cloud Console**
2. **Navigate to Compute → Instances**
3. **Click "Create Instance"**

**Instance Configuration:**
- **Name:** `ai-employee-cloud`
- **Compartment:** (root)
- **Availability Domain:** (any)
- **Image:** Ubuntu 22.04 (Minimal)
- **Shape:** VM.Standard.E2.1.Micro (Always Free)
- **Network:** Create new VCN or use existing
- **Assign Public IP:** Yes
- **SSH Keys:** Upload your public SSH key

4. **Click "Create"**
5. **Wait for provisioning (2-3 minutes)**
6. **Note down the Public IP address**

### Step 2.3: Configure Firewall Rules

In Oracle Cloud Console:

1. **Navigate to Networking → Virtual Cloud Networks**
2. **Select your VCN → Security Lists**
3. **Click "Default Security List"**
4. **Add Ingress Rules:**

| Source CIDR | Protocol | Port Range | Description |
|------------|----------|------------|-------------|
| 0.0.0.0/0  | TCP      | 22         | SSH Access  |
| 0.0.0.0/0  | TCP      | 80         | HTTP        |
| 0.0.0.0/0  | TCP      | 443        | HTTPS       |
| 0.0.0.0/0  | TCP      | 8080       | Health Dashboard |

### Step 2.4: Connect to VM and Run Setup Script

```bash
# SSH into your Oracle Cloud VM
ssh ubuntu@YOUR_ORACLE_IP

# Download and run setup script
wget https://raw.githubusercontent.com/YOUR_REPO/ai-employee-vault/main/scripts/deployment/oracle-cloud-setup.sh
chmod +x oracle-cloud-setup.sh
./oracle-cloud-setup.sh
```

**Follow the prompts:**
1. Enter your Git repository URL
2. Enter Git credentials
3. Add deploy key to GitHub
4. Edit `.env.cloud` with read-only credentials

### Step 2.5: Configure Cloud Environment

Create `.env.cloud` with **READ-ONLY credentials**:

```bash
# SSH into Oracle Cloud VM
ssh ubuntu@YOUR_ORACLE_IP

# Edit cloud environment file
nano /opt/ai-employee/.env.cloud
```

```bash
# Agent Configuration
AGENT_ID=cloud
AGENT_ROLE=draft_generator
VAULT_PATH=/opt/ai-employee/vault

# Gmail OAuth (READ-ONLY scope)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN_READ_ONLY=your-read-only-token

# Odoo (READ-ONLY API key)
ODOO_CLOUD_URL=https://your-odoo-instance.com
ODOO_DB=your-database
ODOO_READ_ONLY_KEY=your-read-only-api-key

# Monitoring
SLACK_WEBHOOK_URL=your-slack-webhook
ADMIN_EMAIL=your-email@example.com

# Git Configuration
GIT_REMOTE=origin
GIT_BRANCH=main

# IMPORTANT: NO sending/posting credentials here!
# Cloud can only draft, not execute
```

---

## Phase 3: Docker Deployment

### Step 3.1: Deploy Cloud Services

On Oracle Cloud VM:

```bash
cd /opt/ai-employee/docker/cloud

# Copy Docker files from local (or clone from repo)
# Then start services
docker-compose --env-file /opt/ai-employee/.env.cloud up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f cloud-agent
docker-compose logs -f watcher-orchestrator
docker-compose logs -f vault-sync
```

**Verify Services:**
```bash
# Health check
curl http://localhost:8080/health

# Check vault sync
docker exec ai-employee-vault-sync bash -c "cd /vault && git status"
```

### Step 3.2: Deploy Local Services

On your local Windows machine:

```bash
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault\docker\local"

# Start local services
docker-compose --env-file ../../.env.local up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f local-agent
docker-compose logs -f approval-monitor
```

### Step 3.3: Optional - Deploy Odoo on Cloud

On Oracle Cloud VM (if using Odoo):

```bash
cd /opt/ai-employee/docker/odoo

# Configure Odoo environment
nano .env.odoo

# Start Odoo services
docker-compose up -d

# Initial setup (first time only)
# Navigate to: http://YOUR_ORACLE_IP:8069
# Complete Odoo setup wizard
```

---

## Phase 4: Vault Synchronization

### Step 4.1: Test Manual Sync

**On Local Machine:**
```bash
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"

# Test vault sync
node scripts/sync/vault-sync.js

# Test claim-by-move protocol
node scripts/sync/claim-by-move.js
```

**On Cloud VM:**
```bash
cd /opt/ai-employee

# Test vault sync
VAULT_PATH=/opt/ai-employee/vault AGENT_ID=cloud node scripts/sync/vault-sync.js
```

### Step 4.2: Configure Automated Sync

**Local:** Already configured in docker-compose (every 5 minutes)

**Cloud:** Already configured in docker-compose (every 5 minutes)

### Step 4.3: Verify Sync Works

**Create test file locally:**
```bash
echo "Test sync from local" > Needs_Action/test_sync.md
git add Needs_Action/test_sync.md
git commit -m "Test sync"
git push
```

**Check on cloud (wait 5 minutes for auto-sync):**
```bash
ssh ubuntu@YOUR_ORACLE_IP
ls /opt/ai-employee/vault/Needs_Action/
# Should see test_sync.md
```

---

## Phase 5: Testing & Validation

### Step 5.1: Minimum Passing Gate Demo

**Scenario:** Email arrives while local is offline → Cloud drafts reply → Local approves and sends

1. **Power off local machine** (or stop local Docker services)

2. **Send test email to your monitored Gmail address**

3. **Cloud agent should:**
   - Detect email via Gmail watcher (within 5 minutes)
   - Generate draft reply using Claude reasoning
   - Create file in `/Pending_Approval/email/reply_to_test.md`
   - Commit and push to Git

4. **Power on local machine**

5. **Local agent should:**
   - Pull vault updates automatically (within 5 minutes)
   - Detect new file in `/Pending_Approval/email/`
   - Show notification (if configured)

6. **User reviews and approves:**
   - Move file to `/Approved/email/reply_to_test.md`
   - Git commit and push

7. **Local agent should:**
   - Detect approved file
   - Send email via SMTP
   - Log action
   - Move to `/Done/email/reply_to_test.md`

### Step 5.2: Verify Work-Zone Specialization

**Test Cloud Cannot Send Email:**
```bash
ssh ubuntu@YOUR_ORACLE_IP

# Try to send email from cloud (should fail - no SMTP credentials)
docker exec ai-employee-cloud-agent node test-email-send.js
# Expected: Error - SMTP credentials not configured
```

**Test Local Can Send Email:**
```bash
# On local machine
docker exec ai-employee-local-agent node test-email-send.js
# Expected: Success - Email sent
```

### Step 5.3: Test Claim-by-Move Protocol

1. **Create task in Needs_Action:**
```bash
echo "Test task for claiming" > Needs_Action/test_task.md
git add Needs_Action/test_task.md
git commit -m "Add test task"
git push
```

2. **Both agents should detect the task** (after sync)

3. **First agent to claim moves it to In_Progress:**
   - Cloud or Local will atomically move file
   - Other agent will see file is gone, skip it

4. **Verify only one agent claimed it:**
```bash
# Check locally
ls In_Progress/cloud/
ls In_Progress/local/
# Should see test_task.md in only ONE directory
```

---

## Phase 6: Production Monitoring

### Step 6.1: Health Monitoring Dashboard

**Access Cloud Health Dashboard:**
```
http://YOUR_ORACLE_IP:8080/health
```

**Check Service Health:**
```bash
# Cloud services
ssh ubuntu@YOUR_ORACLE_IP
docker-compose -f /opt/ai-employee/docker/cloud/docker-compose.yml ps

# Local services
docker-compose -f docker/local/docker-compose.yml ps
```

### Step 6.2: Log Monitoring

**View Cloud Logs:**
```bash
ssh ubuntu@YOUR_ORACLE_IP
tail -f /opt/ai-employee/logs/cloud-agent.log
tail -f /opt/ai-employee/logs/watcher-orchestrator.log
tail -f /opt/ai-employee/logs/vault-sync.log
```

**View Local Logs:**
```bash
tail -f logs/local-agent.log
tail -f logs/approval-monitor.log
```

### Step 6.3: Automated Alerts

**Configure Slack Webhook** (optional):
```bash
# Add to .env.cloud
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Restart health monitor
docker-compose restart health-monitor
```

### Step 6.4: Backup Verification

**Check Automated Backups:**
```bash
ssh ubuntu@YOUR_ORACLE_IP
ls -lh /opt/ai-employee/backups/
# Should see daily backups
```

---

## Troubleshooting

### Issue: Cloud Agent Not Starting

**Check logs:**
```bash
docker-compose logs cloud-agent
```

**Common causes:**
- Missing environment variables in `.env.cloud`
- Git authentication failure
- Port conflicts

**Fix:**
1. Verify `.env.cloud` has all required variables
2. Test Git access: `git pull` in vault directory
3. Check port availability: `netstat -tuln | grep 8080`

### Issue: Vault Sync Not Working

**Symptoms:**
- Local changes not appearing on cloud
- Cloud drafts not appearing locally

**Diagnosis:**
```bash
# Check sync service logs
docker-compose logs vault-sync

# Manual sync test
node scripts/sync/vault-sync.js
```

**Fix:**
1. Verify Git credentials
2. Check network connectivity
3. Resolve any merge conflicts
4. Restart sync service: `docker-compose restart vault-sync`

### Issue: Cloud Agent Can Send Email (Security Violation)

**This is a CRITICAL security issue!**

**Immediate action:**
1. Stop cloud services: `docker-compose down`
2. Check `.env.cloud` - should NOT contain SMTP credentials
3. Verify `.gitignore` excludes `.env` files
4. Rotate any exposed credentials
5. Review Git history for leaked secrets

### Issue: Claim-by-Move Race Condition

**Symptoms:**
- Both agents working on same task
- Duplicate work being done

**Diagnosis:**
```bash
# Check In_Progress directories
ls In_Progress/cloud/
ls In_Progress/local/

# Check for same file in both
```

**Fix:**
1. Ensure atomic file moves are working
2. Check for filesystem sync delays
3. Verify claim-by-move script is running
4. Increase sync interval if race conditions persist

---

## Next Steps After Deployment

### 1. Performance Optimization
- Monitor resource usage on Oracle Cloud VM
- Optimize Docker container resource limits
- Tune sync intervals based on usage patterns

### 2. Enhanced Monitoring
- Set up Grafana dashboards for metrics
- Configure Prometheus for monitoring
- Add custom alerting rules

### 3. Disaster Recovery
- Test backup restoration procedures
- Document recovery runbooks
- Set up off-site backup replication

### 4. Security Hardening
- Enable two-factor authentication for cloud VM
- Set up VPN for admin access
- Regular security audits

---

## Conclusion

You now have a fully operational Platinum Tier AI Employee system with:

✅ **24/7 Cloud Operations** - Always-on monitoring and drafting
✅ **Work-Zone Specialization** - Clear division between draft and execution
✅ **Security Isolation** - Secrets never leave local machine
✅ **Automated Synchronization** - Git-based vault sync
✅ **Claim-by-Move Protocol** - No duplicate work
✅ **Production Monitoring** - Health checks and alerting

**The system is production-ready and deployment-certified!**

For support and questions, refer to the main README.md or create an issue in the repository.

Happy deploying! 🚀
