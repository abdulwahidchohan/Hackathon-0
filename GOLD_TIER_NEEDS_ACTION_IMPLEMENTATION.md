# Gold Tier: Needs_Action Folder Implementation

## Overview
This document demonstrates how the Gold Tier system specifically places items in the Needs_Action folder for human review and approval.

## Needs_Action Folder Structure

The system maintains a specific folder structure for approval workflows:

```
├── Needs_Action/
│   ├── needs_approval_[unique_id].json
│   ├── needs_approval_[unique_id].json
│   └── ...
├── Pending_Approval/
├── Approved/
└── Done/
```

## Implementation Files

### 1. Needs_Action Manager (`needs_action_manager.js`)

```javascript
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class NeedsActionManager {
  constructor(config) {
    this.config = config || {};
    this.needsActionDir = this.config.needsActionDir || './Needs_Action';
    this.pendingDir = this.config.pendingDir || './Pending_Approval';
    this.approvedDir = this.config.approvedDir || './Approved';
    this.doneDir = this.config.doneDir || './Done';

    // Initialize directories
    this.initializeDirectories();
  }

  initializeDirectories() {
    [this.needsActionDir, this.pendingDir, this.approvedDir, this.doneDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async addItemToNeedsAction(itemData) {
    const approvalId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create simplified item for Needs_Action folder
    const needsActionItem = {
      id: approvalId,
      type: itemData.type || 'general',
      description: itemData.description || itemData.summary || 'Item requires approval',
      priority: itemData.priority || 'medium',
      deadline: itemData.deadline || this.calculateDefaultDeadline(itemData.priority || 'medium'),
      created: timestamp,
      source: itemData.source || 'system',
      category: itemData.category || 'general',
      relatedData: itemData.relatedData || null
    };

    // Create file in Needs_Action folder
    const fileName = `needs_approval_${approvalId}.json`;
    const filePath = path.join(this.needsActionDir, fileName);

    await fs.writeJson(filePath, needsActionItem, { spaces: 2 });

    console.log(`Item added to Needs_Action folder: ${filePath}`);
    return { success: true, id: approvalId, filePath };
  }

  calculateDefaultDeadline(priority) {
    const now = new Date();
    switch (priority) {
      case 'high':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
      case 'medium':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      case 'low':
        return new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    }
  }

  async getNeedsActionItems() {
    if (!fs.existsSync(this.needsActionDir)) {
      return [];
    }

    const files = await fs.readdir(this.needsActionDir);
    const items = [];

    for (const file of files) {
      if (file.startsWith('needs_approval_') && file.endsWith('.json')) {
        const filePath = path.join(this.needsActionDir, file);
        const item = await fs.readJson(filePath);
        items.push(item);
      }
    }

    return items;
  }

  async approveItem(itemId, approverId, notes = '') {
    // Find item in Needs_Action folder
    const files = await fs.readdir(this.needsActionDir);
    const file = files.find(f => f.includes(itemId));

    if (!file) {
      throw new Error(`Item not found in Needs_Action folder: ${itemId}`);
    }

    const filePath = path.join(this.needsActionDir, file);
    const item = await fs.readJson(filePath);

    // Move to approved directory
    const approvedFile = `approved_${itemId}.json`;
    const approvedPath = path.join(this.approvedDir, approvedFile);

    await fs.move(filePath, approvedPath);

    // Update item with approval info
    const approvedItem = {
      ...item,
      status: 'approved',
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      approvalNotes: notes
    };

    await fs.writeJson(approvedPath, approvedItem, { spaces: 2 });

    console.log(`Item approved and moved from Needs_Action: ${itemId}`);
    return approvedItem;
  }

  async rejectItem(itemId, approverId, reason = '') {
    // Find item in Needs_Action folder
    const files = await fs.readdir(this.needsActionDir);
    const file = files.find(f => f.includes(itemId));

    if (!file) {
      throw new Error(`Item not found in Needs_Action folder: ${itemId}`);
    }

    const filePath = path.join(this.needsActionDir, file);
    const item = await fs.readJson(filePath);

    // Move to done directory (as rejected)
    const rejectedFile = `rejected_${itemId}.json`;
    const donePath = path.join(this.doneDir, rejectedFile);

    await fs.move(filePath, donePath);

    // Update item with rejection info
    const rejectedItem = {
      ...item,
      status: 'rejected',
      rejectedBy: approverId,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    };

    await fs.writeJson(donePath, rejectedItem, { spaces: 2 });

    console.log(`Item rejected and moved from Needs_Action: ${itemId}`);
    return rejectedItem;
  }

  async moveItemToPending(itemId) {
    // Move from Needs_Action to Pending_Approval
    const files = await fs.readdir(this.needsActionDir);
    const file = files.find(f => f.includes(itemId));

    if (!file) {
      throw new Error(`Item not found in Needs_Action folder: ${itemId}`);
    }

    const sourcePath = path.join(this.needsActionDir, file);
    const pendingFile = `pending_${itemId}.json`;
    const pendingPath = path.join(this.pendingDir, pendingFile);

    await fs.move(sourcePath, pendingPath);

    console.log(`Item moved to Pending_Approval: ${itemId}`);
  }

  async getNeedsActionStats() {
    const items = await this.getNeedsActionItems();

    return {
      totalItems: items.length,
      byPriority: {
        high: items.filter(i => i.priority === 'high').length,
        medium: items.filter(i => i.priority === 'medium').length,
        low: items.filter(i => i.priority === 'low').length
      },
      byType: this.countByType(items),
      oldestItem: items.length > 0 ? items.reduce((oldest, current) =>
        new Date(current.created) < new Date(oldest.created) ? current : oldest
      ) : null
    };
  }

  countByType(items) {
    const counts = {};
    items.forEach(item => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    return counts;
  }

  async cleanupOldItems(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const files = await fs.readdir(this.needsActionDir);
    let cleanedCount = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.needsActionDir, file);
        const stats = await fs.stat(filePath);

        if (stats.birthtime < cutoffDate) {
          await fs.remove(filePath);
          cleanedCount++;
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} old items from Needs_Action folder`);
    return cleanedCount;
  }
}

module.exports = NeedsActionManager;
```

### 2. Integration with Watchers (`watcher_needs_action_integration.js`)

```javascript
const NeedsActionManager = require('./needs_action_manager');

class WatcherNeedsActionIntegration {
  constructor(needsActionManager) {
    this.needsActionManager = needsActionManager;
  }

  async handleEmailForApproval(email) {
    const itemData = {
      type: 'email_response',
      description: `Email from ${email.from} regarding "${email.subject}"`,
      priority: this.determineEmailPriority(email),
      source: 'gmail_watcher',
      category: 'communication',
      relatedData: {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        body: email.body.substring(0, 200) + '...',
        hasAttachments: email.attachments && email.attachments.length > 0,
        urgencyKeywords: this.extractUrgencyKeywords(email.subject + ' ' + email.body)
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleSocialPostForApproval(postData) {
    const itemData = {
      type: 'social_post',
      description: `LinkedIn post: ${postData.content.text.substring(0, 100)}...`,
      priority: this.determineSocialPostPriority(postData),
      source: 'social_media_automation',
      category: 'marketing',
      relatedData: {
        platform: postData.platform,
        content: postData.content,
        scheduledTime: postData.scheduleTime,
        hashtags: postData.content.hashtags
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleFinancialTransactionForApproval(transaction) {
    const itemData = {
      type: 'financial_transaction',
      description: `Invoice ${transaction.invoiceNumber || transaction.reference} for $${transaction.amount}`,
      priority: this.determineFinancialPriority(transaction),
      source: 'xero_integration',
      category: 'finance',
      relatedData: {
        transactionType: transaction.type,
        amount: transaction.amount,
        vendor: transaction.vendor || transaction.contact,
        dueDate: transaction.dueDate,
        department: transaction.department,
        purpose: transaction.purpose
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleFileChangeForApproval(fileEvent) {
    const itemData = {
      type: 'file_processing',
      description: `File change: ${fileEvent.operation} ${fileEvent.path}`,
      priority: this.determineFilePriority(fileEvent),
      source: 'filesystem_watcher',
      category: 'documents',
      relatedData: {
        operation: fileEvent.operation,
        filePath: fileEvent.path,
        fileSize: fileEvent.size,
        extension: fileEvent.extension,
        sensitivity: fileEvent.sensitivity,
        classification: fileEvent.classification
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleWhatsAppMessageForApproval(message) {
    const itemData = {
      type: 'whatsapp_response',
      description: `WhatsApp from ${message.sender}: ${message.content.substring(0, 100)}...`,
      priority: this.determineWhatsAppPriority(message),
      source: 'whatsapp_watcher',
      category: 'communication',
      relatedData: {
        sender: message.sender,
        senderName: message.senderName,
        content: message.content,
        timestamp: message.timestamp,
        isBusinessContact: message.isBusinessContact,
        urgencyKeywords: this.extractUrgencyKeywords(message.content)
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleAuditExceptionForApproval(exception) {
    const itemData = {
      type: 'audit_exception',
      description: `Audit exception: ${exception.description}`,
      priority: this.determineAuditPriority(exception),
      source: 'weekly_audit_system',
      category: 'compliance',
      relatedData: {
        auditPeriod: exception.period,
        anomalyType: exception.type,
        affectedArea: exception.affectedArea,
        severity: exception.severity,
        variance: exception.variance,
        potentialImpact: exception.potentialImpact
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  async handleCEOBriefingForApproval(briefingSection) {
    const itemData = {
      type: 'ceo_briefing_content',
      description: `CEO Briefing - ${briefingSection.section}: ${briefingSection.summary}`,
      priority: this.determineBriefingPriority(briefingSection),
      source: 'ceo_briefing_generator',
      category: 'executive',
      relatedData: {
        reportPeriod: briefingSection.period,
        section: briefingSection.section,
        content: briefingSection.content,
        sensitivityLevel: briefingSection.sensitivity,
        keyMetrics: briefingSection.keyMetrics
      }
    };

    return await this.needsActionManager.addItemToNeedsAction(itemData);
  }

  // Priority determination methods
  determineEmailPriority(email) {
    const urgencyKeywords = this.extractUrgencyKeywords(email.subject + ' ' + email.body);
    const senderRank = this.getSenderRank(email.from);

    if (urgencyKeywords.length >= 2 || senderRank >= 3) return 'high';
    if (urgencyKeywords.length >= 1 || senderRank >= 2) return 'medium';
    return 'low';
  }

  determineSocialPostPriority(postData) {
    const content = postData.content.text.toLowerCase();
    const sensitiveKeywords = ['confidential', 'internal', 'sensitive', 'private'];

    if (sensitiveKeywords.some(keyword => content.includes(keyword))) return 'high';
    if (content.includes('announcement') || content.includes('milestone')) return 'medium';
    return 'low';
  }

  determineFinancialPriority(transaction) {
    const amount = transaction.amount || 0;

    if (amount > 50000) return 'high';
    if (amount > 5000) return 'medium';
    return 'low';
  }

  determineFilePriority(fileEvent) {
    const path = fileEvent.path.toLowerCase();
    const sensitivePaths = ['confidential', 'sensitive', 'private', 'salary', 'hr'];

    if (sensitivePaths.some(p => path.includes(p))) return 'high';
    if (fileEvent.classification === 'confidential') return 'high';
    if (fileEvent.extension === '.xlsx' || fileEvent.extension === '.pdf') return 'medium';
    return 'low';
  }

  determineWhatsAppPriority(message) {
    const content = message.content.toLowerCase();
    const urgencyKeywords = this.extractUrgencyKeywords(content);
    const isVIP = message.isBusinessContact || message.sender.includes('@');

    if (urgencyKeywords.length >= 2 || isVIP) return 'high';
    if (urgencyKeywords.length >= 1) return 'medium';
    return 'low';
  }

  determineAuditPriority(exception) {
    if (exception.severity === 'high' || exception.potentialImpact === 'critical') return 'high';
    if (exception.severity === 'medium') return 'medium';
    return 'low';
  }

  determineBriefingPriority(briefingSection) {
    if (briefingSection.sensitivity === 'confidential') return 'high';
    if (briefingSection.section === 'Competitive Intelligence') return 'high';
    return 'medium';
  }

  extractUrgencyKeywords(text) {
    const keywords = [
      'urgent', 'asap', 'immediately', 'today', 'now', 'critical', 'important',
      'emergency', 'expedited', 'rush', 'deadline', 'time-sensitive'
    ];

    return keywords.filter(keyword => text.toLowerCase().includes(keyword));
  }

  getSenderRank(sender) {
    const execEmails = ['ceo@', 'cfo@', 'cto@', 'manager@', 'director@'];
    const businessEmails = ['sales@', 'support@', 'hr@', 'legal@'];

    if (execEmails.some(exec => sender.includes(exec))) return 4;
    if (businessEmails.some(biz => sender.includes(biz))) return 2;
    return 1;
  }
}

module.exports = WatcherNeedsActionIntegration;
```

### 3. Demonstration of All 7 Test Cases Creating Needs_Action Items

```javascript
// demonstration_needs_action_items.js
const NeedsActionManager = require('./needs_action_manager');
const WatcherNeedsActionIntegration = require('./watcher_needs_action_integration');

async function demonstrateNeedsActionItems() {
  console.log('Demonstrating Gold Tier Needs_Action Items...\n');

  // Initialize the managers
  const needsActionManager = new NeedsActionManager();
  const integration = new WatcherNeedsActionIntegration(needsActionManager);

  // Test 1: Email Processing
  console.log('1. Creating Email Processing Item in Needs_Action...');
  const emailItem = await integration.handleEmailForApproval({
    id: 'email_123',
    from: 'client@bigcorp.com',
    subject: 'URGENT: Contract Approval Required - $50,000 Marketing Deal',
    body: 'We need immediate approval for the marketing contract. This is time-sensitive and critical for Q1.',
    attachments: ['contract.pdf'],
    timestamp: new Date().toISOString()
  });
  console.log(`   Created: ${emailItem.filePath}\n`);

  // Test 2: Social Media Post
  console.log('2. Creating Social Media Post Item in Needs_Action...');
  const socialItem = await integration.handleSocialPostForApproval({
    platform: 'linkedin',
    content: {
      text: 'Exciting news! We\'ve reached 1 million customers. Thank you to our amazing team and loyal customers for making this milestone possible.',
      hashtags: ['#Milestone', '#Achievement', '#Teamwork'],
      media: { url: 'https://company.com/image.jpg', caption: 'Celebrating 1M customers' }
    },
    scheduleTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  console.log(`   Created: ${socialItem.filePath}\n`);

  // Test 3: Financial Transaction
  console.log('3. Creating Financial Transaction Item in Needs_Action...');
  const financialItem = await integration.handleFinancialTransactionForApproval({
    type: 'invoice',
    invoiceNumber: 'INV-2026-0156',
    amount: 15500.00,
    vendor: 'Cloud Services Inc.',
    dueDate: '2026-02-12',
    department: 'IT Infrastructure',
    purpose: 'Annual cloud hosting services'
  });
  console.log(`   Created: ${financialItem.filePath}\n`);

  // Test 4: File System Change
  console.log('4. Creating File System Change Item in Needs_Action...');
  const fileItem = await integration.handleFileChangeForApproval({
    operation: 'created',
    path: '/data/confidential/salary_reviews_Q4_2025.xlsx',
    size: 2048576,
    extension: '.xlsx',
    classification: 'confidential',
    sensitivity: 'high'
  });
  console.log(`   Created: ${fileItem.filePath}\n`);

  // Test 5: WhatsApp Message
  console.log('5. Creating WhatsApp Message Item in Needs_Action...');
  const whatsappItem = await integration.handleWhatsAppMessageForApproval({
    sender: '+1234567890',
    senderName: 'Acme Corp - Technical Lead',
    content: 'Hi, we\'re experiencing complete system downtime since 6 AM EST. Critical production systems are down. Need immediate assistance.',
    timestamp: new Date().toISOString(),
    isBusinessContact: true
  });
  console.log(`   Created: ${whatsappItem.filePath}\n`);

  // Test 6: Audit Exception
  console.log('6. Creating Audit Exception Item in Needs_Action...');
  const auditItem = await integration.handleAuditExceptionForApproval({
    period: '2026-W02',
    type: 'spending_anomaly',
    description: 'Marketing spend 300% above usual weekly average',
    affectedArea: 'Marketing',
    severity: 'medium',
    variance: 300,
    potentialImpact: 'budget_overrun'
  });
  console.log(`   Created: ${auditItem.filePath}\n`);

  // Test 7: CEO Briefing Content
  console.log('7. Creating CEO Briefing Content Item in Needs_Action...');
  const briefingItem = await integration.handleCEOBriefingForApproval({
    period: '2026-W02',
    section: 'Competitive Intelligence',
    summary: 'Competitor planning major product launch in Q2 2026',
    content: 'Competitor TechRival Inc. is planning a major product launch in Q2 2026 that could disrupt our market position.',
    sensitivity: 'confidential',
    keyMetrics: ['Q1 revenue projection 5% below target']
  });
  console.log(`   Created: ${briefingItem.filePath}\n`);

  // Show statistics
  console.log('Needs_Action Folder Statistics:');
  const stats = await needsActionManager.getNeedsActionStats();
  console.log(`   Total Items: ${stats.totalItems}`);
  console.log(`   High Priority: ${stats.byPriority.high}`);
  console.log(`   Medium Priority: ${stats.byPriority.medium}`);
  console.log(`   Low Priority: ${stats.byPriority.low}`);
  console.log(`   By Type: ${JSON.stringify(stats.byType, null, 2)}`);

  // List all items in Needs_Action folder
  console.log('\nAll Items in Needs_Action Folder:');
  const allItems = await needsActionManager.getNeedsActionItems();
  allItems.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.description} [${item.priority}] - ${item.type}`);
  });

  console.log('\nAll 7 Gold Tier test cases successfully created items in the Needs_Action folder!');
  console.log('Items are now available for human review and approval.');
}

// Run the demonstration
if (require.main === module) {
  demonstrateNeedsActionItems().catch(console.error);
}

module.exports = {
  NeedsActionManager,
  WatcherNeedsActionIntegration,
  demonstrateNeedsActionItems
};
```

### 4. Running the Demonstration

To run the demonstration and create all 7 test cases in the Needs_Action folder:

```bash
node demonstration_needs_action_items.js
```

This will create the following files in your `Needs_Action/` folder:

1. `needs_approval_[uuid].json` - Email processing item
2. `needs_approval_[uuid].json` - Social media post item
3. `needs_approval_[uuid].json` - Financial transaction item
4. `needs_approval_[uuid].json` - File system change item
5. `needs_approval_[uuid].json` - WhatsApp message item
6. `needs_approval_[uuid].json` - Audit exception item
7. `needs_approval_[uuid].json` - CEO briefing content item

Each file will contain the appropriate metadata for human review and approval, demonstrating that the Gold Tier system properly implements the Needs_Action workflow requirement.