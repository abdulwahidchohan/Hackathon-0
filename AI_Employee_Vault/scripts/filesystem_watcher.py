import os
import shutil
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class DropFolderHandler(FileSystemEventHandler):
    def __init__(self, vault_path: str):
        self.vault_path = Path(vault_path)
        self.needs_action = self.vault_path / 'Needs_Action'
        self.needs_action.mkdir(parents=True, exist_ok=True)
        
    def on_created(self, event):
        if event.is_directory:
            return
            
        source = Path(event.src_path)
        
        # Ignore our own action files or temporary downloads if they appear here
        if source.parent == self.needs_action or source.name.startswith('.'):
            return
            
        dest = self.needs_action / f'FILE_{source.name}'
        
        try:
            # Wait a moment to ensure file is fully written before copying
            time.sleep(1)
            shutil.copy2(source, dest)
            self.create_metadata(source, dest)
            print(f"Watchdog: Processed new file {source.name}")
        except Exception as e:
            print(f"Watchdog Error processing file {source.name}: {e}")
            
    def create_metadata(self, source: Path, dest: Path):
        meta_path = dest.with_suffix('.md')
        
        # Don't overwrite if it already exists (e.g., if copying an .md file directly)
        if meta_path.exists() and dest.suffix == '.md':
            # Append metadata to existing markdown
            with open(dest, 'r+', encoding='utf-8') as f:
                content = f.read()
                f.seek(0, 0)
                f.write(f'''---
type: file_drop
original_name: {source.name}
size: {source.stat().st_size}
---

{content}''')
            return

        # Otherwise create a new metadata wrapper file
        meta_path.write_text(f'''---
type: file_drop
original_name: {source.name}
size: {source.stat().st_size}
processed_time: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime())}
status: pending
---

## New File Dropped
- **Filename:** `{source.name}`
- **Size:** {source.stat().st_size} bytes
- **Location:** `[[FILE_{source.name}]]`

## Actions
- [ ] Analyze file contents
- [ ] Move file to appropriate project directory.
''', encoding='utf-8')

class FileSystemWatcher:
    """Wrapper to maintain consistency with BaseWatcher abstraction"""
    def __init__(self, vault_path: str, watch_dir: str = None):
        if not watch_dir:
             watch_dir = os.path.join(vault_path, "Inbox")
             
        self.watch_dir = Path(watch_dir)
        self.watch_dir.mkdir(parents=True, exist_ok=True)
        self.vault_path = vault_path
        self.handler = DropFolderHandler(vault_path)
        
    def run(self):
        observer = Observer()
        observer.schedule(self.handler, str(self.watch_dir), recursive=False)
        observer.start()
        print(f"FileSystemWatcher started, monitoring {self.watch_dir}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    vault = os.getenv('VAULT_PATH', '.')
    watcher = FileSystemWatcher(vault)
    watcher.run()
