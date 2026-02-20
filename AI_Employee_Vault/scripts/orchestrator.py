import os
import shutil
import json
import logging
import time
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

class Orchestrator:
    def __init__(self, vault_path: str):
        self.vault_path = Path(vault_path)
        self.approved_dir = self.vault_path / 'Approved'
        self.logs_dir = self.vault_path / 'Logs'
        self.needs_action_dir = self.vault_path / 'Needs_Action'
        
        self.approved_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger('Orchestrator')
        
        self.dry_run = os.getenv('DRY_RUN', 'true').lower() == 'true'
        
    def parse_markdown_metadata(self, file_path: Path) -> dict:
        """Extracts YAML frontmatter from markdown files."""
        metadata = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            in_frontmatter = False
            for line in lines:
                if line.strip() == '---':
                    if in_frontmatter:
                        break # End of frontmatter
                    else:
                        in_frontmatter = True
                        continue
                        
                if in_frontmatter and ':' in line:
                    key, val = line.split(':', 1)
                    metadata[key.strip()] = val.strip()
        except Exception as e:
            self.logger.error(f"Error parsing metadata from {file_path.name}: {e}")
            
        return metadata

    def mock_send_email(self, metadata: dict) -> bool:
        """Simulates MCP email action"""
        target = metadata.get('target', 'unknown@domain.com')
        self.logger.info(f"[{'DRY RUN' if self.dry_run else 'ACTION'}] Sending email to: {target}")
        time.sleep(1) # Simulate network time
        return True
        
    def mock_make_payment(self, metadata: dict) -> bool:
        """Simulates MCP payment action"""
        amount = metadata.get('amount', '0.00')
        recipient = metadata.get('recipient', 'Unknown')
        self.logger.info(f"[{'DRY RUN' if self.dry_run else 'ACTION'}] Initiating payment of ${amount} to {recipient}")
        time.sleep(2)
        return True

    def move_to_done(self, file_path: Path):
        """Archives the completed instruction."""
        done_dir = self.vault_path / 'Archive' / datetime.now().strftime('%Y-%m')
        done_dir.mkdir(parents=True, exist_ok=True)
        try:
             shutil.move(str(file_path), str(done_dir / file_path.name))
        except Exception as e:
             self.logger.error(f"Failed to move file to done: {e}")
             
    def move_to_rejected(self, file_path: Path):
         """Moves failed or rejected instructions."""
         rejected_dir = self.vault_path / 'Rejected'
         rejected_dir.mkdir(parents=True, exist_ok=True)
         try:
              shutil.move(str(file_path), str(rejected_dir / file_path.name))
         except Exception as e:
              self.logger.error(f"Failed to move file to rejected: {e}")

    def log_action(self, action_type: str, status: str, details: dict):
        """Appends action to the daily JSON log."""
        log_file = self.logs_dir / f"{datetime.now().strftime('%Y-%m-%d')}.json"
        
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action_type": action_type,
            "actor": "claude_code_orchestrator",
            "approval_status": status,
            "details": details,
            "dry_run": self.dry_run
        }
        
        try:
            logs = []
            if log_file.exists():
                with open(log_file, 'r') as f:
                     content = f.read().strip()
                     if content:
                          try:
                              logs = json.loads(content)
                          except json.JSONDecodeError:
                              pass # Start fresh if corrupted
            
            # Ensure it's a list
            if not isinstance(logs, list):
                logs = []
                
            logs.append(log_entry)
            
            with open(log_file, 'w') as f:
                json.dump(logs, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Failed to write log: {e}")

    def process_approved_file(self, file_path: Path):
        """Processes human-approved actions."""
        metadata = self.parse_markdown_metadata(file_path)
        action_type = metadata.get("action", "unknown")
        
        self.logger.info(f"Processing approved file: {file_path.name} (Action: {action_type})")
        
        success = False
        try:
            if action_type == "send_email":
                success = self.mock_send_email(metadata)
            elif action_type == "payment":
                success = self.mock_make_payment(metadata)
            else:
                 self.logger.warning(f"Unknown action type: {action_type}. Taking no action.")
                 success = True # Acknowledge that we processed it
            
            if success:
                self.move_to_done(file_path)
                self.log_action(action_type, "SUCCESS", metadata)
            else:
                 self.log_action(action_type, "FAILED_EXECUTION", metadata)
                 self.move_to_rejected(file_path)
                 
        except Exception as e:
            self.logger.error(f"Error processing {file_path.name}: {e}")
            self.log_action(action_type, "ERROR", {"error": str(e), **metadata})
            self.move_to_rejected(file_path)

    def run(self):
        self.logger.info(f"Orchestrator started. Watching: {self.approved_dir}")
        self.logger.info(f"Mode: {'DRY RUN (No real actions)' if self.dry_run else 'PRODUCTION (Executing Actions)'}")
        
        while True:
            try:
                # Find all markdown files in the approved directory
                for file_path in self.approved_dir.glob("*.md"):
                    self.process_approved_file(file_path)
                    
            except Exception as e:
                 self.logger.error(f"Main loop error: {e}")
                 
            time.sleep(5)  # Polling interval

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    vault = os.getenv('VAULT_PATH', '.')
    orchestrator = Orchestrator(vault)
    orchestrator.run()
