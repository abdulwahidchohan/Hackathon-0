# Platinum Tier - Step-by-Step Setup Instructions

**Current Status:** ✅ Infrastructure Complete
**Next Action:** Local Testing & Docker Deployment

---

## What We Just Created

✅ **Environment Files:**
- `.env.local` - Full credentials for local agent (YOUR MACHINE)
- `.env.cloud.template` - Template for cloud agent (ORACLE VM)
- Updated `.gitignore` - Protects secrets from Git sync

✅ **Docker Infrastructure:**
- `docker/cloud/docker-compose.yml` - Cloud services
- `docker/local/docker-compose.yml` - Local services
- `docker/odoo/docker-compose.yml` - Odoo accounting

✅ **Agent Commands:**
- `commands/cloud-agent.js` - Cloud draft generator (24/7)
- Synchronization scripts ready

✅ **Documentation:**
- Complete deployment guide
- Quick start guide (30 minutes)
- Implementation summary

---

## Step 1: Test Locally First (Recommended)

Before deploying to cloud, let's test everything works on your local machine.

### 1.1 Verify Prerequisites

```powershell
# Check Docker Desktop is running
docker --version
docker-compose --version

# Check Git is configured
git --version
git config --global user.name
git config --global user.email

# Check Node.js
node --version
npm --version
```

### 1.2 Create Required Directories

```powershell
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"

# Create Platinum Tier directories
mkdir In_Progress\cloud -Force
mkdir In_Progress\local -Force
mkdir Pending_Approval\email -Force
mkdir Pending_Approval\social -Force
mkdir Approved\email -Force
mkdir Approved\social -Force
mkdir Updates -Force
```

### 1.3 Initialize Git Repository (If Not Already Done)

```powershell
# Check if Git is initialized
git status

# If not initialized:
git init
git add .
git commit -m "Platinum Tier setup complete"

# Create GitHub repository and push
# (Follow GitHub instructions to create private repo)
git remote add origin https://github.com/YOUR_USERNAME/ai-employee-vault.git
git branch -M main
git push -u origin main
```

### 1.4 Test Vault Sync Locally

```powershell
# Test the vault sync script
node scripts\sync\vault-sync.js

# Test claim-by-move protocol
node scripts\sync\claim-by-move.js
```

### 1.5 Test Cloud Agent Locally (Without Docker)

```powershell
# Set environment for local testing
$env:AGENT_ID="cloud"
$env:VAULT_PATH="C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"
$env:HEALTH_CHECK_PORT="8080"

# Run cloud agent
node commands\cloud-agent.js

# Leave it running and open another terminal
# Check health endpoint
curl http://localhost:8080/health
```

### 1.6 Create a Test Task

In another PowerShell window:

```powershell
cd "C:\Users\Lap Zone\Personal AI Employee\AI_Employee_Vault"

# Create a test email task
@"
---
type: email
priority: normal
status: pending
subject: Test Email
---

# Test Email Task

Please draft a reply to the following email:

From: test@example.com
Subject: Testing Platinum Tier

Hi,

I'm testing the new Platinum Tier AI Employee system. Can you draft a reply confirming everything is working?

Thanks!
"@ | Out-File -FilePath "Needs_Action\test_email_task.md" -Encoding UTF8
```

Watch the cloud agent terminal - it should:
1. Detect the task
2. Claim it (move to In_Progress/cloud/)
3. Generate a draft
4. Move draft to Pending_Approval/email/
5. Mark original task as done

---

## Step 2: Deploy with Docker Desktop (Local)

Once local testing works, deploy with Docker for production-like environment.

### 2.1 Build and Start Local Services

```powershell
cd docker\local

# Start local services
docker-compose --env-file ..\..\\.env.local up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f local-agent
```

### 2.2 Verify Health Endpoints

```powershell
# Local agent health check
curl http://localhost:8081/health

# MCP servers health checks
curl http://localhost:3001/health  # Communication MCP
curl http://localhost:3002/health  # Business Ops MCP
curl http://localhost:3005/health  # Odoo MCP
```

### 2.3 Test Approval Workflow

```powershell
# Check for drafts in Pending_Approval
ls Pending_Approval\email\

# Manually approve a draft (move to Approved)
Move-Item "Pending_Approval\email\draft_*.md" "Approved\email\"

# Watch local agent execute the approved action
docker-compose logs -f local-agent
```

---

## Step 3: Deploy to Oracle Cloud (24/7 Operations)

Now that local works, deploy the cloud agent to Oracle Cloud VM.

### 3.1 Create Oracle Cloud Account

1. Go to: https://www.oracle.com/cloud/free/
2. Sign up for **Oracle Cloud Free Tier**
3. Complete email verification
4. Add payment method (required but won't be charged for free tier)

### 3.2 Create Free Tier VM

1. **Login to Oracle Cloud Console**
2. **Navigate to**: Compute → Instances
3. **Click**: "Create Instance"

**Configuration:**
- **Name:** `ai-employee-cloud`
- **Image:** Ubuntu 22.04 Minimal
- **Shape:** VM.Standard.E2.1.Micro (Always Free)
- **Network:** Create new VCN or use default
- **Public IP:** Assign
- **SSH Key:** Upload your public key
  ```powershell
  # Generate SSH key if you don't have one
  ssh-keygen -t ed25519 -C "ai-employee-cloud"
  # Upload the .pub file to Oracle Cloud
  ```

4. **Click "Create"**
5. **Wait 2-3 minutes** for provisioning
6. **Note the Public IP address**

### 3.3 Configure Firewall Rules

In Oracle Cloud Console:

1. **Navigate to:** Networking → Virtual Cloud Networks
2. **Select your VCN** → Security Lists
3. **Click:** "Default Security List"
4. **Add Ingress Rules:**

| Source | Protocol | Port Range | Description |
|--------|----------|------------|-------------|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | TCP | 8080 | Health Dashboard |

### 3.4 SSH Into VM and Run Setup

```powershell
# SSH into your Oracle Cloud VM
ssh ubuntu@YOUR_ORACLE_IP

# Download setup script
wget https://raw.githubusercontent.com/YOUR_REPO/ai-employee-vault/main/scripts/deployment/oracle-cloud-setup.sh

# Make executable
chmod +x oracle-cloud-setup.sh

# Run setup (follow prompts)
./oracle-cloud-setup.sh
```

**The script will:**
- Update system packages
- Install Docker and Docker Compose
- Install Git and Node.js
- Configure firewall
- Set up Git repository
- Create directory structure
- Configure automated backups
- Set up systemd services

### 3.5 Configure Cloud Environment

On the Oracle Cloud VM:

```bash
# Edit cloud environment file
nano /opt/ai-employee/.env.cloud
```

**Add READ-ONLY credentials:**
```bash
# Gmail OAuth (Read-Only)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN_READ_ONLY=your-read-only-token

# Odoo Read-Only
ODOO_CLOUD_URL=https://rubaiya1.odoo.com
ODOO_DB=rubaiya1
ODOO_READ_ONLY_KEY=generate-read-only-key

# Monitoring
SLACK_WEBHOOK_URL=your-slack-webhook (optional)
ADMIN_EMAIL=your-email@example.com
```

**IMPORTANT:** Cloud environment should have:
- ✅ Gmail read-only OAuth
- ✅ Odoo read-only API key
- ❌ NO EMAIL_PASSWORD (no SMTP)
- ❌ NO social media tokens
- ❌ NO payment credentials

### 3.6 Copy Docker Files to Cloud VM

From your local machine:

```powershell
# Copy cloud Docker files to VM
scp -r docker/cloud/* ubuntu@YOUR_ORACLE_IP:/opt/ai-employee/docker/cloud/

# Copy sync scripts
scp -r scripts/sync/* ubuntu@YOUR_ORACLE_IP:/opt/ai-employee/scripts/sync/

# Copy agent commands
scp -r commands/* ubuntu@YOUR_ORACLE_IP:/opt/ai-employee/commands/
```

### 3.7 Start Cloud Services

On Oracle Cloud VM:

```bash
cd /opt/ai-employee/docker/cloud

# Start services
docker-compose --env-file /opt/ai-employee/.env.cloud up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f cloud-agent

# Check health endpoint
curl http://localhost:8080/health
```

---

## Step 4: Test End-to-End Workflow

### 4.1 Minimum Passing Gate Demo

**Scenario:** Email arrives while local is offline → Cloud drafts → Local approves & sends

1. **Stop local Docker services:**
   ```powershell
   cd docker\local
   docker-compose down
   ```

2. **Send test email to your monitored Gmail address**

3. **Wait 5-10 minutes** (cloud checks every 5 min)

4. **Check cloud created draft:**
   ```bash
   # On Oracle Cloud VM
   ssh ubuntu@YOUR_ORACLE_IP
   ls /opt/ai-employee/vault/Pending_Approval/email/
   ```

5. **Start local services:**
   ```powershell
   docker-compose --env-file ..\..\\.env.local up -d
   ```

6. **Wait for sync** (local pulls vault updates)

7. **Check local detected draft:**
   ```powershell
   ls Pending_Approval\email\
   ```

8. **Approve the draft:**
   ```powershell
   Move-Item "Pending_Approval\email\draft_*.md" "Approved\email\"
   ```

9. **Watch local send email:**
   ```powershell
   docker-compose logs -f local-agent
   ```

10. **Verify complete audit trail:**
    ```powershell
    git log --oneline
    # Should see commits from both cloud and local agents
    ```

---

## Step 5: Production Monitoring

### 5.1 Health Monitoring

**Cloud Health Dashboard:**
```
http://YOUR_ORACLE_IP:8080/health
```

**Local Health Dashboard:**
```
http://localhost:8081/health
```

### 5.2 Log Monitoring

**Cloud Logs:**
```bash
ssh ubuntu@YOUR_ORACLE_IP
docker-compose -f /opt/ai-employee/docker/cloud/docker-compose.yml logs -f cloud-agent
```

**Local Logs:**
```powershell
docker-compose -f docker\local\docker-compose.yml logs -f local-agent
```

### 5.3 Automated Backups

**Check backups are running:**
```bash
ssh ubuntu@YOUR_ORACLE_IP
ls -lh /opt/ai-employee/backups/
# Should see daily backups
```

---

## Troubleshooting

### Issue: Docker Desktop not starting
**Solution:**
1. Enable Hyper-V in Windows Features
2. Restart computer
3. Start Docker Desktop manually

### Issue: Cloud agent can't push to Git
**Solution:**
1. Check deploy key is added to GitHub
2. Verify Git credentials on cloud VM
3. Test manual push: `git push origin main`

### Issue: Local agent can't send email
**Solution:**
1. Verify EMAIL_PASSWORD in .env.local
2. Check Gmail "Less secure app access" or use App Password
3. Test SMTP manually

### Issue: Vault sync conflicts
**Solution:**
1. Check Git status: `git status`
2. Resolve conflicts manually
3. Restart sync service: `docker-compose restart vault-sync`

---

## Next Steps

1. ✅ **Monitor for 24 hours** - Ensure stability
2. ✅ **Set up alerts** - Slack/email notifications
3. ✅ **Optimize intervals** - Tune sync and check frequencies
4. ✅ **Deploy Odoo** (optional) - 24/7 accounting
5. ✅ **Document procedures** - Operational runbooks

---

## Support Resources

- **Full Guide:** `PLATINUM_TIER_DEPLOYMENT_GUIDE.md`
- **Quick Start:** `PLATINUM_TIER_QUICK_START.md`
- **Architecture:** `README.md` (Platinum section)
- **Implementation Summary:** `PLATINUM_TIER_IMPLEMENTATION_SUMMARY.md`

---

**Congratulations! You're now running a 24/7 AI Employee in the cloud!** 🎉

The system will:
- ✅ Monitor emails even when your laptop is off
- ✅ Draft replies autonomously
- ✅ Wait for your approval
- ✅ Execute securely from local machine
- ✅ Maintain complete audit trail

**You've achieved Platinum Tier!** 🏆
