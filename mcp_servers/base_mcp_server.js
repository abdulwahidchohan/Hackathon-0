/**
 * Base MCP Server Implementation
 * Provides common functionality for all specialized MCP servers
 * Gold Tier - Personal AI Employee System
 */

const express = require('express');
const axios = require('axios');

class BaseMCPServer {
  constructor(config) {
    this.config = config;
    this.serverId = config.serverId;
    this.port = config.port || 3000;
    this.name = config.name || 'MCP Server';
    this.capabilities = config.capabilities || [];

    this.app = express();
    this.server = null;
    this.startTime = null;

    // Setup middleware
    this.setupMiddleware();

    // Setup common routes
    this.setupCommonRoutes();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${this.serverId}] ${req.method} ${req.path}`);
      next();
    });
  }

  setupCommonRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        serverId: this.serverId,
        name: this.name,
        capabilities: this.capabilities,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        timestamp: new Date().toISOString()
      });
    });

    // Capabilities endpoint
    this.app.get('/capabilities', (req, res) => {
      res.json({
        id: this.serverId,
        name: this.name,
        capabilities: this.capabilities,
        endpoints: this.getEndpoints(),
        version: '1.0.0'
      });
    });

    // Server info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        id: this.serverId,
        name: this.name,
        port: this.port,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        startTime: this.startTime,
        capabilities: this.capabilities,
        config: this.getPublicConfig()
      });
    });
  }

  getEndpoints() {
    // Override in subclasses to return available endpoints
    return [];
  }

  getPublicConfig() {
    // Override in subclasses to return public configuration
    return {
      serverId: this.serverId,
      name: this.name,
      port: this.port
    };
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.startTime = Date.now();
          console.log(`[${this.serverId}] ${this.name} started on port ${this.port}`);
          console.log(`[${this.serverId}] Capabilities: ${this.capabilities.join(', ')}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error(`[${this.serverId}] Server error:`, error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`[${this.serverId}] ${this.name} stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Utility method for making requests to other MCP servers
  async callMCPServer(serverUrl, endpoint, method = 'GET', data = null) {
    try {
      const response = await axios({
        method,
        url: `${serverUrl}${endpoint}`,
        data,
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error(`[${this.serverId}] Error calling MCP server ${serverUrl}:`, error.message);
      throw error;
    }
  }

  // Utility method for logging to audit system
  async logAuditEvent(category, action, details) {
    // In production, this would call the audit logging system
    console.log(`[${this.serverId}] AUDIT: ${category} - ${action}`, details);
  }
}

module.exports = BaseMCPServer;
