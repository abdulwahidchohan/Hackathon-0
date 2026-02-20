---
description: Build the Personal AI Employee (Digital FTE) System
---

This workflow automates the setup of the "Digital FTE" architecture requested by the Hackathon 0 guide, laying down the Vault, Environment, Python watcher scripts, and orchestration mechanics.

// turbo-all

1. Set up the Vault Directory Structure
Create the default `AI_Employee_Vault` folder hierarchy where the AI will read and write its tasks.
```powershell
New-Item -ItemType Directory -Force -Path AI_Employee_Vault\Needs_Action
New-Item -ItemType Directory -Force -Path AI_Employee_Vault\Pending_Approval
New-Item -ItemType Directory -Force -Path AI_Employee_Vault\Approved
New-Item -ItemType Directory -Force -Path AI_Employee_Vault\Logs
New-Item -ItemType Directory -Force -Path AI_Employee_Vault\scripts
```

2. Initialize Environment Configuration
Create the `.env` file containing placeholders for external services and the `VAULT_PATH`. Also, set up a basic `.gitignore` so no secrets are accidentally committed.
```powershell
Set-Content -Path .env -Value "GMAIL_CLIENT_ID=your_client_id`nGMAIL_CLIENT_SECRET=your_client_secret`nBANK_API_TOKEN=your_token`nWHATSAPP_SESSION_PATH=/secure/path/session`nVAULT_PATH=.\AI_Employee_Vault`nDRY_RUN=true"
Set-Content -Path .gitignore -Value ".env`n__pycache__/`nvenv/`n.venv/`n*.log`nAI_Employee_Vault/Logs/`nAI_Employee_Vault/Pending_Approval/`nAI_Employee_Vault/Approved/`nAI_Employee_Vault/Needs_Action/"
```

3. Set up Python Environment
Create a virtual environment, activate it, and install required dependencies like playwright and watchdog.
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib playwright watchdog
playwright install chromium
```

4. Create Core Vault Markdown Files
Use your `write_to_file` tool to generate:
- `AI_Employee_Vault\Dashboard.md` (Real-time summary of systems, balances, and tasks)
- `AI_Employee_Vault\Company_Handbook.md` (System prompts and rules of engagement for the FTE)

5. Generate Watcher Scripts
Use your `write_to_file` tool to implement the Python sensory layer inside `AI_Employee_Vault\scripts\`:
- `base_watcher.py` (Abstract base class for all watchers, polling for updates and dropping `.md` events in `Needs_Action\`)
- `gmail_watcher.py` (Gmail API integration watcher)
- `whatsapp_watcher.py` (Playwright-based watcher monitoring `web.whatsapp.com`)
- `filesystem_watcher.py` (Watchdog-based drop folder handler)

6. Generate Orchestrator and Watchdog Scripts
Use your `write_to_file` tool to create the execution loop scripts in `AI_Employee_Vault\scripts\`:
- `orchestrator.py` (Validates authorized executions in `Approved\` and performs corresponding MCP calls or Python executions)
- `watchdog.py` (Checks the health of watcher and orchestrator processes, restarting them if down)

7. Finalize and Instruct User
Run a quick status check and inform the user that the skeleton is ready. Remind the user to:
- Fill out missing `.env` fields and get OAuth credentials.
- Add Model Context Protocol (MCP) integrations to Claude Code's config (e.g. `mcp.json`).
- Launch `watchdog.py` to start the FTE's autonomy loop.
