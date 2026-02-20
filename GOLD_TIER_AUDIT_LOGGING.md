# Gold Tier: Comprehensive Audit Logging System

## Overview
A robust audit logging system that captures all system activities, user actions, security events, and system operations for compliance, security, and operational analysis.

## Components

### 1. Audit Logger Core
- Centralized logging facility
- Structured log format
- Log level management

### 2. Audit Categories
- System operations
- User actions
- Security events
- Compliance activities
- Data access
- API interactions

### 3. Log Storage
- Persistent storage solutions
- Log rotation and archival
- Search and retrieval capabilities

### 4. Monitoring and Alerts
- Real-time log analysis
- Anomaly detection
- Alert generation

## Implementation

### Audit Logger Core (`audit_logger.js`)
```javascript
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class AuditLogger {
  constructor(config) {
    this.config = config || {};
    this.logDir = this.config.logDir || './logs/audit';
    this.logLevel = this.config.logLevel || 'info';
    this.maxFileSize = this.config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.retentionDays = this.config.retentionDays || 90;
    this.bufferSize = this.config.bufferSize || 100;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Initialize log buffer
    this.logBuffer = [];
    this.currentLogFile = this.getLogFilePath();

    // Set up log rotation
    this.setupLogRotation();

    // Set up cleanup for old logs
    this.setupLogCleanup();
  }

  setupLogRotation() {
    // Rotate log file if it gets too large
    setInterval(() => {
      this.rotateLogFileIfNeeded();
    }, 300000); // Check every 5 minutes
  }

  setupLogCleanup() {
    // Clean up old log files periodically
    setInterval(() => {
      this.cleanupOldLogs();
    }, 3600000); // Run every hour
  }

  getLogFilePath() {
    const date = moment().format('YYYY-MM-DD');
    return path.join(this.logDir, `audit_${date}.log`);
  }

  rotateLogFileIfNeeded() {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size > this.maxFileSize) {
          this.currentLogFile = this.getLogFilePath();
        }
      }
    } catch (error) {
      console.error('Error checking log file rotation:', error);
    }
  }

  cleanupOldLogs() {
    try {
      const now = new Date();
      const files = fs.readdirSync(this.logDir);

      files.forEach(file => {
        if (file.startsWith('audit_') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);

          const fileDate = new Date(stats.birthtime);
          const daysDiff = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));

          if (daysDiff > this.retentionDays) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }

  async log(level, category, action, details, userId = null, sessionId = null) {
    if (!this.shouldLog(level)) {
      return;
    }

    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      category: category,
      action: action,
      details: details,
      userId: userId,
      sessionId: sessionId,
      ipAddress: details.ipAddress || null,
      userAgent: details.userAgent || null,
      correlationId: details.correlationId || uuidv4(),
      source: details.source || 'system',
      metadata: {
        hostname: require('os').hostname(),
        processId: process.pid,
        threadId: 'main'
      }
    };

    // Add to buffer
    this.logBuffer.push(JSON.stringify(auditEntry));

    // Write to file if buffer is full or periodically
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }

    return auditEntry.id;
  }

  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.logLevel.toLowerCase());
    const messageLevelIndex = levels.indexOf(level.toLowerCase());

    return messageLevelIndex >= currentLevelIndex;
  }

  async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    try {
      const logEntry = this.logBuffer.join('\n') + '\n';
      fs.appendFileSync(this.currentLogFile, logEntry);
      this.logBuffer = [];
    } catch (error) {
      console.error('Error flushing audit log buffer:', error);
      // Keep buffer for retry
    }
  }

  // Convenience methods for different log levels
  async debug(category, action, details, userId, sessionId) {
    return await this.log('debug', category, action, details, userId, sessionId);
  }

  async info(category, action, details, userId, sessionId) {
    return await this.log('info', category, action, details, userId, sessionId);
  }

  async warn(category, action, details, userId, sessionId) {
    return await this.log('warn', category, action, details, userId, sessionId);
  }

  async error(category, action, details, userId, sessionId) {
    return await this.log('error', category, action, details, userId, sessionId);
  }

  async fatal(category, action, details, userId, sessionId) {
    return await this.log('fatal', category, action, details, userId, sessionId);
  }

  // Specific audit event methods
  async logUserLogin(userId, ipAddress, userAgent, sessionId) {
    return await this.info('AUTHENTICATION', 'USER_LOGIN', {
      userId,
      ipAddress,
      userAgent,
      sessionId
    }, userId, sessionId);
  }

  async logUserLogout(userId, sessionId) {
    return await this.info('AUTHENTICATION', 'USER_LOGOUT', {
      userId,
      sessionId
    }, userId, sessionId);
  }

  async logDataAccess(userId, resourceId, action, details) {
    return await this.info('DATA_ACCESS', 'RESOURCE_ACCESS', {
      userId,
      resourceId,
      action,
      details
    }, userId);
  }

  async logSecurityEvent(eventType, severity, details, userId) {
    return await this.warn('SECURITY', eventType, {
      severity,
      details,
      userId
    }, userId);
  }

  async logSystemEvent(eventType, details, source) {
    return await this.info('SYSTEM', eventType, {
      details,
      source
    });
  }

  async logComplianceEvent(regulation, requirement, status, details) {
    return await this.info('COMPLIANCE', regulation, {
      requirement,
      status,
      details
    });
  }

  async logApiCall(apiEndpoint, method, userId, responseTime, statusCode) {
    return await this.info('API', 'API_CALL', {
      apiEndpoint,
      method,
      userId,
      responseTime,
      statusCode
    }, userId);
  }

  async logConfigurationChange(userId, configKey, oldValue, newValue) {
    return await this.info('CONFIGURATION', 'CONFIG_CHANGE', {
      configKey,
      oldValue,
      newValue
    }, userId);
  }

  async logErrorEvent(error, context, userId) {
    return await this.error('ERROR', 'APPLICATION_ERROR', {
      errorMessage: error.message,
      stackTrace: error.stack,
      context,
      userId
    }, userId);
  }

  // Force flush remaining buffer when shutting down
  async shutdown() {
    await this.flushBuffer();
  }
}

module.exports = AuditLogger;
```

### Audit Query Service (`audit_query_service.js`)
```javascript
const fs = require('fs');
const path = require('path');
const moment = require('moment');

class AuditQueryService {
  constructor(logger) {
    this.logger = logger;
    this.logDir = logger.logDir;
  }

  async search(filters = {}, pagination = { page: 1, limit: 100 }) {
    const {
      startDate,
      endDate,
      level,
      category,
      action,
      userId,
      sessionId,
      searchTerm
    } = filters;

    const allLogs = await this.getAllLogsInRange(startDate, endDate);
    let filteredLogs = allLogs;

    // Apply filters
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }

    if (sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === sessionId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        JSON.stringify(log).toLowerCase().includes(term)
      );
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const startIndex = (pagination.page - 1) * pagination.limit;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pagination.limit);

    return {
      results: paginatedLogs,
      totalCount: filteredLogs.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(filteredLogs.length / pagination.limit)
    };
  }

  async getAllLogsInRange(startDate, endDate) {
    const logs = [];

    // Determine which log files to read based on date range
    const start = startDate ? moment(startDate) : moment().subtract(7, 'days'); // Default to last 7 days
    const end = endDate ? moment(endDate) : moment();

    // Get log files for the date range
    const dates = [];
    let current = start.clone();

    while (current.isSameOrBefore(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current.add(1, 'day');
    }

    for (const date of dates) {
      const logFile = path.join(this.logDir, `audit_${date}.log`);
      if (fs.existsSync(logFile)) {
        const fileContent = fs.readFileSync(logFile, 'utf8');
        const lines = fileContent.trim().split('\n').filter(line => line);

        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            if (!startDate || new Date(logEntry.timestamp) >= new Date(startDate)) {
              if (!endDate || new Date(logEntry.timestamp) <= new Date(endDate)) {
                logs.push(logEntry);
              }
            }
          } catch (error) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }

    return logs;
  }

  async getStats(filters = {}) {
    const searchResults = await this.search(filters);
    const logs = searchResults.results;

    // Calculate statistics
    const stats = {
      totalEntries: logs.length,
      levels: {},
      categories: {},
      users: {},
      timeRange: {
        start: null,
        end: null
      },
      hourlyDistribution: {},
      dailyDistribution: {}
    };

    if (logs.length > 0) {
      stats.timeRange.start = logs[logs.length - 1].timestamp;
      stats.timeRange.end = logs[0].timestamp;
    }

    logs.forEach(log => {
      // Count by level
      stats.levels[log.level] = (stats.levels[log.level] || 0) + 1;

      // Count by category
      stats.categories[log.category] = (stats.categories[log.category] || 0) + 1;

      // Count by user
      if (log.userId) {
        stats.users[log.userId] = (stats.users[log.userId] || 0) + 1;
      }

      // Hourly distribution
      const hour = moment(log.timestamp).format('YYYY-MM-DD HH');
      stats.hourlyDistribution[hour] = (stats.hourlyDistribution[hour] || 0) + 1;

      // Daily distribution
      const day = moment(log.timestamp).format('YYYY-MM-DD');
      stats.dailyDistribution[day] = (stats.dailyDistribution[day] || 0) + 1;
    });

    return stats;
  }

  async exportLogs(filters, format = 'json') {
    const searchResults = await this.search(filters, { page: 1, limit: 10000 }); // Large limit for export

    switch (format) {
      case 'csv':
        return this.convertToCSV(searchResults.results);
      case 'json':
      default:
        return JSON.stringify(searchResults.results, null, 2);
    }
  }

  convertToCSV(logs) {
    if (logs.length === 0) return '';

    // Get all unique keys from logs
    const allKeys = new Set();
    logs.forEach(log => {
      Object.keys(log).forEach(key => allKeys.add(key));
    });

    const keys = Array.from(allKeys).sort();

    // Create CSV header
    let csv = keys.join(',') + '\n';

    // Create CSV rows
    logs.forEach(log => {
      const row = keys.map(key => {
        let value = log[key];
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        // Escape commas and quotes for CSV
        value = String(value).replace(/"/g, '""');
        return `"${value}"`;
      }).join(',');
      csv += row + '\n';
    });

    return csv;
  }

  async getSecurityEvents(securityLevel = 'high', timeRangeHours = 24) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

    const filters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      category: 'SECURITY'
    };

    if (securityLevel === 'high') {
      filters.level = 'WARN';
    } else if (securityLevel === 'critical') {
      filters.level = 'ERROR';
    }

    return await this.search(filters);
  }

  async getUserActivity(userId, days = 30) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      userId: userId
    };

    return await this.search(filters);
  }

  async getDataAccessEvents(resourceId, userId = null, days = 7) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      category: 'DATA_ACCESS',
      action: 'RESOURCE_ACCESS'
    };

    if (resourceId) {
      filters.searchTerm = resourceId;
    }

    if (userId) {
      filters.userId = userId;
    }

    return await this.search(filters);
  }

  async getComplianceReports(days = 90) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      category: 'COMPLIANCE'
    };

    return await this.search(filters);
  }
}

module.exports = AuditQueryService;
```

### Audit Middleware (`audit_middleware.js`)
```javascript
class AuditMiddleware {
  constructor(auditLogger) {
    this.logger = auditLogger;
  }

  // Express/Koa compatible middleware for API requests
  createApiAuditMiddleware() {
    return async (ctx, next) => {
      const startTime = Date.now();
      const userId = ctx.state.user?.id || null;
      const sessionId = ctx.headers['x-session-id'] || null;

      try {
        await next();

        // Log successful API call
        await this.logger.logApiCall(
          ctx.path,
          ctx.method,
          userId,
          Date.now() - startTime,
          ctx.status
        );
      } catch (error) {
        // Log failed API call
        await this.logger.logApiCall(
          ctx.path,
          ctx.method,
          userId,
          Date.now() - startTime,
          ctx.status
        );

        // Log the error
        await this.logger.logErrorEvent(error, {
          path: ctx.path,
          method: ctx.method,
          userId,
          sessionId
        }, userId);

        throw error;
      }
    };
  }

  // Generic audit wrapper for functions
  auditFunction(category, action) {
    return async (fn) => {
      return async (...args) => {
        const startTime = Date.now();
        const context = args[args.length - 1]; // Assume last arg is context/user info

        try {
          const result = await fn(...args);

          await this.logger.info(category, action, {
            duration: Date.now() - startTime,
            success: true,
            args: args.slice(0, -1) // Exclude context from args
          }, context?.userId, context?.sessionId);

          return result;
        } catch (error) {
          await this.logger.error(category, action, {
            duration: Date.now() - startTime,
            success: false,
            error: error.message,
            args: args.slice(0, -1)
          }, context?.userId, context?.sessionId);

          throw error;
        }
      };
    };
  }

  // Data access audit
  async auditDataAccess(userId, resourceId, action, context = {}) {
    return await this.logger.logDataAccess(userId, resourceId, action, {
      ...context,
      action,
      timestamp: new Date().toISOString()
    });
  }

  // Security event audit
  async auditSecurityEvent(eventType, severity, details, userId) {
    return await this.logger.logSecurityEvent(eventType, severity, details, userId);
  }

  // Configuration change audit
  async auditConfigChange(userId, configKey, oldValue, newValue) {
    return await this.logger.logConfigurationChange(userId, configKey, oldValue, newValue);
  }

  // Compliance audit
  async auditComplianceEvent(regulation, requirement, status, details) {
    return await this.logger.logComplianceEvent(regulation, requirement, status, details);
  }
}

module.exports = AuditMiddleware;
```

### Audit Configuration and Setup (`audit_setup.js`)
```javascript
const AuditLogger = require('./audit_logger');
const AuditQueryService = require('./audit_query_service');
const AuditMiddleware = require('./audit_middleware');

class AuditSystem {
  constructor(config) {
    this.config = config;
    this.logger = null;
    this.queryService = null;
    this.middleware = null;
  }

  async initialize() {
    // Initialize audit logger
    this.logger = new AuditLogger(this.config.logger);

    // Initialize query service
    this.queryService = new AuditQueryService(this.logger);

    // Initialize middleware
    this.middleware = new AuditMiddleware(this.logger);

    // Log system initialization
    await this.logger.logSystemEvent('AUDIT_SYSTEM_INITIALIZED', {
      config: this.config,
      timestamp: new Date().toISOString()
    });

    console.log('Audit system initialized successfully');
  }

  getLogger() {
    return this.logger;
  }

  getQueryService() {
    return this.queryService;
  }

  getMiddleware() {
    return this.middleware;
  }

  async shutdown() {
    if (this.logger) {
      await this.logger.shutdown();
    }
  }

  // Predefined audit event creators
  createAuditEvents() {
    const logger = this.logger;

    return {
      // Authentication events
      userLogin: (userId, ip, userAgent, sessionId) =>
        logger.logUserLogin(userId, ip, userAgent, sessionId),

      userLogout: (userId, sessionId) =>
        logger.logUserLogout(userId, sessionId),

      // Security events
      securityAlert: (type, severity, details, userId) =>
        logger.logSecurityEvent(type, severity, details, userId),

      failedLogin: (username, ip, reason) =>
        logger.logSecurityEvent('FAILED_LOGIN_ATTEMPT', 'HIGH', {
          username, ip, reason
        }),

      suspiciousActivity: (userId, activity, details) =>
        logger.logSecurityEvent('SUSPICIOUS_ACTIVITY', 'MEDIUM', {
          activity, details
        }, userId),

      // Data access events
      dataView: (userId, resourceId) =>
        logger.logDataAccess(userId, resourceId, 'VIEW', {}),

      dataModify: (userId, resourceId, changes) =>
        logger.logDataAccess(userId, resourceId, 'MODIFY', { changes }),

      dataDelete: (userId, resourceId) =>
        logger.logDataAccess(userId, resourceId, 'DELETE', {}),

      // System events
      systemStart: () => logger.logSystemEvent('SYSTEM_START', {}),
      systemStop: () => logger.logSystemEvent('SYSTEM_STOP', {}),
      systemError: (error, context) => logger.logErrorEvent(error, context),

      // Compliance events
      gdprAccess: (userId, requestData) =>
        logger.logComplianceEvent('GDPR', 'RIGHT_TO_ACCESS', 'FULFILLED', {
          userId, requestData
        }),

      gdprDeletion: (userId, deletionReason) =>
        logger.logComplianceEvent('GDPR', 'RIGHT_TO_ERASURE', 'FULFILLED', {
          userId, deletionReason
        })
    };
  }
}

// Export a singleton instance or factory function
module.exports = {
  AuditSystem,
  AuditLogger,
  AuditQueryService,
  AuditMiddleware
};
```

### Audit CLI Tool (`audit_cli.js`)
```javascript
#!/usr/bin/env node

const { AuditSystem } = require('./audit_setup');
const fs = require('fs');

async function runAuditCLI() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Load configuration
  const configPath = './audit_config.json';
  let config = {
    logger: {
      logDir: './logs/audit',
      logLevel: 'info',
      maxFileSize: 10 * 1024 * 1024,
      retentionDays: 90
    }
  };

  if (fs.existsSync(configPath)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }

  const auditSystem = new AuditSystem(config);
  await auditSystem.initialize();

  const queryService = auditSystem.getQueryService();

  switch (command) {
    case 'search':
      const filters = parseFilters(args.slice(1));
      const results = await queryService.search(filters);
      console.log(JSON.stringify(results, null, 2));
      break;

    case 'stats':
      const statsFilters = parseFilters(args.slice(1));
      const stats = await queryService.getStats(statsFilters);
      console.log(JSON.stringify(stats, null, 2));
      break;

    case 'export':
      const exportFilters = parseFilters(args.slice(2)); // First arg after 'export' is format
      const format = args[1] || 'json';
      const exported = await queryService.exportLogs(exportFilters, format);
      console.log(exported);
      break;

    case 'security-events':
      const securityLevel = args[1] || 'high';
      const timeRange = parseInt(args[2]) || 24;
      const securityEvents = await queryService.getSecurityEvents(securityLevel, timeRange);
      console.log(JSON.stringify(securityEvents, null, 2));
      break;

    default:
      console.log(`
Audit CLI Tool Usage:

  audit search [filters...]     - Search audit logs
  audit stats [filters...]      - Get audit statistics
  audit export <format> [filters...] - Export audit logs (format: json, csv)
  audit security-events [level] [hours] - Get security events (level: high, critical)

Filters:
  --start-date <date>          - Start date (ISO format)
  --end-date <date>            - End date (ISO format)
  --level <level>              - Log level (debug, info, warn, error, fatal)
  --category <category>        - Audit category
  --action <action>            - Specific action
  --user-id <id>               - User ID
  --session-id <id>            - Session ID
  --search <term>              - Search term

Examples:
  audit search --category AUTHENTICATION --start-date 2023-01-01
  audit stats --level error --start-date 2023-01-01 --end-date 2023-01-31
  audit export csv --category SECURITY --level warn
      `);
  }

  await auditSystem.shutdown();
}

function parseFilters(args) {
  const filters = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (key && value) {
      switch (key) {
        case '--start-date':
          filters.startDate = value;
          break;
        case '--end-date':
          filters.endDate = value;
          break;
        case '--level':
          filters.level = value;
          break;
        case '--category':
          filters.category = value;
          break;
        case '--action':
          filters.action = value;
          break;
        case '--user-id':
          filters.userId = value;
          break;
        case '--session-id':
          filters.sessionId = value;
          break;
        case '--search':
          filters.searchTerm = value;
          break;
      }
    }
  }

  return filters;
}

if (require.main === module) {
  runAuditCLI().catch(console.error);
}

module.exports = { runAuditCLI, parseFilters };
```

This comprehensive audit logging system provides robust logging, querying, and monitoring capabilities for the Gold Tier autonomous employee system.