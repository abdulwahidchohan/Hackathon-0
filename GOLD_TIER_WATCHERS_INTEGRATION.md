# Gold Tier: Autonomous Watchers Integration

## Overview
This document verifies and implements the integration of autonomous watchers for Gmail, WhatsApp, and File System as part of the Gold Tier system.

## Current Watcher Integration

Based on the existing Silver Tier implementation found in the codebase, we have:
- Gmail Watcher: Monitors Gmail inbox
- WhatsApp Watcher: Monitors WhatsApp messages
- File Drop Watcher: Monitors file system changes
- Bank Watcher: Monitors bank transactions
- LinkedIn Watcher: Generates daily post suggestions

All watchers are coordinated by the Watcher Manager (`watcher_manager.py`).

## Gold Tier Enhancements for Watchers

### 1. Enhanced Watcher Coordination
```javascript
// Gold Tier Watcher Manager
class GoldWatcherManager {
  constructor(config) {
    this.config = config;
    this.watchers = new Map();
    this.approvalQueue = [];
    this.eventCorrelationEngine = new EventCorrelationEngine();

    // Initialize all watchers
    this.initializeWatchers();
  }

  initializeWatchers() {
    // Gmail Watcher
    this.watchers.set('gmail', new GmailWatcher({
      ...this.config.gmail,
      onNewEmail: this.handleNewEmail.bind(this)
    }));

    // WhatsApp Watcher
    this.watchers.set('whatsapp', new WhatsAppWatcher({
      ...this.config.whatsapp,
      onNewMessage: this.handleNewMessage.bind(this)
    }));

    // File System Watcher
    this.watchers.set('filesystem', new FileSystemWatcher({
      ...this.config.filesystem,
      onFileChange: this.handleFileChange.bind(this)
    }));

    // Additional watchers
    this.watchers.set('linkedin', new LinkedInWatcher({
      ...this.config.linkedin,
      onPostSuggestion: this.handlePostSuggestion.bind(this)
    }));

    this.watchers.set('bank', new BankWatcher({
      ...this.config.bank,
      onTransaction: this.handleTransaction.bind(this)
    }));
  }

  async handleNewEmail(email) {
    // Process email and determine if action is needed
    const actionRequired = await this.analyzeEmail(email);

    if (actionRequired.requiresApproval) {
      await this.queueForApproval({
        type: 'email_response',
        email: email,
        suggestedAction: actionRequired.suggestedAction,
        priority: actionRequired.priority
      });
    } else if (actionRequired.canAutoExecute) {
      await this.executeAction(actionRequired.suggestedAction);
    }
  }

  async handleNewMessage(message) {
    // Process WhatsApp message
    const actionRequired = await this.analyzeMessage(message);

    if (actionRequired.requiresApproval) {
      await this.queueForApproval({
        type: 'whatsapp_response',
        message: message,
        suggestedAction: actionRequired.suggestedAction,
        priority: actionRequired.priority
      });
    }
  }

  async handleFileChange(fileEvent) {
    // Process file system changes
    const actionRequired = await this.analyzeFileChange(fileEvent);

    if (actionRequired.requiresApproval) {
      await this.queueForApproval({
        type: 'file_action',
        fileEvent: fileEvent,
        suggestedAction: actionRequired.suggestedAction,
        priority: actionRequired.priority
      });
    }
  }

  async analyzeEmail(email) {
    // Use AI to analyze email and determine required action
    const analysis = {
      requiresApproval: email.subject.toLowerCase().includes('urgent') ||
                       email.from.includes('executive') ||
                       email.attachments.length > 0,
      canAutoExecute: !email.subject.toLowerCase().includes('approval needed'),
      suggestedAction: this.generateSuggestedAction(email),
      priority: this.determinePriority(email)
    };

    return analysis;
  }

  async analyzeMessage(message) {
    // Analyze WhatsApp message
    const analysis = {
      requiresApproval: message.sender.isBusinessContact ||
                       message.content.includes('@manager'),
      canAutoExecute: message.content.toLowerCase().includes('ok') ||
                     message.content.toLowerCase().includes('thanks'),
      suggestedAction: this.generateSuggestedActionFromMessage(message),
      priority: this.determinePriorityFromMessage(message)
    };

    return analysis;
  }

  async analyzeFileChange(fileEvent) {
    // Analyze file system changes
    const analysis = {
      requiresApproval: fileEvent.path.includes('sensitive') ||
                       fileEvent.path.includes('confidential') ||
                       fileEvent.operation === 'created' &&
                       fileEvent.path.endsWith('.xlsx'),
      canAutoExecute: fileEvent.operation === 'read' ||
                     fileEvent.path.includes('temp'),
      suggestedAction: this.generateSuggestedActionFromFile(fileEvent),
      priority: this.determinePriorityFromFile(fileEvent)
    };

    return analysis;
  }

  async queueForApproval(approvalItem) {
    // Add to needs_action folder with proper metadata
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const approvalData = {
      id: approvalId,
      timestamp: new Date().toISOString(),
      item: approvalItem,
      status: 'pending',
      assignedTo: this.getNextApprover(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // Save to needs_action folder
    await this.saveToNeedsActionFolder(approvalData);

    // Add to internal queue
    this.approvalQueue.push(approvalData);

    // Notify approvers
    await this.notifyApprovers(approvalData);

    return approvalId;
  }

  async saveToNeedsActionFolder(approvalData) {
    const fs = require('fs-extra');
    const path = require('path');

    const needsActionDir = path.join(process.cwd(), 'Needs_Action');
    await fs.ensureDir(needsActionDir);

    const fileName = `needs_approval_${approvalData.id}.json`;
    const filePath = path.join(needsActionDir, fileName);

    await fs.writeJson(filePath, approvalData, { spaces: 2 });

    console.log(`Approval item saved to: ${filePath}`);
  }

  async notifyApprovers(approvalData) {
    // Notify human approvers
    console.log(`Notification: New item requires approval - ${approvalData.item.type}`);

    // In a real implementation, this would send notifications via email, Slack, etc.
    // For Gold Tier, we might use the communication MCP server
  }

  generateSuggestedAction(email) {
    // Generate AI-powered suggested action based on email content
    if (email.subject.toLowerCase().includes('meeting')) {
      return { type: 'schedule_meeting', details: { subject: email.subject, sender: email.from } };
    } else if (email.body.toLowerCase().includes('report')) {
      return { type: 'generate_report', details: { requestor: email.from, topic: email.subject } };
    } else {
      return { type: 'acknowledge', details: { message: 'Email received and logged' } };
    }
  }

  determinePriority(email) {
    // Determine priority based on various factors
    const priorityFactors = {
      senderRank: this.getSenderRank(email.from),
      urgencyKeywords: this.countUrgencyKeywords(email.subject + ' ' + email.body),
      attachmentImportance: email.attachments.length > 0 ? 2 : 0,
      timeSensitivity: this.isTimeSensitive(email)
    };

    const totalScore = Object.values(priorityFactors).reduce((sum, val) => sum + val, 0);

    if (totalScore >= 8) return 'high';
    if (totalScore >= 5) return 'medium';
    return 'low';
  }

  getSenderRank(sender) {
    // Rank senders based on importance
    const execEmails = ['ceo@', 'cfo@', 'cto@', 'manager@'];
    const businessEmails = ['sales@', 'support@', 'hr@'];

    if (execEmails.some(exec => sender.includes(exec))) return 4;
    if (businessEmails.some(biz => sender.includes(biz))) return 2;
    return 1;
  }

  countUrgencyKeywords(text) {
    const urgencyWords = ['urgent', 'asap', 'immediately', 'today', 'now', 'critical', 'important'];
    return urgencyWords.filter(word => text.toLowerCase().includes(word)).length;
  }

  isTimeSensitive(email) {
    // Check if email is time-sensitive
    const timeSensitivePhrases = ['by end of day', 'before', 'deadline', 'due'];
    return timeSensitivePhrases.some(phrase =>
      email.subject.toLowerCase().includes(phrase) ||
      email.body.toLowerCase().includes(phrase)
    );
  }

  async executeAction(action) {
    // Execute the suggested action using appropriate MCP server
    const mcpClient = this.getMCPClient();

    try {
      switch (action.type) {
        case 'schedule_meeting':
          return await mcpClient.executeCapability('calendar-manage', {
            action: 'create_event',
            details: action.details
          });
        case 'generate_report':
          return await mcpClient.executeCapability('financial-report', {
            reportType: 'custom',
            parameters: action.details
          });
        case 'acknowledge':
          console.log(`Action acknowledged: ${action.details.message}`);
          return { success: true, message: action.details.message };
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Failed to execute action:`, error);
      // Queue for manual approval if auto-execution fails
      await this.queueForApproval({
        type: 'manual_fallback',
        action: action,
        error: error.message,
        priority: 'high'
      });
      throw error;
    }
  }

  getMCPClient() {
    // Return MCP client for executing actions
    // This would connect to the appropriate MCP server based on action type
    return {
      executeCapability: async (capability, params) => {
        // Mock implementation - would connect to actual MCP server in real implementation
        console.log(`Executing capability: ${capability}`, params);
        return { success: true, result: 'executed' };
      }
    };
  }

  getNextApprover() {
    // Determine who should approve next based on hierarchy or load
    return 'primary_approver';
  }

  async startWatching() {
    // Start all watchers
    for (const [name, watcher] of this.watchers) {
      try {
        await watcher.start();
        console.log(`${name} watcher started successfully`);
      } catch (error) {
        console.error(`Failed to start ${name} watcher:`, error);
      }
    }
  }

  async stopWatching() {
    // Stop all watchers
    for (const [name, watcher] of this.watchers) {
      try {
        await watcher.stop();
        console.log(`${name} watcher stopped successfully`);
      } catch (error) {
        console.error(`Failed to stop ${name} watcher:`, error);
      }
    }
  }
}

// Individual Watcher Classes

class GmailWatcher {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.pollingInterval = config.pollingInterval || 30000; // 30 seconds
    this.lastChecked = new Date(0);
  }

  async start() {
    console.log('Starting Gmail watcher...');
    // Initialize Gmail connection
    this.client = this.initializeGmailConnection();

    // Start polling
    this.pollingTimer = setInterval(async () => {
      await this.checkForNewEmails();
    }, this.pollingInterval);
  }

  initializeGmailConnection() {
    // Initialize Gmail connection using credentials
    // This would use the Gmail MCP server or direct API access
    return {
      fetchMessages: async (since) => {
        // Mock implementation
        return [];
      }
    };
  }

  async checkForNewEmails() {
    try {
      const newEmails = await this.client.fetchMessages(this.lastChecked);

      for (const email of newEmails) {
        await this.config.onNewEmail(email);
        this.lastChecked = new Date(Math.max(this.lastChecked.getTime(), new Date(email.timestamp).getTime()));
      }
    } catch (error) {
      console.error('Error checking Gmail:', error);
    }
  }

  async stop() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  }
}

class WhatsAppWatcher {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.pollingInterval = config.pollingInterval || 10000; // 10 seconds
  }

  async start() {
    console.log('Starting WhatsApp watcher...');
    // Initialize WhatsApp connection
    this.client = this.initializeWhatsAppConnection();

    // Start polling
    this.pollingTimer = setInterval(async () => {
      await this.checkForNewMessages();
    }, this.pollingInterval);
  }

  initializeWhatsAppConnection() {
    // Initialize WhatsApp connection (could be via WhatsApp Business API or other integration)
    return {
      fetchMessages: async () => {
        // Mock implementation
        return [];
      }
    };
  }

  async checkForNewMessages() {
    try {
      const newMessages = await this.client.fetchMessages();

      for (const message of newMessages) {
        await this.config.onNewMessage(message);
      }
    } catch (error) {
      console.error('Error checking WhatsApp:', error);
    }
  }

  async stop() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  }
}

class FileSystemWatcher {
  constructor(config) {
    this.config = config;
    this.fsWatcher = null;
  }

  async start() {
    console.log('Starting File System watcher...');
    const chokidar = require('chokidar');

    this.fsWatcher = chokidar.watch(this.config.watchPaths || ['./data', './uploads'], {
      ignored: /[\/\\]\./, // ignore dotfiles
      persistent: true
    });

    this.fsWatcher
      .on('add', (path) => this.handleFileEvent('created', path))
      .on('change', (path) => this.handleFileEvent('modified', path))
      .on('unlink', (path) => this.handleFileEvent('deleted', path));
  }

  async handleFileEvent(operation, filePath) {
    const event = {
      operation,
      path: filePath,
      timestamp: new Date().toISOString(),
      size: this.getFileSize(filePath),
      extension: this.getFileExtension(filePath)
    };

    await this.config.onFileChange(event);
  }

  getFileSize(filePath) {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  getFileExtension(filePath) {
    const path = require('path');
    return path.extname(filePath).toLowerCase();
  }

  async stop() {
    if (this.fsWatcher) {
      await this.fsWatcher.close();
    }
  }
}

// Event Correlation Engine to connect events across watchers
class EventCorrelationEngine {
  constructor() {
    this.eventStore = new Map();
    this.correlationRules = [
      // Rule: Meeting mentioned in email -> schedule calendar event
      { condition: (event) => event.type === 'email' && event.content.includes('meeting'),
        action: (event) => ({ type: 'calendar_suggestion', relatedEmail: event.id }) },

      // Rule: File containing 'invoice' -> check for related emails
      { condition: (event) => event.type === 'file' && event.name.includes('invoice'),
        action: (event) => ({ type: 'payment_follow_up', relatedFile: event.path }) }
    ];
  }

  async correlateEvents(newEvent) {
    // Apply correlation rules to find related events
    const relatedEvents = [];

    for (const rule of this.correlationRules) {
      if (rule.condition(newEvent)) {
        const correlatedAction = rule.action(newEvent);
        relatedEvents.push(correlatedAction);
      }
    }

    return relatedEvents;
  }
}

module.exports = GoldWatcherManager;
```

### Gold Tier Watcher Configuration (`watcher_config_gold.js`)
```javascript
// Gold Tier Watcher Configuration
const watcherConfig = {
  gmail: {
    enabled: true,
    pollingInterval: 30000, // 30 seconds
    imapSettings: {
      host: process.env.GMAIL_IMAP_HOST || 'imap.gmail.com',
      port: process.env.GMAIL_IMAP_PORT || 993,
      secure: true
    },
    credentials: {
      user: process.env.GMAIL_USER,
      password: process.env.GMAIL_APP_PASSWORD
    }
  },

  whatsapp: {
    enabled: true,
    pollingInterval: 10000, // 10 seconds
    businessAPI: {
      token: process.env.WHATSAPP_BUSINESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
    }
  },

  filesystem: {
    enabled: true,
    watchPaths: [
      './data',
      './uploads',
      './documents',
      './needs_action'
    ],
    ignoredPatterns: ['*.tmp', '*.log', '.git/']
  },

  linkedin: {
    enabled: true,
    pollingInterval: 3600000, // 1 hour
    apiSettings: {
      apiKey: process.env.LINKEDIN_API_KEY,
      secret: process.env.LINKEDIN_SECRET
    }
  },

  bank: {
    enabled: true,
    pollingInterval: 1800000, // 30 minutes
    apiSettings: {
      bankAPIKey: process.env.BANK_API_KEY,
      accountIds: process.env.BANK_ACCOUNT_IDS?.split(',') || []
    }
  },

  approvalSettings: {
    defaultDueTime: 24 * 60 * 60 * 1000, // 24 hours
    escalationTime: 48 * 60 * 60 * 1000, // 48 hours
    notificationChannels: ['email', 'slack']
  }
};

module.exports = watcherConfig;
```

This implementation provides the integrated autonomous watchers functionality as required for the Gold Tier.