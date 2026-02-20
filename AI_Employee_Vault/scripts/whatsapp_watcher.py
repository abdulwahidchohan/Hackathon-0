import os
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from base_watcher import BaseWatcher

class WhatsAppWatcher(BaseWatcher):
    def __init__(self, vault_path: str, session_path: str = None):
        super().__init__(vault_path, check_interval=60)
        
        # Determine session path from kwargs or environment
        if not session_path:
            session_path = os.getenv('WHATSAPP_SESSION_PATH', './whatsapp_session')
            
        self.session_path = Path(session_path)
        self.session_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.keywords = ['urgent', 'asap', 'invoice', 'payment', 'help', 'proposal']
        
    def check_for_updates(self) -> list:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch_persistent_context(
                    user_data_dir=self.session_path,
                    headless=os.getenv('HEADLESS', 'true').lower() == 'true',
                    args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                )
                
                page = browser.pages[0] if browser.pages else browser.new_page()
                page.set_default_timeout(30000) # 30 seconds
                page.goto('https://web.whatsapp.com')
                
                # Check for login QR code vs actual chat list
                try:
                    page.wait_for_selector('[data-testid="chat-list"]', timeout=30000)
                    self.logger.info("WhatsApp Web loaded and authenticated.")
                except Exception as e:
                    self.logger.warning("WhatsApp Web not authenticated or loading too slow. Please run manually first to scan QR.")
                    browser.close()
                    return []
                    
                # Find unread messages
                unread = page.query_selector_all('[aria-label*="unread"]')
                messages = []
                
                for chat in unread:
                    try:
                        # Extract chat title (Contact Name)
                        title_el = chat.query_selector('.x1iyjqo2, .ggj6brxn, .gfz4du6o')
                        title = title_el.inner_text() if title_el else "Unknown Contact"
                        
                        # Extract brief text
                        text = chat.inner_text().lower()
                        
                        if any(kw in text for kw in self.keywords):
                            messages.append({
                                'contact': title,
                                'text': text,
                                'timestamp': time.time(),
                                'raw_element': chat
                            })
                    except Exception as loop_e:
                        self.logger.error(f"Error parsing individual chat message: {loop_e}")
                        
                browser.close()
                return messages
                
        except Exception as e:
            self.logger.error(f"Playwright execution error during WhatsApp check: {e}")
            return []
            
    def create_action_file(self, message) -> Path:
        contact_safe = "".join(c for c in message.get('contact', 'Unknown') if c.isalnum()).strip()
        timestamp = time.strftime('%Y%m%d_%H%M%S', time.localtime(message.get('timestamp')))
        
        content = f'''---
type: whatsapp_message
from: {message.get('contact', 'Unknown')}
received: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime(message.get('timestamp')))}
auto_triggered_by: keywords
status: pending
---

## WhatsApp Context
**Sender:** {message.get('contact', 'Unknown')}
**Preview:** {message.get('text', '')[:200]}

## Suggested Actions
- [ ] Reply to sender via WhatsApp MCP
- [ ] Draft an invoice/proposal
'''
        filepath = self.needs_action / f'WHATSAPP_{contact_safe}_{timestamp}.md'
        try:
            filepath.write_text(content, encoding='utf-8')
            self.logger.info(f"Created WhatsApp action file for {message.get('contact', 'Unknown')}.")
            return filepath
        except Exception as e:
            self.logger.error(f"Failed to write WhatsApp action file: {e}")
            return None

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    vault = os.getenv('VAULT_PATH', '.')
    watcher = WhatsAppWatcher(vault)
    watcher.run()
