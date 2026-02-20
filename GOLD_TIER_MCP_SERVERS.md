# Gold Tier: Multiple MCP Servers Configuration

## Overview
Configuration for multiple specialized MCP servers to handle different action types in the Gold Tier autonomous employee system.

## MCP Server Types

### 1. Communication MCP Server
Handles all communication-related actions:
- Email sending/receiving
- SMS/Messaging
- Social media posting
- Notification delivery

### 2. Business Operations MCP Server
Manages business-specific operations:
- Financial transactions
- Business reporting
- Audit compliance
- Document generation

### 3. Personal Assistance MCP Server
Handles personal assistance tasks:
- Calendar management
- Task scheduling
- Personal reminders
- Health/wellness tracking

### 4. Integration MCP Server
Coordinates cross-domain integration:
- Data synchronization
- Event correlation
- Domain bridging
- Workflow orchestration

## Configuration Files

### MCP Server Registry (`mcp_servers.json`)
```json
{
  "servers": [
    {
      "id": "communication-mcp",
      "name": "Communication MCP Server",
      "type": "communication",
      "port": 3001,
      "capabilities": [
        "email-send",
        "email-receive",
        "sms-send",
        "social-post",
        "notification-send"
      ],
      "config": {
        "email": {
          "smtp_host": "${SMTP_HOST}",
          "smtp_port": "${SMTP_PORT}",
          "imap_host": "${IMAP_HOST}",
          "imap_port": "${IMAP_PORT}"
        },
        "social": {
          "linkedin_enabled": true,
          "twitter_enabled": false
        }
      }
    },
    {
      "id": "business-operations-mcp",
      "name": "Business Operations MCP Server",
      "type": "business-operations",
      "port": 3002,
      "capabilities": [
        "financial-report",
        "audit-log",
        "document-gen",
        "compliance-check"
      ],
      "config": {
        "financial": {
          "bank_api_key": "${BANK_API_KEY}",
          "account_ids": ["${BUSINESS_ACCOUNT_ID}"]
        },
        "reporting": {
          "templates_dir": "./templates/business_reports",
          "output_dir": "./reports"
        }
      }
    },
    {
      "id": "personal-assistance-mcp",
      "name": "Personal Assistance MCP Server",
      "type": "personal-assistance",
      "port": 3003,
      "capabilities": [
        "calendar-manage",
        "task-schedule",
        "reminder-set",
        "health-track"
      ],
      "config": {
        "calendar": {
          "provider": "google",
          "credentials_path": "./credentials/google_calendar.json"
        },
        "tasks": {
          "storage_path": "./data/tasks.json"
        }
      }
    },
    {
      "id": "integration-mcp",
      "name": "Integration MCP Server",
      "type": "integration",
      "port": 3004,
      "capabilities": [
        "data-sync",
        "event-correlate",
        "domain-bridge",
        "workflow-orchestrate"
      ],
      "config": {
        "domains": {
          "personal": {
            "api_endpoint": "http://localhost:4001/personal",
            "auth_token": "${PERSONAL_DOMAIN_TOKEN}"
          },
          "business": {
            "api_endpoint": "http://localhost:4002/business",
            "auth_token": "${BUSINESS_DOMAIN_TOKEN}"
          }
        },
        "sync": {
          "interval_ms": 30000,
          "batch_size": 100
        }
      }
    }
  ]
}
```

### MCP Server Startup Script (`start_mcp_servers.js`)
```javascript
const { spawn } = require('child_process');
const fs = require('fs');

// Load server configuration
const config = JSON.parse(fs.readFileSync('./mcp_servers.json', 'utf8'));

// Start each MCP server
config.servers.forEach(server => {
  console.log(`Starting ${server.name} on port ${server.port}`);

  // Spawn the MCP server process
  const child = spawn('node', ['mcp_server.js'], {
    env: {
      ...process.env,
      SERVER_ID: server.id,
      SERVER_NAME: server.name,
      SERVER_PORT: server.port,
      SERVER_CONFIG: JSON.stringify(server.config),
      CAPABILITIES: server.capabilities.join(',')
    }
  });

  // Handle server output
  child.stdout.on('data', (data) => {
    console.log(`[${server.id}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`[${server.id}] ERROR: ${data}`);
  });

  child.on('close', (code) => {
    console.log(`${server.name} exited with code ${code}`);
  });
});

console.log('All MCP servers started');
```

### Generic MCP Server Template (`mcp_server.js`)
```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Initialize server
const app = express();
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Get server configuration from environment
const serverId = process.env.SERVER_ID || 'unknown-server';
const serverName = process.env.SERVER_NAME || 'Generic MCP Server';
const serverPort = parseInt(process.env.SERVER_PORT) || 3000;
const serverConfig = JSON.parse(process.env.SERVER_CONFIG || '{}');
const capabilities = (process.env.CAPABILITIES || '').split(',').filter(c => c);

console.log(`Initializing ${serverName} with capabilities:`, capabilities);

// MCP Server Capabilities Endpoint
app.get('/capabilities', (req, res) => {
  res.json({
    id: serverId,
    name: serverName,
    capabilities: capabilities,
    config: serverConfig
  });
});

// Capability-specific routes based on server type
if (capabilities.includes('email-send')) {
  app.post('/send-email', async (req, res) => {
    try {
      // Email sending implementation
      const { to, subject, text, html } = req.body;

      // Placeholder for actual email sending logic
      console.log(`Sending email to: ${to}, subject: ${subject}`);

      res.json({ success: true, messageId: 'mock-message-id' });
    } catch (error) {
      console.error('Email sending error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

if (capabilities.includes('financial-report')) {
  app.post('/generate-report', async (req, res) => {
    try {
      // Financial report generation implementation
      const { reportType, dateRange, format } = req.body;

      // Placeholder for actual report generation logic
      console.log(`Generating ${reportType} report for ${dateRange}`);

      res.json({
        success: true,
        reportId: 'mock-report-id',
        downloadUrl: '/reports/mock-report-id'
      });
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

if (capabilities.includes('calendar-manage')) {
  app.post('/manage-calendar', async (req, res) => {
    try {
      // Calendar management implementation
      const { action, eventDetails } = req.body;

      // Placeholder for actual calendar management logic
      console.log(`Calendar action: ${action}`, eventDetails);

      res.json({ success: true, eventId: 'mock-event-id' });
    } catch (error) {
      console.error('Calendar management error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

if (capabilities.includes('data-sync')) {
  app.post('/sync-data', async (req, res) => {
    try {
      // Data synchronization implementation
      const { source, destination, entities } = req.body;

      // Placeholder for actual data sync logic
      console.log(`Syncing ${entities.length} entities from ${source} to ${destination}`);

      res.json({
        success: true,
        syncedCount: entities.length,
        durationMs: 123
      });
    } catch (error) {
      console.error('Data sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    serverId,
    capabilities,
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(serverPort, () => {
  console.log(`${serverName} listening on port ${serverPort}`);
  console.log(`Capabilities: ${capabilities.join(', ')}`);
});
```

### MCP Client for Inter-Server Communication (`mcp_client.js`)
```javascript
const axios = require('axios');

class MCPServerClient {
  constructor(serversConfig) {
    this.servers = {};

    // Initialize clients for each server
    serversConfig.forEach(server => {
      this.servers[server.id] = {
        baseUrl: `http://localhost:${server.port}`,
        capabilities: server.capabilities,
        config: server.config
      };
    });
  }

  // Find server that supports a specific capability
  findServerForCapability(capability) {
    for (const serverId in this.servers) {
      const server = this.servers[serverId];
      if (server.capabilities.includes(capability)) {
        return {
          id: serverId,
          baseUrl: server.baseUrl,
          config: server.config
        };
      }
    }
    return null;
  }

  // Execute a capability
  async executeCapability(capability, params) {
    const server = this.findServerForCapability(capability);
    if (!server) {
      throw new Error(`No server found supporting capability: ${capability}`);
    }

    // Map capability to appropriate endpoint
    let endpoint;
    switch (capability) {
      case 'email-send':
        endpoint = '/send-email';
        break;
      case 'financial-report':
        endpoint = '/generate-report';
        break;
      case 'calendar-manage':
        endpoint = '/manage-calendar';
        break;
      case 'data-sync':
        endpoint = '/sync-data';
        break;
      default:
        throw new Error(`Unknown capability: ${capability}`);
    }

    try {
      const response = await axios.post(`${server.baseUrl}${endpoint}`, params);
      return response.data;
    } catch (error) {
      console.error(`Error executing capability ${capability}:`, error.message);
      throw error;
    }
  }

  // Get server health
  async getHealth() {
    const healthResults = {};

    for (const serverId in this.servers) {
      try {
        const response = await axios.get(`${this.servers[serverId].baseUrl}/health`);
        healthResults[serverId] = response.data;
      } catch (error) {
        healthResults[serverId] = { status: 'unhealthy', error: error.message };
      }
    }

    return healthResults;
  }
}

module.exports = MCPServerClient;
```

## Deployment Configuration

### Docker Compose (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  communication-mcp:
    build: .
    ports:
      - "3001:3001"
    environment:
      - SERVER_ID=communication-mcp
      - SERVER_NAME=Communication MCP Server
      - SERVER_PORT=3001
      - CAPABILITIES=email-send,email-receive,social-post,notification-send
    volumes:
      - ./mcp_servers.json:/app/mcp_servers.json
      - ./config:/app/config
    restart: unless-stopped

  business-operations-mcp:
    build: .
    ports:
      - "3002:3002"
    environment:
      - SERVER_ID=business-operations-mcp
      - SERVER_NAME=Business Operations MCP Server
      - SERVER_PORT=3002
      - CAPABILITIES=financial-report,audit-log,document-gen,compliance-check
    volumes:
      - ./mcp_servers.json:/app/mcp_servers.json
      - ./config:/app/config
    restart: unless-stopped

  personal-assistance-mcp:
    build: .
    ports:
      - "3003:3003"
    environment:
      - SERVER_ID=personal-assistance-mcp
    - SERVER_NAME=Personal Assistance MCP Server
      - SERVER_PORT=3003
      - CAPABILITIES=calendar-manage,task-schedule,reminder-set,health-track
    volumes:
      - ./mcp_servers.json:/app/mcp_servers.json
      - ./config:/app/config
    restart: unless-stopped

  integration-mcp:
    build: .
    ports:
      - "3004:3004"
    environment:
      - SERVER_ID=integration-mcp
      - SERVER_NAME=Integration MCP Server
      - SERVER_PORT=3004
      - CAPABILITIES=data-sync,event-correlate,domain-bridge,workflow-orchestrate
    volumes:
      - ./mcp_servers.json:/app/mcp_servers.json
      - ./config:/app/config
    restart: unless-stopped
```

This configuration provides a robust foundation for multiple specialized MCP servers that can handle different action types while maintaining proper separation of concerns and scalability.