/**
 * Vault Synchronization Script
 * Git-based synchronization between cloud and local agents
 * Handles automatic commit, push, pull with conflict resolution
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class VaultSync {
  constructor(vaultPath, agentId) {
    this.vaultPath = vaultPath;
    this.agentId = agentId; // 'cloud' or 'local'
    this.gitRemote = process.env.GIT_REMOTE || 'origin';
    this.gitBranch = process.env.GIT_BRANCH || 'main';
    this.conflictStrategy = process.env.CONFLICT_STRATEGY || 'local-wins';

    // Files/directories that should never be synced
    this.syncExclusions = [
      '.env',
      '.env.local',
      '.env.cloud',
      '.linkedin_token.json',
      'credentials.json',
      '.whatsapp-session',
      'whatsapp-session/',
      'node_modules/',
      '.git/',
      'temp/',
      '*.log',
      '.DS_Store'
    ];
  }

  /**
   * Execute a git command in the vault directory
   * @param {string} command - Git command to execute
   * @returns {string} - Command output
   */
  gitExec(command) {
    try {
      const output = execSync(command, {
        cwd: this.vaultPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return output.trim();
    } catch (error) {
      console.error(`[${this.agentId}] Git command failed:`, command);
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if vault is a git repository
   * @returns {boolean}
   */
  isGitRepo() {
    try {
      this.gitExec('git rev-parse --git-dir');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize git repository if not exists
   */
  initGitRepo() {
    if (!this.isGitRepo()) {
      console.log(`[${this.agentId}] Initializing git repository...`);
      this.gitExec('git init');
      this.gitExec(`git remote add ${this.gitRemote} ${process.env.GIT_REPO_URL}`);
      this.gitExec(`git config user.name "AI Employee ${this.agentId}"`);
      this.gitExec(`git config user.email "${this.agentId}-agent@ai-employee.local"`);

      // Create .gitignore
      const gitignorePath = path.join(this.vaultPath, '.gitignore');
      fs.writeFileSync(gitignorePath, this.syncExclusions.join('\n'));

      console.log(`[${this.agentId}] ✅ Git repository initialized`);
    }
  }

  /**
   * Stage changes for commit
   * @returns {boolean} - True if there are changes to commit
   */
  stageChanges() {
    try {
      // Add all tracked and new files (respecting .gitignore)
      this.gitExec('git add -A');

      // Check if there are staged changes
      const status = this.gitExec('git status --porcelain');

      if (!status) {
        console.log(`[${this.agentId}] No changes to commit`);
        return false;
      }

      console.log(`[${this.agentId}] Staged changes:`);
      console.log(status);

      return true;
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error staging changes:`, error.message);
      return false;
    }
  }

  /**
   * Commit staged changes
   * @param {string} message - Commit message
   * @returns {boolean} - True if commit successful
   */
  commit(message = null) {
    try {
      if (!message) {
        message = `[${this.agentId}] Auto-sync: ${new Date().toISOString()}`;
      }

      this.gitExec(`git commit -m "${message}"`);
      console.log(`[${this.agentId}] ✅ Committed: ${message}`);

      return true;
    } catch (error) {
      // Commit might fail if there are no changes
      if (error.message.includes('nothing to commit')) {
        console.log(`[${this.agentId}] Nothing to commit`);
        return false;
      }
      console.error(`[${this.agentId}] ❌ Commit failed:`, error.message);
      return false;
    }
  }

  /**
   * Pull changes from remote
   * @returns {boolean} - True if pull successful
   */
  pull() {
    try {
      console.log(`[${this.agentId}] Pulling changes from ${this.gitRemote}/${this.gitBranch}...`);

      // Fetch remote changes
      this.gitExec(`git fetch ${this.gitRemote} ${this.gitBranch}`);

      // Check if we're behind
      const localCommit = this.gitExec('git rev-parse HEAD');
      const remoteCommit = this.gitExec(`git rev-parse ${this.gitRemote}/${this.gitBranch}`);

      if (localCommit === remoteCommit) {
        console.log(`[${this.agentId}] Already up to date`);
        return true;
      }

      // Pull with merge strategy
      try {
        this.gitExec(`git pull ${this.gitRemote} ${this.gitBranch} --no-edit`);
        console.log(`[${this.agentId}] ✅ Pulled changes successfully`);
        return true;
      } catch (pullError) {
        // Handle merge conflicts
        if (pullError.message.includes('CONFLICT')) {
          console.log(`[${this.agentId}] ⚠️  Merge conflict detected`);
          return this.handleMergeConflict();
        }
        throw pullError;
      }
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Pull failed:`, error.message);
      return false;
    }
  }

  /**
   * Push changes to remote
   * @returns {boolean} - True if push successful
   */
  push() {
    try {
      console.log(`[${this.agentId}] Pushing changes to ${this.gitRemote}/${this.gitBranch}...`);

      this.gitExec(`git push ${this.gitRemote} ${this.gitBranch}`);

      console.log(`[${this.agentId}] ✅ Pushed changes successfully`);
      return true;
    } catch (error) {
      if (error.message.includes('rejected')) {
        console.log(`[${this.agentId}] ⚠️  Push rejected, pulling first...`);
        if (this.pull()) {
          return this.push(); // Retry push after pull
        }
      }
      console.error(`[${this.agentId}] ❌ Push failed:`, error.message);
      return false;
    }
  }

  /**
   * Handle merge conflicts based on configured strategy
   * @returns {boolean} - True if conflict resolved
   */
  handleMergeConflict() {
    try {
      console.log(`[${this.agentId}] Resolving merge conflict with strategy: ${this.conflictStrategy}`);

      if (this.conflictStrategy === 'local-wins') {
        // Keep local version
        this.gitExec('git checkout --ours .');
        this.gitExec('git add -A');
        this.gitExec('git commit --no-edit');
        console.log(`[${this.agentId}] ✅ Conflict resolved (local version kept)`);
        return true;
      } else if (this.conflictStrategy === 'remote-wins') {
        // Keep remote version
        this.gitExec('git checkout --theirs .');
        this.gitExec('git add -A');
        this.gitExec('git commit --no-edit');
        console.log(`[${this.agentId}] ✅ Conflict resolved (remote version kept)`);
        return true;
      } else {
        // Manual resolution required
        console.error(`[${this.agentId}] ❌ Manual conflict resolution required`);
        return false;
      }
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Conflict resolution failed:`, error.message);
      return false;
    }
  }

  /**
   * Full sync cycle: pull, commit, push
   * @param {string} commitMessage - Optional commit message
   * @returns {Object} - Sync result
   */
  sync(commitMessage = null) {
    console.log(`\n[${this.agentId}] 🔄 Starting vault synchronization...`);

    const result = {
      success: false,
      pulled: false,
      committed: false,
      pushed: false,
      errors: []
    };

    try {
      // Ensure git repo is initialized
      this.initGitRepo();

      // Step 1: Pull remote changes first
      result.pulled = this.pull();
      if (!result.pulled) {
        result.errors.push('Pull failed');
      }

      // Step 2: Stage and commit local changes
      if (this.stageChanges()) {
        result.committed = this.commit(commitMessage);
        if (!result.committed) {
          result.errors.push('Commit failed');
        }
      } else {
        result.committed = false; // No changes to commit
      }

      // Step 3: Push changes to remote
      if (result.committed) {
        result.pushed = this.push();
        if (!result.pushed) {
          result.errors.push('Push failed');
        }
      } else {
        result.pushed = false; // Nothing to push
      }

      // Overall success if no critical errors
      result.success = result.pulled && (!result.committed || result.pushed);

      if (result.success) {
        console.log(`[${this.agentId}] ✅ Vault synchronization completed`);
      } else {
        console.log(`[${this.agentId}] ⚠️  Vault synchronization completed with issues`);
      }

    } catch (error) {
      console.error(`[${this.agentId}] ❌ Sync failed:`, error.message);
      result.errors.push(error.message);
    }

    console.log('');
    return result;
  }

  /**
   * Get sync status information
   * @returns {Object} - Status information
   */
  getStatus() {
    try {
      const status = {
        branch: this.gitExec('git branch --show-current'),
        hasUncommittedChanges: false,
        ahead: 0,
        behind: 0,
        lastCommit: null
      };

      // Check for uncommitted changes
      const uncommittedStatus = this.gitExec('git status --porcelain');
      status.hasUncommittedChanges = uncommittedStatus.length > 0;

      // Check ahead/behind status
      try {
        const aheadBehind = this.gitExec(`git rev-list --left-right --count ${this.gitRemote}/${this.gitBranch}...HEAD`);
        const [behind, ahead] = aheadBehind.split('\t').map(Number);
        status.ahead = ahead;
        status.behind = behind;
      } catch (error) {
        // Remote might not exist yet
      }

      // Get last commit
      try {
        status.lastCommit = this.gitExec('git log -1 --pretty=format:"%h - %s (%cr)"');
      } catch (error) {
        // No commits yet
      }

      return status;
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error getting status:`, error.message);
      return null;
    }
  }
}

// Example usage and CLI
if (require.main === module) {
  const vaultPath = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');
  const agentId = process.env.AGENT_ID || 'local';

  const vaultSync = new VaultSync(vaultPath, agentId);

  console.log('\n📦 Vault Synchronization Tool\n');
  console.log('Agent ID:', agentId);
  console.log('Vault Path:', vaultPath);
  console.log('');

  // Get current status
  const status = vaultSync.getStatus();
  if (status) {
    console.log('📊 Current Status:');
    console.log(`  Branch: ${status.branch}`);
    console.log(`  Uncommitted changes: ${status.hasUncommittedChanges ? 'Yes' : 'No'}`);
    console.log(`  Ahead: ${status.ahead} commits`);
    console.log(`  Behind: ${status.behind} commits`);
    if (status.lastCommit) {
      console.log(`  Last commit: ${status.lastCommit}`);
    }
    console.log('');
  }

  // Perform sync
  const result = vaultSync.sync();

  console.log('📋 Sync Result:');
  console.log(`  Success: ${result.success ? '✅' : '❌'}`);
  console.log(`  Pulled: ${result.pulled ? '✅' : '❌'}`);
  console.log(`  Committed: ${result.committed ? '✅' : 'No changes'}`);
  console.log(`  Pushed: ${result.pushed ? '✅' : result.committed ? '❌' : 'Nothing to push'}`);

  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }

  console.log('');
}

module.exports = VaultSync;
