import os
import subprocess
import time
import psutil
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('Watchdog')

# Configuration of processes to monitor
PROCESSES = {
    'orchestrator': 'python scripts/orchestrator.py',
    'gmail_watcher': 'python scripts/gmail_watcher.py',
    'filesystem_watcher': 'python scripts/filesystem_watcher.py',
    # 'whatsapp_watcher': 'python scripts/whatsapp_watcher.py', # Uncomment if needed
}

def is_process_running(pid_file: Path) -> bool:
    """Checks if a process with the PID in the given file is currently running."""
    if not pid_file.exists():
        return False
        
    try:
        pid = int(pid_file.read_text().strip())
        process = psutil.Process(pid)
        return process.is_running() and process.status() != psutil.STATUS_ZOMBIE
    except (ValueError, psutil.NoSuchProcess):
        return False

def check_and_restart():
    """Iterates through monitored processes and restarts them if they are down."""
    import sys
    
    vault_path = os.getenv('VAULT_PATH', '.')
    tmp_path = Path(vault_path) / 'scripts' / '.pids'
    tmp_path.mkdir(parents=True, exist_ok=True)
    
    for name, cmd in PROCESSES.items():
        pid_file = tmp_path / f'{name}.pid'
        
        if not is_process_running(pid_file):
            logger.warning(f'CRITICAL: {name} not running. Starting...')
            
            try:
                # Use sub-process to run the commands from the root directory
                # so relative paths in Python work correctly
                root_cwd = Path(vault_path)
                
                # Split command string into args
                args = cmd.split()
                if sys.platform == "win32":
                    proc = subprocess.Popen(args, cwd=str(root_cwd))
                else:
                    # Unix process isolation
                    proc = subprocess.Popen(args, cwd=str(root_cwd), preexec_fn=os.setsid)
                    
                pid_file.write_text(str(proc.pid))
                logger.info(f"{name} successfully restarted with PID {proc.pid}")
                
            except Exception as e:
                logger.error(f"Failed to start {name}: {e}")

def run_watchdog():
    logger.info("Starting System Watchdog. Monitoring AI Employee background processes...")
    try:
        while True:
            check_and_restart()
            time.sleep(60) # Check every 60 seconds
    except KeyboardInterrupt:
        logger.info("Watchdog shutting down.")

if __name__ == '__main__':
    from dotenv import load_dotenv
    # Allow running from anywhere by assuming .env is in parent directory
    # or VAULT_PATH is set
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
        
    run_watchdog()
