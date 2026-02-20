/**
 * Claim-by-Move Protocol Implementation
 * Prevents duplicate work between cloud and local agents
 * Uses atomic file moves to claim tasks
 */

const fs = require('fs');
const path = require('path');

class ClaimByMoveProtocol {
  constructor(vaultPath, agentId) {
    this.vaultPath = vaultPath;
    this.agentId = agentId; // 'cloud' or 'local'
    this.inProgressPath = path.join(vaultPath, 'In_Progress', agentId);

    // Ensure In_Progress directory exists
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [
      path.join(this.vaultPath, 'In_Progress'),
      this.inProgressPath
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Attempt to claim a task atomically
   * @param {string} taskPath - Path to task file in Needs_Action
   * @returns {Object} - { claimed: boolean, targetPath: string, reason: string }
   */
  claimTask(taskPath) {
    try {
      const fileName = path.basename(taskPath);
      const targetPath = path.join(this.inProgressPath, fileName);

      // Check if file exists first
      if (!fs.existsSync(taskPath)) {
        return {
          claimed: false,
          targetPath: null,
          reason: 'file_not_found',
          message: `Task file ${taskPath} does not exist`
        };
      }

      // Attempt atomic rename (claim)
      try {
        fs.renameSync(taskPath, targetPath);

        console.log(`[${this.agentId}] ✅ Claimed task: ${fileName}`);

        return {
          claimed: true,
          targetPath: targetPath,
          reason: 'success',
          message: `Successfully claimed task: ${fileName}`
        };
      } catch (renameError) {
        if (renameError.code === 'ENOENT') {
          // File was already moved by another agent
          return {
            claimed: false,
            targetPath: null,
            reason: 'already_claimed',
            message: `Task ${fileName} was already claimed by another agent`
          };
        }
        throw renameError;
      }
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error claiming task:`, error);
      return {
        claimed: false,
        targetPath: null,
        reason: 'error',
        message: error.message
      };
    }
  }

  /**
   * Release a claimed task (move to Done or back to Needs_Action)
   * @param {string} taskPath - Path to task in In_Progress
   * @param {string} status - 'completed' or 'failed'
   * @returns {Object} - { released: boolean, message: string }
   */
  releaseTask(taskPath, status = 'completed') {
    try {
      const fileName = path.basename(taskPath);

      let targetDir;
      if (status === 'completed') {
        targetDir = path.join(this.vaultPath, 'Done');
      } else {
        targetDir = path.join(this.vaultPath, 'Needs_Action');
      }

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, fileName);

      // Move file
      fs.renameSync(taskPath, targetPath);

      console.log(`[${this.agentId}] ✅ Released task to ${status}: ${fileName}`);

      return {
        released: true,
        targetPath: targetPath,
        message: `Task ${fileName} moved to ${status}`
      };
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error releasing task:`, error);
      return {
        released: false,
        targetPath: null,
        message: error.message
      };
    }
  }

  /**
   * Scan Needs_Action for available tasks
   * @param {string} domain - Optional domain filter (e.g., 'email', 'social')
   * @returns {Array} - List of available task paths
   */
  scanAvailableTasks(domain = null) {
    try {
      const needsActionPath = path.join(this.vaultPath, 'Needs_Action');

      if (!fs.existsSync(needsActionPath)) {
        return [];
      }

      let tasks = [];

      if (domain) {
        // Scan specific domain subdirectory
        const domainPath = path.join(needsActionPath, domain);
        if (fs.existsSync(domainPath)) {
          const files = fs.readdirSync(domainPath)
            .filter(file => file.endsWith('.md'))
            .map(file => path.join(domainPath, file));
          tasks = tasks.concat(files);
        }
      } else {
        // Scan all items in Needs_Action (including subdirectories)
        const scanRecursive = (dir) => {
          const items = fs.readdirSync(dir, { withFileTypes: true });

          items.forEach(item => {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
              scanRecursive(fullPath);
            } else if (item.isFile() && item.name.endsWith('.md')) {
              tasks.push(fullPath);
            }
          });
        };

        scanRecursive(needsActionPath);
      }

      return tasks;
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error scanning tasks:`, error);
      return [];
    }
  }

  /**
   * Get tasks currently claimed by this agent
   * @returns {Array} - List of claimed task paths
   */
  getClaimedTasks() {
    try {
      if (!fs.existsSync(this.inProgressPath)) {
        return [];
      }

      return fs.readdirSync(this.inProgressPath)
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(this.inProgressPath, file));
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error getting claimed tasks:`, error);
      return [];
    }
  }

  /**
   * Check if a specific task is already claimed by any agent
   * @param {string} fileName - Name of the task file
   * @returns {Object} - { isClaimed: boolean, claimedBy: string }
   */
  isTaskClaimed(fileName) {
    try {
      const inProgressDir = path.join(this.vaultPath, 'In_Progress');

      if (!fs.existsSync(inProgressDir)) {
        return { isClaimed: false, claimedBy: null };
      }

      // Check both cloud and local agent directories
      const agents = ['cloud', 'local'];

      for (const agent of agents) {
        const agentInProgress = path.join(inProgressDir, agent, fileName);
        if (fs.existsSync(agentInProgress)) {
          return { isClaimed: true, claimedBy: agent };
        }
      }

      return { isClaimed: false, claimedBy: null };
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Error checking task claim:`, error);
      return { isClaimed: false, claimedBy: null };
    }
  }
}

// Example usage
if (require.main === module) {
  const vaultPath = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');
  const agentId = process.env.AGENT_ID || 'local';

  const protocol = new ClaimByMoveProtocol(vaultPath, agentId);

  console.log('\n🔍 Claim-by-Move Protocol Demo\n');
  console.log('Agent ID:', agentId);
  console.log('Vault Path:', vaultPath);
  console.log('');

  // Scan for available tasks
  console.log('📋 Scanning for available tasks...');
  const availableTasks = protocol.scanAvailableTasks();
  console.log(`Found ${availableTasks.length} tasks`);
  console.log('');

  if (availableTasks.length > 0) {
    // Try to claim the first task
    const taskToClaim = availableTasks[0];
    console.log(`🎯 Attempting to claim: ${path.basename(taskToClaim)}`);

    const result = protocol.claimTask(taskToClaim);
    console.log('Result:', result);
    console.log('');
  }

  // Show currently claimed tasks
  console.log('📂 Tasks claimed by this agent:');
  const claimedTasks = protocol.getClaimedTasks();
  claimedTasks.forEach(task => {
    console.log(`  - ${path.basename(task)}`);
  });
  console.log('');
}

module.exports = ClaimByMoveProtocol;
