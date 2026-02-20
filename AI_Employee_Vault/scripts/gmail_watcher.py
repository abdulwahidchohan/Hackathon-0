import os
import re
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from base_watcher import BaseWatcher
from datetime import datetime
from pathlib import Path

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

class GmailWatcher(BaseWatcher):
    def __init__(self, vault_path: str, token_path: str = 'token.json', credentials_path: str = 'credentials.json'):
        super().__init__(vault_path, check_interval=120)
        self.token_path = Path(vault_path) / 'scripts' / token_path
        self.credentials_path = Path(vault_path) / 'scripts' / credentials_path
        self.processed_ids = set()
        self.service = self._authenticate()
        
    def _authenticate(self):
        creds = None
        # The file token.json stores the user's access and refresh tokens, and is
        # created automatically when the authorization flow completes for the first
        # time.
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        
        # If there are no (valid) credentials available, let the user log in.
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                 if not os.path.exists(self.credentials_path):
                     self.logger.warning(f"Credentials file not found at {self.credentials_path}. Cannot authenticate Gmail.")
                     return None
                 
                 flow = InstalledAppFlow.from_client_secrets_file(
                     self.credentials_path, SCOPES)
                 creds = flow.run_local_server(port=0)
                 
            # Save the credentials for the next run
            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())
                
        return build('gmail', 'v1', credentials=creds)
        
    def check_for_updates(self) -> list:
        if not self.service:
            self.logger.warning("Gmail service is not authenticated. Skipping check.")
            return []
            
        try:
            results = self.service.users().messages().list(
                userId='me', q='is:unread is:important'
            ).execute()
            messages = results.get('messages', [])
            
            new_messages = [m for m in messages if m['id'] not in self.processed_ids]
            return new_messages
        except Exception as e:
            self.logger.error(f"Error fetching Gmail messages: {e}")
            return []
            
    def create_action_file(self, message) -> Path:
        try:
            msg = self.service.users().messages().get(
                userId='me', id=message['id'], format='full'
            ).execute()
            
            # Extract headers
            headers = msg['payload'].get('headers', [])
            header_dict = {h['name']: h['value'] for h in headers}
            
            subject = header_dict.get('Subject', 'No Subject')
            sender = header_dict.get('From', 'Unknown')
            
            # Clean subject for filename
            clean_subject = re.sub(r'[^a-zA-Z0-9_\s]', '', subject).strip().replace(' ', '_')[:30]
            if not clean_subject:
                clean_subject = "Email"
                
            snippet = msg.get('snippet', '')
            
            content = f'''---
type: email
from: {sender}
subject: {subject}
received: {datetime.now().isoformat()}
priority: high
status: pending
source_id: {message['id']}
---

## Email Content
{snippet}

## Suggested Actions
- [ ] Reply to sender
- [ ] Forward to relevant party
- [ ] Archive after processing
'''
            filepath = self.needs_action / f'EMAIL_{clean_subject}_{message["id"][:8]}.md'
            filepath.write_text(content, encoding='utf-8')
            self.processed_ids.add(message['id'])
            self.logger.info(f"Created action file for email: {subject}")
            return filepath
            
        except Exception as e:
            self.logger.error(f"Error creating action file for message {message.get('id')}: {e}")
            return None

if __name__ == '__main__':
    # Simple test execution
    import sys
    from dotenv import load_dotenv
    load_dotenv()
    
    vault = os.getenv('VAULT_PATH', '.')
    watcher = GmailWatcher(vault)
    watcher.run()
