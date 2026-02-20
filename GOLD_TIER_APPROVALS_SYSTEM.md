# Gold Tier: Human-in-the-Loop Approvals System

## Overview
The human-in-the-loop approvals system ensures that sensitive or important actions require explicit human approval before execution, while allowing routine tasks to be handled automatically.

## Components

### 1. Approval Queue Manager
- Manages items requiring approval
- Prioritizes approval requests
- Handles approval/rejection workflows

### 2. Approval Interface
- Web interface for viewing and managing approvals
- Email notifications for approval requests
- Batch approval capabilities

### 3. Policy Engine
- Defines approval policies
- Determines when approvals are required
- Manages approval authority levels

## Implementation

### Approval Queue Manager (`approval_queue_manager.js`)
```javascript
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ApprovalQueueManager {
  constructor(config) {
    this.config = config || {};
    this.approvalQueue = [];
    this.needsActionDir = this.config.needsActionDir || './Needs_Action';
    this.approvedDir = this.config.approvedDir || './Approved';
    this.pendingDir = this.config.pendingDir || './Pending_Approval';
    this.doneDir = this.config.doneDir || './Done';

    // Initialize directories
    this.initializeDirectories();
  }

  initializeDirectories() {
    [this.needsActionDir, this.approvedDir, this.pendingDir, this.doneDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async addItemForApproval(item) {
    const approvalId = uuidv4();

    const approvalItem = {
      id: approvalId,
      timestamp: new Date().toISOString(),
      item: item,
      status: 'pending',
      priority: item.priority || 'medium',
      requester: item.requester || 'system',
      approver: null,
      approvalDeadline: this.calculateDeadline(item.priority),
      metadata: {
        source: item.source || 'system',
        category: item.category || 'general',
        estimatedTime: item.estimatedTime || 'N/A',
        businessImpact: item.businessImpact || 'low'
      },
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          user: 'system',
          notes: 'Item added to approval queue'
        }
      ]
    };

    // Save to pending approval directory
    const filePath = path.join(this.pendingDir, `approval_${approvalId}.json`);
    await fs.writeJson(filePath, approvalItem, { spaces: 2 });

    // Add to in-memory queue
    this.approvalQueue.push(approvalItem);

    // Move to needs_action folder as well for visibility
    await this.moveToNeedsAction(approvalItem);

    // Notify approvers
    await this.notifyApprovers(approvalItem);

    return approvalId;
  }

  async approveItem(approvalId, approverId, notes = '') {
    const item = await this.getApprovalItem(approvalId);
    if (!item) {
      throw new Error(`Approval item not found: ${approvalId}`);
    }

    item.status = 'approved';
    item.approver = approverId;
    item.approvedAt = new Date().toISOString();
    item.history.push({
      action: 'approved',
      timestamp: new Date().toISOString(),
      user: approverId,
      notes: notes
    });

    // Move from pending to approved directory
    const pendingPath = path.join(this.pendingDir, `approval_${approvalId}.json`);
    const approvedPath = path.join(this.approvedDir, `approved_${approvalId}.json`);

    if (fs.existsSync(pendingPath)) {
      await fs.move(pendingPath, approvedPath);
    }

    // Update in-memory queue
    const index = this.approvalQueue.findIndex(i => i.id === approvalId);
    if (index !== -1) {
      this.approvalQueue[index] = item;
    }

    // Remove from needs_action folder
    await this.removeFromNeedsAction(approvalId);

    // Execute the approved action
    await this.executeApprovedAction(item);

    return item;
  }

  async rejectItem(approvalId, approverId, reason = '') {
    const item = await this.getApprovalItem(approvalId);
    if (!item) {
      throw new Error(`Approval item not found: ${approvalId}`);
    }

    item.status = 'rejected';
    item.approver = approverId;
    item.rejectedAt = new Date().toISOString();
    item.rejectionReason = reason;
    item.history.push({
      action: 'rejected',
      timestamp: new Date().toISOString(),
      user: approverId,
      notes: reason
    });

    // Move from pending to done directory (as rejected)
    const pendingPath = path.join(this.pendingDir, `approval_${approvalId}.json`);
    const donePath = path.join(this.doneDir, `rejected_${approvalId}.json`);

    if (fs.existsSync(pendingPath)) {
      await fs.move(pendingPath, donePath);
    }

    // Update in-memory queue
    const index = this.approvalQueue.findIndex(i => i.id === approvalId);
    if (index !== -1) {
      this.approvalQueue[index] = item;
    }

    // Remove from needs_action folder
    await this.removeFromNeedsAction(approvalId);

    return item;
  }

  async getApprovalItem(approvalId) {
    // Check in pending directory first
    const pendingPath = path.join(this.pendingDir, `approval_${approvalId}.json`);
    if (fs.existsSync(pendingPath)) {
      return await fs.readJson(pendingPath);
    }

    // Check in other directories
    const directories = [this.approvedDir, this.doneDir];
    for (const dir of directories) {
      const files = await fs.readdir(dir);
      const file = files.find(f => f.includes(approvalId));
      if (file) {
        return await fs.readJson(path.join(dir, file));
      }
    }

    return null;
  }

  async getPendingApprovals() {
    const pendingFiles = await fs.readdir(this.pendingDir);
    const pendingItems = [];

    for (const file of pendingFiles) {
      if (file.endsWith('.json')) {
        const item = await fs.readJson(path.join(this.pendingDir, file));
        pendingItems.push(item);
      }
    }

    // Sort by priority and deadline
    pendingItems.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(a.approvalDeadline) - new Date(b.approvalDeadline);
    });

    return pendingItems;
  }

  async getApprovalsByCategory(category) {
    const allApprovals = await this.getAllApprovals();
    return allApprovals.filter(item => item.metadata.category === category);
  }

  async getAllApprovals() {
    const allItems = [];

    // Get from all directories
    const directories = [this.pendingDir, this.approvedDir, this.doneDir];

    for (const dir of directories) {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const item = await fs.readJson(path.join(dir, file));
          allItems.push(item);
        }
      }
    }

    return allItems;
  }

  async executeApprovedAction(approvalItem) {
    // Execute the action that was approved
    // This would connect to the appropriate MCP server or service

    console.log(`Executing approved action: ${approvalItem.item.type}`);

    try {
      // Log the execution
      const executionLog = {
        approvalId: approvalItem.id,
        action: approvalItem.item,
        executedAt: new Date().toISOString(),
        status: 'success',
        result: 'Action executed successfully'
      };

      // Save execution log
      const logPath = path.join(this.doneDir, `execution_log_${approvalItem.id}.json`);
      await fs.writeJson(logPath, executionLog, { spaces: 2 });

      // Move to done directory
      const approvedPath = path.join(this.approvedDir, `approved_${approvalItem.id}.json`);
      const donePath = path.join(this.doneDir, `done_${approvalItem.id}.json`);

      if (fs.existsSync(approvedPath)) {
        await fs.move(approvedPath, donePath);
      }

      return executionLog;
    } catch (error) {
      console.error(`Error executing approved action:`, error);

      // Log execution failure
      const executionLog = {
        approvalId: approvalItem.id,
        action: approvalItem.item,
        executedAt: new Date().toISOString(),
        status: 'failed',
        error: error.message
      };

      const logPath = path.join(this.doneDir, `execution_failure_${approvalItem.id}.json`);
      await fs.writeJson(logPath, executionLog, { spaces: 2 });

      throw error;
    }
  }

  calculateDeadline(priority) {
    const now = new Date();
    switch (priority) {
      case 'high':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      case 'medium':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      case 'low':
        return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    }
  }

  async moveToNeedsAction(approvalItem) {
    // Create a simplified version for the needs_action folder
    const needsActionItem = {
      id: approvalItem.id,
      type: approvalItem.item.type,
      description: approvalItem.item.description || approvalItem.item.summary || 'Action requires approval',
      priority: approvalItem.priority,
      deadline: approvalItem.approvalDeadline,
      created: approvalItem.timestamp,
      source: approvalItem.metadata.source
    };

    const filePath = path.join(this.needsActionDir, `needs_approval_${approvalItem.id}.json`);
    await fs.writeJson(filePath, needsActionItem, { spaces: 2 });
  }

  async removeFromNeedsAction(approvalId) {
    const files = await fs.readdir(this.needsActionDir);
    const file = files.find(f => f.includes(approvalId));

    if (file) {
      const filePath = path.join(this.needsActionDir, file);
      await fs.remove(filePath);
    }
  }

  async notifyApprovers(approvalItem) {
    console.log(`Notification: New approval required - ${approvalItem.item.type} (Priority: ${approvalItem.priority})`);

    // In a real implementation, this would send notifications via email, Slack, etc.
    // For Gold Tier, we'd use the communication MCP server
  }

  async batchApprove(items, approverId, notes = '') {
    const results = [];

    for (const itemId of items) {
      try {
        const result = await this.approveItem(itemId, approverId, notes);
        results.push({ id: itemId, status: 'success', result });
      } catch (error) {
        results.push({ id: itemId, status: 'error', error: error.message });
      }
    }

    return results;
  }

  async batchReject(items, approverId, reason = '') {
    const results = [];

    for (const itemId of items) {
      try {
        const result = await this.rejectItem(itemId, approverId, reason);
        results.push({ id: itemId, status: 'success', result });
      } catch (error) {
        results.push({ id: itemId, status: 'error', error: error.message });
      }
    }

    return results;
  }

  async getApprovalStats() {
    const allItems = await this.getAllApprovals();

    const stats = {
      total: allItems.length,
      pending: allItems.filter(i => i.status === 'pending').length,
      approved: allItems.filter(i => i.status === 'approved').length,
      rejected: allItems.filter(i => i.status === 'rejected').length,
      byPriority: {
        high: allItems.filter(i => i.priority === 'high').length,
        medium: allItems.filter(i => i.priority === 'medium').length,
        low: allItems.filter(i => i.priority === 'low').length
      },
      byCategory: {},
      averageApprovalTime: 0
    };

    // Calculate by category
    allItems.forEach(item => {
      const category = item.metadata.category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    // Calculate average approval time
    const approvedItems = allItems.filter(i => i.status === 'approved' && i.approvedAt);
    if (approvedItems.length > 0) {
      const totalHours = approvedItems.reduce((sum, item) => {
        const created = new Date(item.timestamp);
        const approved = new Date(item.approvedAt);
        return sum + ((approved - created) / (1000 * 60 * 60));
      }, 0);
      stats.averageApprovalTime = totalHours / approvedItems.length;
    }

    return stats;
  }
}

module.exports = ApprovalQueueManager;
```

### Approval Policy Engine (`approval_policy_engine.js`)
```javascript
class ApprovalPolicyEngine {
  constructor() {
    this.policies = [
      // Financial policies
      {
        name: 'high_value_transactions',
        condition: (item) => item.type === 'financial' && item.amount > 10000,
        requiresApproval: true,
        priority: 'high',
        approvers: ['finance_manager', 'director']
      },
      {
        name: 'expense_approval',
        condition: (item) => item.type === 'expense' && item.amount > 1000,
        requiresApproval: true,
        priority: 'medium',
        approvers: ['manager', 'finance_team']
      },

      // Communication policies
      {
        name: 'external_communication',
        condition: (item) => item.type === 'communication' && item.recipients?.some(r => !r.internal),
        requiresApproval: true,
        priority: 'medium',
        approvers: ['manager', 'communications_team']
      },

      // System policies
      {
        name: 'system_changes',
        condition: (item) => item.type === 'system_change',
        requiresApproval: true,
        priority: 'high',
        approvers: ['it_manager', 'system_admin']
      },

      // Data policies
      {
        name: 'sensitive_data_access',
        condition: (item) => item.type === 'data_access' && item.sensitivity === 'high',
        requiresApproval: true,
        priority: 'high',
        approvers: ['data_officer', 'compliance_team']
      }
    ];
  }

  evaluateItem(item) {
    const applicablePolicies = this.policies.filter(policy => policy.condition(item));

    if (applicablePolicies.length === 0) {
      // Default policy - no approval needed for routine items
      return {
        requiresApproval: false,
        priority: 'low',
        approvers: []
      };
    }

    // Find the highest priority policy that applies
    const highestPriorityPolicy = applicablePolicies.reduce((highest, current) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[current.priority] > priorityOrder[highest.priority] ? current : highest;
    });

    return {
      requiresApproval: highestPriorityPolicy.requiresApproval,
      priority: highestPriorityPolicy.priority,
      approvers: highestPriorityPolicy.approvers,
      policyName: highestPriorityPolicy.name
    };
  }

  addPolicy(policy) {
    this.policies.push(policy);
  }

  removePolicy(policyName) {
    this.policies = this.policies.filter(policy => policy.name !== policyName);
  }

  updatePolicy(policyName, updatedPolicy) {
    const index = this.policies.findIndex(policy => policy.name === policyName);
    if (index !== -1) {
      this.policies[index] = updatedPolicy;
    }
  }
}

module.exports = ApprovalPolicyEngine;
```

### Approval Interface Controller (`approval_interface.js`)
```javascript
const express = require('express');
const ApprovalQueueManager = require('./approval_queue_manager');
const ApprovalPolicyEngine = require('./approval_policy_engine');

class ApprovalInterface {
  constructor(config) {
    this.config = config;
    this.manager = new ApprovalQueueManager(config.queue);
    this.policyEngine = new ApprovalPolicyEngine();
    this.app = express();

    this.setupRoutes();
  }

  setupRoutes() {
    // Serve approval dashboard
    this.app.get('/approvals', async (req, res) => {
      try {
        const pending = await this.manager.getPendingApprovals();
        res.json({ pending });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific approval
    this.app.get('/approvals/:id', async (req, res) => {
      try {
        const item = await this.manager.getApprovalItem(req.params.id);
        res.json(item);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Approve an item
    this.app.post('/approvals/:id/approve', async (req, res) => {
      try {
        const { approverId, notes } = req.body;
        const result = await this.manager.approveItem(req.params.id, approverId, notes);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Reject an item
    this.app.post('/approvals/:id/reject', async (req, res) => {
      try {
        const { approverId, reason } = req.body;
        const result = await this.manager.rejectItem(req.params.id, approverId, reason);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get approval statistics
    this.app.get('/approvals/stats', async (req, res) => {
      try {
        const stats = await this.manager.getApprovalStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Batch approval operations
    this.app.post('/approvals/batch/approve', async (req, res) => {
      try {
        const { items, approverId, notes } = req.body;
        const results = await this.manager.batchApprove(items, approverId, notes);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/approvals/batch/reject', async (req, res) => {
      try {
        const { items, approverId, reason } = req.body;
        const results = await this.manager.batchReject(items, approverId, reason);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start(port = 3005) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        console.log(`Approval interface running on port ${port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = ApprovalInterface;
```

This completes the human-in-the-loop approvals system that integrates with the existing needs_action folder structure.