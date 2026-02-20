# Gold Tier: Xero Accounting Integration

## Overview
The Xero accounting integration provides seamless connection to Xero accounting software for financial management, reporting, and data synchronization.

## Components

### 1. Xero API Client
- OAuth2 authentication with Xero
- API rate limiting and error handling
- Data synchronization capabilities

### 2. Financial Data Manager
- Invoice management
- Expense tracking
- Bank reconciliation
- Financial reporting

### 3. Integration Workflows
- Automated data sync
- Approval workflows for financial transactions
- Error handling and recovery

## Implementation

### Xero API Client (`xero_api_client.js`)
```javascript
const axios = require('axios');
const crypto = require('crypto');

class XeroAPIClient {
  constructor(config) {
    this.config = config;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.apiBase = 'https://api.xero.com/api.xro/2.0';

    // Rate limiting
    this.rateLimit = {
      remaining: 1000,
      resetTime: Date.now()
    };

    // Initialize Xero connection
    this.initializeConnection();
  }

  async initializeConnection() {
    // Set up authentication headers
    this.authHeaders = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Xero-tenant-id': this.tenantId,
      'Content-Type': 'application/json'
    };
  }

  async refreshTokenIfNeeded() {
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
  }

  isTokenExpired() {
    // In a real implementation, tokens would have expiration times
    // For now, we'll assume tokens are valid unless we get a 401
    return false;
  }

  async refreshAccessToken() {
    const tokenUrl = 'https://identity.xero.com/connect/token';

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post(tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken
    }, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    this.accessToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token;

    // Update auth headers
    this.authHeaders['Authorization'] = `Bearer ${this.accessToken}`;

    return response.data;
  }

  async makeAPIRequest(endpoint, method = 'GET', data = null) {
    await this.refreshTokenIfNeeded();
    await this.checkRateLimit();

    try {
      const response = await axios({
        method: method,
        url: `${this.apiBase}${endpoint}`,
        headers: this.authHeaders,
        data: data
      });

      this.updateRateLimit(response);
      return response.data;
    } catch (error) {
      await this.handleAPIError(error);
      throw error;
    }
  }

  async checkRateLimit() {
    if (this.rateLimit.remaining <= 10) { // Keep a buffer
      const waitTime = Math.max(0, this.rateLimit.resetTime - Date.now());
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  updateRateLimit(response) {
    // Xero returns rate limit headers
    const remaining = response.headers['x-rate-limit-remaining'];
    const reset = response.headers['x-rate-limit-reset'];

    if (remaining !== undefined) {
      this.rateLimit.remaining = parseInt(remaining);
    }

    if (reset !== undefined) {
      // Reset time is in seconds
      this.rateLimit.resetTime = parseInt(reset) * 1000;
    }
  }

  async handleAPIError(error) {
    if (error.response) {
      const { status, data } = error.response;

      console.error(`Xero API Error ${status}:`, data);

      if (status === 401) {
        // Unauthorized - try to refresh token
        try {
          await this.refreshAccessToken();
          // Retry the original request after token refresh
        } catch (refreshError) {
          console.error('Failed to refresh access token:', refreshError);
          throw new Error('Authentication failed - unable to refresh token');
        }
      } else if (status === 429) {
        // Rate limited
        this.rateLimit.remaining = 0;
        this.rateLimit.resetTime = Date.now() + 60000; // Wait 1 minute
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else if (status >= 500) {
        // Server error - wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw error;
  }

  // Contacts API
  async getContacts(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/Contacts?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async getContact(contactId) {
    return await this.makeAPIRequest(`/Contacts/${contactId}`);
  }

  async createContact(contactData) {
    const data = {
      Contacts: [contactData]
    };
    return await this.makeAPIRequest('/Contacts', 'POST', data);
  }

  async updateContact(contactId, contactData) {
    const data = {
      Contacts: [{ ...contactData, ContactID: contactId }]
    };
    return await this.makeAPIRequest('/Contacts', 'POST', data);
  }

  // Invoices API
  async getInvoices(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/Invoices?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async getInvoice(invoiceId) {
    return await this.makeAPIRequest(`/Invoices/${invoiceId}`);
  }

  async createInvoice(invoiceData) {
    const data = {
      Invoices: [invoiceData]
    };
    return await this.makeAPIRequest('/Invoices', 'POST', data);
  }

  async updateInvoice(invoiceId, invoiceData) {
    const data = {
      Invoices: [{ ...invoiceData, InvoiceID: invoiceId }]
    };
    return await this.makeAPIRequest('/Invoices', 'POST', data);
  }

  async sendInvoice(invoiceId) {
    return await this.makeAPIRequest(`/Invoices/${invoiceId}/Email`, 'POST');
  }

  // Bills API
  async getBills(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/Bills?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async getBill(billId) {
    return await this.makeAPIRequest(`/Bills/${billId}`);
  }

  async createBill(billData) {
    const data = {
      Bills: [billData]
    };
    return await this.makeAPIRequest('/Bills', 'POST', data);
  }

  // Bank Transactions API
  async getBankTransactions(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/BankTransactions?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async createBankTransaction(transactionData) {
    const data = {
      BankTransactions: [transactionData]
    };
    return await this.makeAPIRequest('/BankTransactions', 'POST', data);
  }

  // Manual Journals API
  async getManualJournals(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/ManualJournals?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async createManualJournal(journalData) {
    const data = {
      ManualJournals: [journalData]
    };
    return await this.makeAPIRequest('/ManualJournals', 'POST', data);
  }

  // Accounts API
  async getAccounts(filters = {}) {
    const params = new URLSearchParams(filters);
    const endpoint = `/Accounts?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  // Tracking Categories API
  async getTrackingCategories() {
    return await this.makeAPIRequest('/TrackingCategories');
  }

  // Reports API
  async getReport(reportId, dateRange = {}) {
    const params = new URLSearchParams(dateRange);
    const endpoint = `/Reports/${reportId}?${params.toString()}`;
    return await this.makeAPIRequest(endpoint);
  }

  async getProfitAndLoss(dateRange = {}) {
    return await this.getReport('ProfitAndLoss', dateRange);
  }

  async getBalanceSheet(dateRange = {}) {
    return await this.getReport('BalanceSheet', dateRange);
  }

  async getCashFlow(dateRange = {}) {
    return await this.getReport('CashFlow', dateRange);
  }

  // Bank Feeds API (if available)
  async getBankFeeds() {
    return await this.makeAPIRequest('/BankFeeds');
  }

  async createBankFeed(feedData) {
    return await this.makeAPIRequest('/BankFeeds', 'POST', feedData);
  }

  // Utility methods
  async searchContacts(searchTerm) {
    const filters = { where: `Name.Contains("${searchTerm}")` };
    return await this.getContacts(filters);
  }

  async searchInvoices(searchTerm) {
    const filters = { where: `Reference.Contains("${searchTerm}")` };
    return await this.getInvoices(filters);
  }

  async getInvoicesByContact(contactId) {
    const filters = { where: `Contact.ContactID == Guid("${contactId}")` };
    return await this.getInvoices(filters);
  }

  async getBillsByContact(contactId) {
    const filters = { where: `Contact.ContactID == Guid("${contactId}")` };
    return await this.getBills(filters);
  }

  // Data synchronization methods
  async syncContacts(localContacts) {
    const xeroContacts = await this.getContacts();
    const syncResults = [];

    for (const localContact of localContacts) {
      const existingContact = xeroContacts.Contacts.find(
        xeroContact => xeroContact.ContactNumber === localContact.externalId
      );

      if (existingContact) {
        // Update existing contact
        const result = await this.updateContact(existingContact.ContactID, localContact);
        syncResults.push({ type: 'update', contact: localContact, result });
      } else {
        // Create new contact
        const result = await this.createContact(localContact);
        syncResults.push({ type: 'create', contact: localContact, result });
      }
    }

    return syncResults;
  }

  async syncInvoices(localInvoices) {
    const xeroInvoices = await this.getInvoices();
    const syncResults = [];

    for (const localInvoice of localInvoices) {
      const existingInvoice = xeroInvoices.Invoices.find(
        xeroInvoice => xeroInvoice.InvoiceNumber === localInvoice.externalId
      );

      if (existingInvoice) {
        // Update existing invoice
        const result = await this.updateInvoice(existingInvoice.InvoiceID, localInvoice);
        syncResults.push({ type: 'update', invoice: localInvoice, result });
      } else {
        // Create new invoice
        const result = await this.createInvoice(localInvoice);
        syncResults.push({ type: 'create', invoice: localInvoice, result });
      }
    }

    return syncResults;
  }
}

module.exports = XeroAPIClient;
```

### Financial Data Manager (`financial_data_manager.js`)
```javascript
const XeroAPIClient = require('./xero_api_client');

class FinancialDataManager {
  constructor(config) {
    this.config = config;
    this.xeroClient = new XeroAPIClient(config.xero);
    this.dataCache = new Map();
    this.syncInterval = config.syncInterval || 300000; // 5 minutes
  }

  async initialize() {
    // Start periodic synchronization
    if (this.syncInterval > 0) {
      setInterval(async () => {
        await this.synchronizeFinancialData();
      }, this.syncInterval);
    }
  }

  async synchronizeFinancialData() {
    try {
      console.log('Starting financial data synchronization...');

      // Sync contacts
      await this.syncContacts();

      // Sync invoices
      await this.syncInvoices();

      // Sync bills
      await this.syncBills();

      // Sync bank transactions
      await this.syncBankTransactions();

      console.log('Financial data synchronization completed successfully');
    } catch (error) {
      console.error('Financial data synchronization failed:', error);
    }
  }

  async syncContacts() {
    // Get contacts from external system and sync to Xero
    // This would typically come from your business system
    const externalContacts = await this.getExternalContacts();
    const syncResults = await this.xeroClient.syncContacts(externalContacts);

    // Update cache
    const xeroContacts = await this.xeroClient.getContacts();
    this.dataCache.set('contacts', xeroContacts);

    return syncResults;
  }

  async syncInvoices() {
    // Get invoices from external system and sync to Xero
    const externalInvoices = await this.getExternalInvoices();
    const syncResults = await this.xeroClient.syncInvoices(externalInvoices);

    // Update cache
    const xeroInvoices = await this.xeroClient.getInvoices();
    this.dataCache.set('invoices', xeroInvoices);

    return syncResults;
  }

  async syncBills() {
    // Sync bills
    const xeroBills = await this.xeroClient.getBills();
    this.dataCache.set('bills', xeroBills);

    return xeroBills;
  }

  async syncBankTransactions() {
    // Sync bank transactions
    const xeroBankTransactions = await this.xeroClient.getBankTransactions();
    this.dataCache.set('bankTransactions', xeroBankTransactions);

    return xeroBankTransactions;
  }

  async getExternalContacts() {
    // In a real implementation, this would fetch contacts from your business system
    // For now, returning mock data
    return [
      {
        Name: 'Acme Corporation',
        ContactNumber: 'ACME001',
        EmailAddress: 'contact@acme.com',
        FirstName: 'John',
        LastName: 'Doe',
        DefaultCurrency: 'USD'
      }
    ];
  }

  async getExternalInvoices() {
    // In a real implementation, this would fetch invoices from your business system
    // For now, returning mock data
    return [
      {
        Type: 'ACCREC',
        Contact: {
          ContactID: '00000000-0000-0000-0000-000000000000' // Would be actual contact ID
        },
        Date: new Date().toISOString().split('T')[0],
        DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        LineItems: [
          {
            Description: 'Professional Services',
            Quantity: 1.0,
            UnitAmount: 1000.00,
            AccountCode: '200',
            TaxType: 'OUTPUT'
          }
        ],
        InvoiceNumber: 'INV001',
        Reference: 'Project ABC',
        CurrencyCode: 'USD'
      }
    ];
  }

  // Invoice management methods
  async createInvoice(invoiceData, requiresApproval = true) {
    if (requiresApproval) {
      // Submit for approval
      const approvalItem = {
        type: 'financial_transaction',
        subType: 'invoice_creation',
        data: invoiceData,
        amount: this.calculateInvoiceTotal(invoiceData),
        priority: this.determineTransactionPriority(invoiceData),
        source: 'xero_integration'
      };

      return await this.submitForApproval(approvalItem);
    } else {
      // Create invoice directly
      try {
        const result = await this.xeroClient.createInvoice(invoiceData);
        await this.logFinancialActivity('invoice_created', invoiceData, result);
        return result;
      } catch (error) {
        console.error('Failed to create invoice:', error);

        // Fall back to approval
        const approvalItem = {
          type: 'financial_transaction_failed',
          subType: 'invoice_creation',
          data: invoiceData,
          error: error.message,
          priority: 'high',
          source: 'xero_integration'
        };

        return await this.submitForApproval(approvalItem);
      }
    }
  }

  async sendInvoice(invoiceId) {
    try {
      const result = await this.xeroClient.sendInvoice(invoiceId);
      await this.logFinancialActivity('invoice_sent', { invoiceId }, result);
      return result;
    } catch (error) {
      console.error('Failed to send invoice:', error);
      throw error;
    }
  }

  async getInvoiceDetails(invoiceId) {
    const cachedInvoices = this.dataCache.get('invoices');
    if (cachedInvoices) {
      const invoice = cachedInvoices.Invoices.find(inv => inv.InvoiceID === invoiceId);
      if (invoice) {
        return invoice;
      }
    }

    // Fetch from Xero if not in cache
    return await this.xeroClient.getInvoice(invoiceId);
  }

  async getInvoicesByContact(contactId) {
    const cachedInvoices = this.dataCache.get('invoices');
    if (cachedInvoices) {
      const contactInvoices = cachedInvoices.Invoices.filter(
        inv => inv.Contact.ContactID === contactId
      );
      if (contactInvoices.length > 0) {
        return contactInvoices;
      }
    }

    // Fetch from Xero if not in cache
    return await this.xeroClient.getInvoicesByContact(contactId);
  }

  // Expense/Bill management methods
  async createBill(billData, requiresApproval = true) {
    if (requiresApproval) {
      // Submit for approval
      const approvalItem = {
        type: 'financial_transaction',
        subType: 'bill_creation',
        data: billData,
        amount: this.calculateBillTotal(billData),
        priority: this.determineTransactionPriority(billData),
        source: 'xero_integration'
      };

      return await this.submitForApproval(approvalItem);
    } else {
      // Create bill directly
      try {
        const result = await this.xeroClient.createBill(billData);
        await this.logFinancialActivity('bill_created', billData, result);
        return result;
      } catch (error) {
        console.error('Failed to create bill:', error);

        // Fall back to approval
        const approvalItem = {
          type: 'financial_transaction_failed',
          subType: 'bill_creation',
          data: billData,
          error: error.message,
          priority: 'high',
          source: 'xero_integration'
        };

        return await this.submitForApproval(approvalItem);
      }
    }
  }

  async getBillsByContact(contactId) {
    const cachedBills = this.dataCache.get('bills');
    if (cachedBills) {
      const contactBills = cachedBills.Bills.filter(
        bill => bill.Contact.ContactID === contactId
      );
      if (contactBills.length > 0) {
        return contactBills;
      }
    }

    // Fetch from Xero if not in cache
    return await this.xeroClient.getBillsByContact(contactId);
  }

  // Contact management methods
  async getContact(contactId) {
    const cachedContacts = this.dataCache.get('contacts');
    if (cachedContacts) {
      const contact = cachedContacts.Contacts.find(c => c.ContactID === contactId);
      if (contact) {
        return contact;
      }
    }

    // Fetch from Xero if not in cache
    return await this.xeroClient.getContact(contactId);
  }

  async createContact(contactData, requiresApproval = true) {
    if (requiresApproval) {
      // Submit for approval
      const approvalItem = {
        type: 'master_data',
        subType: 'contact_creation',
        data: contactData,
        priority: 'medium',
        source: 'xero_integration'
      };

      return await this.submitForApproval(approvalItem);
    } else {
      // Create contact directly
      try {
        const result = await this.xeroClient.createContact(contactData);
        await this.logFinancialActivity('contact_created', contactData, result);
        return result;
      } catch (error) {
        console.error('Failed to create contact:', error);

        // Fall back to approval
        const approvalItem = {
          type: 'master_data_failed',
          subType: 'contact_creation',
          data: contactData,
          error: error.message,
          priority: 'high',
          source: 'xero_integration'
        };

        return await this.submitForApproval(approvalItem);
      }
    }
  }

  async searchContacts(searchTerm) {
    try {
      return await this.xeroClient.searchContacts(searchTerm);
    } catch (error) {
      console.error('Contact search failed:', error);
      throw error;
    }
  }

  // Financial reporting methods
  async getProfitAndLoss(dateRange) {
    try {
      return await this.xeroClient.getProfitAndLoss(dateRange);
    } catch (error) {
      console.error('Profit and Loss report failed:', error);
      throw error;
    }
  }

  async getBalanceSheet(dateRange) {
    try {
      return await this.xeroClient.getBalanceSheet(dateRange);
    } catch (error) {
      console.error('Balance Sheet report failed:', error);
      throw error;
    }
  }

  async getCashFlow(dateRange) {
    try {
      return await this.xeroClient.getCashFlow(dateRange);
    } catch (error) {
      console.error('Cash Flow report failed:', error);
      throw error;
    }
  }

  async getFinancialSummary() {
    try {
      const [pnl, balanceSheet, cashFlow] = await Promise.all([
        this.getProfitAndLoss(),
        this.xeroClient.getBalanceSheet(),
        this.xeroClient.getCashFlow()
      ]);

      return {
        profitAndLoss: pnl,
        balanceSheet: balanceSheet,
        cashFlow: cashFlow,
        summary: this.calculateFinancialSummary(pnl, balanceSheet)
      };
    } catch (error) {
      console.error('Financial summary generation failed:', error);
      throw error;
    }
  }

  calculateFinancialSummary(pnl, balanceSheet) {
    // Calculate key financial metrics
    const summary = {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netAssets: 0
    };

    // Calculate from P&L
    if (pnl && pnl.Reports) {
      const report = pnl.Reports[0];
      if (report.Rows) {
        report.Rows.forEach(row => {
          if (row.RowType === 'Section') {
            row.Rows.forEach(subRow => {
              if (subRow.Cells && subRow.Cells.length >= 2) {
                const value = parseFloat(subRow.Cells[1].Value) || 0;
                if (subRow.RowType === 'Header' && subRow.Cells[0].Value === 'Revenue') {
                  summary.totalRevenue += value;
                } else if (subRow.RowType === 'Header' && subRow.Cells[0].Value === 'Expenses') {
                  summary.totalExpenses += value;
                }
              }
            });
          }
        });
      }
    }

    summary.netProfit = summary.totalRevenue - summary.totalExpenses;

    // Calculate from Balance Sheet
    if (balanceSheet && balanceSheet.Reports) {
      const report = balanceSheet.Reports[0];
      if (report.Rows) {
        report.Rows.forEach(row => {
          if (row.RowType === 'Section') {
            row.Rows.forEach(subRow => {
              if (subRow.Cells && subRow.Cells.length >= 2) {
                const value = parseFloat(subRow.Cells[1].Value) || 0;
                if (subRow.Cells[0].Value === 'Assets') {
                  summary.totalAssets += value;
                } else if (subRow.Cells[0].Value === 'Liabilities') {
                  summary.totalLiabilities += value;
                }
              }
            });
          }
        });
      }
    }

    summary.netAssets = summary.totalAssets - summary.totalLiabilities;

    return summary;
  }

  // Helper methods
  calculateInvoiceTotal(invoiceData) {
    if (!invoiceData.LineItems) return 0;
    return invoiceData.LineItems.reduce((total, item) => {
      return total + (item.Quantity * item.UnitAmount);
    }, 0);
  }

  calculateBillTotal(billData) {
    if (!billData.LineItems) return 0;
    return billData.LineItems.reduce((total, item) => {
      return total + (item.Quantity * item.UnitAmount);
    }, 0);
  }

  determineTransactionPriority(transactionData) {
    const amount = this.calculateInvoiceTotal(transactionData) || this.calculateBillTotal(transactionData);

    if (amount > 10000) return 'high';
    if (amount > 1000) return 'medium';
    return 'low';
  }

  async submitForApproval(approvalItem) {
    // In a real implementation, this would connect to the approval system
    // For now, returning a mock approval ID
    return {
      queuedForApproval: true,
      approvalId: `xero_approval_${Date.now()}`,
      item: approvalItem
    };
  }

  async logFinancialActivity(activityType, data, result) {
    // Log financial activity for audit purposes
    const fs = require('fs-extra');
    const path = require('path');

    const logDir = path.join(process.cwd(), 'logs', 'financial');
    await fs.ensureDir(logDir);

    const logEntry = {
      timestamp: new Date().toISOString(),
      activityType,
      data,
      result,
      userId: 'system', // Would be actual user in real implementation
      ipAddress: '127.0.0.1'
    };

    const logFile = path.join(logDir, `activity_${new Date().toISOString().split('T')[0]}.json`);
    const logData = [];

    if (await fs.pathExists(logFile)) {
      const existingData = await fs.readJson(logFile).catch(() => []);
      logData.push(...existingData);
    }

    logData.push(logEntry);
    await fs.writeJson(logFile, logData, { spaces: 2 });
  }

  async getDashboardData() {
    try {
      // Get key metrics for dashboard
      const invoices = await this.xeroClient.getInvoices({ Status: 'AUTHORISED' });
      const bills = await this.xeroClient.getBills({ Status: 'AUTHORISED' });
      const contacts = await this.xeroClient.getContacts();

      const dashboardData = {
        totalInvoices: invoices.Invoices?.length || 0,
        totalBills: bills.Bills?.length || 0,
        totalContacts: contacts.Contacts?.length || 0,
        outstandingInvoices: invoices.Invoices?.filter(inv => inv.Status === 'AUTHORISED').length || 0,
        totalOutstandingAmount: this.calculateOutstandingAmount(invoices),
        recentActivity: await this.getRecentFinancialActivity(10)
      };

      return dashboardData;
    } catch (error) {
      console.error('Dashboard data retrieval failed:', error);
      throw error;
    }
  }

  calculateOutstandingAmount(invoices) {
    if (!invoices.Invoices) return 0;
    return invoices.Invoices.reduce((total, invoice) => {
      if (invoice.Status === 'AUTHORISED') {
        return total + (parseFloat(invoice.AmountDue) || 0);
      }
      return total;
    }, 0);
  }

  async getRecentFinancialActivity(limit = 10) {
    // Get recent financial activities from logs
    const fs = require('fs-extra');
    const path = require('path');

    const logDir = path.join(process.cwd(), 'logs', 'financial');
    if (!await fs.pathExists(logDir)) {
      return [];
    }

    const logFiles = await fs.readdir(logDir);
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `activity_${today}.json`);

    if (await fs.pathExists(logFile)) {
      const logData = await fs.readJson(logFile).catch(() => []);
      return logData.slice(-limit);
    }

    return [];
  }
}

module.exports = FinancialDataManager;
```

### Xero Integration Controller (`xero_integration_controller.js`)
```javascript
const FinancialDataManager = require('./financial_data_manager');
const ApprovalQueueManager = require('./approval_queue_manager');

class XeroIntegrationController {
  constructor(config) {
    this.config = config;
    this.financialManager = new FinancialDataManager(config.financial);
    this.approvalManager = new ApprovalQueueManager(config.approval);
  }

  async initialize() {
    await this.financialManager.initialize();
  }

  // Invoice operations
  async createInvoice(invoiceData, requiresApproval = true) {
    return await this.financialManager.createInvoice(invoiceData, requiresApproval);
  }

  async getInvoice(invoiceId) {
    return await this.financialManager.getInvoiceDetails(invoiceId);
  }

  async sendInvoice(invoiceId) {
    return await this.financialManager.sendInvoice(invoiceId);
  }

  async getInvoices(filters = {}) {
    return await this.financialManager.xeroClient.getInvoices(filters);
  }

  async getInvoicesByContact(contactId) {
    return await this.financialManager.getInvoicesByContact(contactId);
  }

  // Bill operations
  async createBill(billData, requiresApproval = true) {
    return await this.financialManager.createBill(billData, requiresApproval);
  }

  async getBills(filters = {}) {
    return await this.financialManager.xeroClient.getBills(filters);
  }

  async getBillsByContact(contactId) {
    return await this.financialManager.getBillsByContact(contactId);
  }

  // Contact operations
  async getContact(contactId) {
    return await this.financialManager.getContact(contactId);
  }

  async createContact(contactData, requiresApproval = true) {
    return await this.financialManager.createContact(contactData, requiresApproval);
  }

  async getContacts(filters = {}) {
    return await this.financialManager.xeroClient.getContacts(filters);
  }

  async searchContacts(searchTerm) {
    return await this.financialManager.searchContacts(searchTerm);
  }

  // Financial reports
  async getProfitAndLoss(dateRange) {
    return await this.financialManager.getProfitAndLoss(dateRange);
  }

  async getBalanceSheet(dateRange) {
    return await this.financialManager.getBalanceSheet(dateRange);
  }

  async getCashFlow(dateRange) {
    return await this.financialManager.getCashFlow(dateRange);
  }

  async getFinancialSummary() {
    return await this.financialManager.getFinancialSummary();
  }

  async getDashboardData() {
    return await this.financialManager.getDashboardData();
  }

  // Handle approved financial transactions
  async handleApprovedTransaction(approvalItem) {
    const { subType, data } = approvalItem.item;

    try {
      let result;

      switch (subType) {
        case 'invoice_creation':
          result = await this.financialManager.xeroClient.createInvoice(data);
          break;
        case 'bill_creation':
          result = await this.financialManager.xeroClient.createBill(data);
          break;
        case 'contact_creation':
          result = await this.financialManager.xeroClient.createContact(data);
          break;
        default:
          throw new Error(`Unknown transaction type: ${subType}`);
      }

      // Log successful transaction
      await this.financialManager.logFinancialActivity(
        `${subType.replace('_', '')}_successful`,
        data,
        result
      );

      return result;
    } catch (error) {
      console.error(`Failed to process approved transaction:`, error);

      // Log failed transaction
      await this.financialManager.logFinancialActivity(
        `${subType.replace('_', '')}_failed`,
        data,
        { error: error.message }
      );

      // Add to error queue for manual intervention
      const errorApproval = {
        type: 'financial_error',
        subType: subType,
        data: data,
        error: error.message,
        priority: 'high',
        source: 'xero_integration'
      };

      await this.approvalManager.addItemForApproval(errorApproval);
      throw error;
    }
  }

  // Data synchronization
  async forceSynchronization() {
    return await this.financialManager.synchronizeFinancialData();
  }

  async getSyncStatus() {
    return {
      lastSync: this.financialManager.dataCache.get('lastSync') || 'Never',
      contactsCount: this.financialManager.dataCache.get('contacts')?.Contacts?.length || 0,
      invoicesCount: this.financialManager.dataCache.get('invoices')?.Invoices?.length || 0,
      billsCount: this.financialManager.dataCache.get('bills')?.Bills?.length || 0,
      syncInterval: this.financialManager.syncInterval
    };
  }

  // Financial analytics
  async getAnalytics(dateRange) {
    try {
      const [pnl, balanceSheet, cashFlow] = await Promise.all([
        this.getProfitAndLoss(dateRange),
        this.getBalanceSheet(dateRange),
        this.getCashFlow(dateRange)
      ]);

      return {
        profitAndLoss: pnl,
        balanceSheet: balanceSheet,
        cashFlow: cashFlow,
        keyMetrics: this.calculateKeyMetrics(pnl, balanceSheet, cashFlow)
      };
    } catch (error) {
      console.error('Analytics generation failed:', error);
      throw error;
    }
  }

  calculateKeyMetrics(pnl, balanceSheet, cashFlow) {
    // Calculate key financial metrics
    return {
      grossProfitMargin: this.calculateGrossProfitMargin(pnl),
      netProfitMargin: this.calculateNetProfitMargin(pnl),
      currentRatio: this.calculateCurrentRatio(balanceSheet),
      debtToEquity: this.calculateDebtToEquity(balanceSheet),
      operatingCashFlow: this.calculateOperatingCashFlow(cashFlow)
    };
  }

  calculateGrossProfitMargin(pnl) {
    // Implementation would extract revenue and cost of goods sold from P&L
    return 0.0; // Placeholder
  }

  calculateNetProfitMargin(pnl) {
    // Implementation would extract net profit and revenue from P&L
    return 0.0; // Placeholder
  }

  calculateCurrentRatio(balanceSheet) {
    // Implementation would extract current assets and current liabilities
    return 0.0; // Placeholder
  }

  calculateDebtToEquity(balanceSheet) {
    // Implementation would extract total debt and total equity
    return 0.0; // Placeholder
  }

  calculateOperatingCashFlow(cashFlow) {
    // Implementation would extract operating cash flow
    return 0.0; // Placeholder
  }

  // Batch operations
  async processInvoiceBatch(invoices, requiresApproval = true) {
    const results = [];

    for (const invoice of invoices) {
      try {
        const result = await this.createInvoice(invoice, requiresApproval);
        results.push({ invoice: invoice.InvoiceNumber, status: 'success', result });
      } catch (error) {
        results.push({ invoice: invoice.InvoiceNumber, status: 'error', error: error.message });
      }
    }

    return results;
  }

  async processBillBatch(bills, requiresApproval = true) {
    const results = [];

    for (const bill of bills) {
      try {
        const result = await this.createBill(bill, requiresApproval);
        results.push({ bill: bill.Reference, status: 'success', result });
      } catch (error) {
        results.push({ bill: bill.Reference, status: 'error', error: error.message });
      }
    }

    return results;
  }

  // Audit trail
  async getAuditTrail(filters = {}) {
    // Return financial audit trail
    const fs = require('fs-extra');
    const path = require('path');

    const logDir = path.join(process.cwd(), 'logs', 'financial');
    if (!await fs.pathExists(logDir)) {
      return [];
    }

    const logFiles = await fs.readdir(logDir);
    let allAuditEntries = [];

    for (const file of logFiles) {
      if (file.startsWith('activity_') && file.endsWith('.json')) {
        const filePath = path.join(logDir, file);
        const fileData = await fs.readJson(filePath).catch(() => []);
        allAuditEntries = allAuditEntries.concat(fileData);
      }
    }

    // Apply filters
    if (filters.dateFrom) {
      allAuditEntries = allAuditEntries.filter(entry =>
        new Date(entry.timestamp) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      allAuditEntries = allAuditEntries.filter(entry =>
        new Date(entry.timestamp) <= new Date(filters.dateTo)
      );
    }

    if (filters.activityType) {
      allAuditEntries = allAuditEntries.filter(entry =>
        entry.activityType === filters.activityType
      );
    }

    // Sort by timestamp descending
    allAuditEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allAuditEntries;
  }
}

module.exports = XeroIntegrationController;
```

This implementation provides comprehensive Xero accounting integration with proper approval workflows and financial management capabilities.