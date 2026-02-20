# Gold Tier: Orchestrator and Watchdog System

## Overview
The orchestrator and watchdog system provides centralized coordination and monitoring of all autonomous employee functions, ensuring reliability and continuity of operations.

## Components

### 1. Task Orchestrator
- Coordinates execution of various tasks and workflows
- Manages dependencies and scheduling
- Handles task lifecycle management

### 2. System Watchdog
- Monitors system health and performance
- Detects and responds to failures
- Implements auto-healing mechanisms

### 3. Service Registry
- Tracks all running services and their status
- Provides service discovery capabilities
- Manages service lifecycles

## Implementation

### Task Orchestrator (`task_orchestrator.js`)
```javascript
const EventEmitter = require('events');
const cron = require('node-cron');

class TaskOrchestrator extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.tasks = new Map();
    this.workflows = new Map();
    this.runningTasks = new Map();
    this.taskQueue = [];
    this.workflowQueue = [];
    this.services = new Map();

    this.maxConcurrentTasks = config.maxConcurrentTasks || 5;
    this.taskTimeout = config.taskTimeout || 300000; // 5 minutes
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 5000; // 5 seconds

    this.initialize();
  }

  async initialize() {
    console.log('Initializing Task Orchestrator...');

    // Set up monitoring
    this.setupMonitoring();

    // Start processing queues
    this.startProcessing();

    // Initialize cron jobs
    this.initializeCronJobs();
  }

  setupMonitoring() {
    // Monitor task completion
    this.on('task_completed', (taskId, result) => {
      console.log(`Task completed: ${taskId}`);
      this.emit('metrics_updated', {
        type: 'task_completion',
        taskId,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor task failures
    this.on('task_failed', (taskId, error) => {
      console.error(`Task failed: ${taskId}`, error);
      this.handleTaskFailure(taskId, error);
    });

    // Monitor workflow completion
    this.on('workflow_completed', (workflowId, result) => {
      console.log(`Workflow completed: ${workflowId}`);
    });

    // Monitor workflow failures
    this.on('workflow_failed', (workflowId, error) => {
      console.error(`Workflow failed: ${workflowId}`, error);
      this.handleWorkflowFailure(workflowId, error);
    });
  }

  async registerTask(taskId, taskFunction, config = {}) {
    const task = {
      id: taskId,
      function: taskFunction,
      config: {
        timeout: config.timeout || this.taskTimeout,
        maxRetries: config.maxRetries || this.retryAttempts,
        concurrency: config.concurrency || 1,
        dependencies: config.dependencies || [],
        schedule: config.schedule || null
      },
      status: 'registered',
      lastExecution: null,
      retryCount: 0
    };

    this.tasks.set(taskId, task);

    // If scheduled, add to cron
    if (task.config.schedule) {
      this.scheduleTask(taskId, task.config.schedule);
    }

    console.log(`Task registered: ${taskId}`);
    return taskId;
  }

  async registerWorkflow(workflowId, workflowDefinition) {
    const workflow = {
      id: workflowId,
      definition: workflowDefinition,
      status: 'registered',
      lastExecution: null
    };

    this.workflows.set(workflowId, workflow);
    console.log(`Workflow registered: ${workflowId}`);
    return workflowId;
  }

  async executeTask(taskId, params = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      // Add to queue if at max capacity
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ taskId, params, resolve, reject });
      });
    }

    const executionId = `${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    task.status = 'running';
    task.lastExecution = new Date().toISOString();

    const taskExecution = {
      id: executionId,
      taskId: taskId,
      params: params,
      startTime: new Date().toISOString(),
      status: 'running',
      retryCount: 0
    };

    this.runningTasks.set(executionId, taskExecution);

    try {
      // Execute with timeout
      const result = await this.executeTaskWithTimeout(task, params, task.config.timeout);

      taskExecution.status = 'completed';
      taskExecution.endTime = new Date().toISOString();
      taskExecution.result = result;

      this.runningTasks.delete(executionId);
      this.emit('task_completed', taskId, result);

      // Process queued tasks
      await this.processQueuedTasks();

      return result;
    } catch (error) {
      taskExecution.status = 'failed';
      taskExecution.endTime = new Date().toISOString();
      taskExecution.error = error.message;

      this.runningTasks.delete(executionId);
      this.emit('task_failed', taskId, error);

      // Handle retry logic
      if (taskExecution.retryCount < task.config.maxRetries) {
        taskExecution.retryCount++;
        setTimeout(() => {
          this.executeTask(taskId, params);
        }, this.retryDelay);
      } else {
        task.status = 'failed';
        throw error;
      }
    }
  }

  async executeTaskWithTimeout(task, params, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(task.function(params))
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async executeWorkflow(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = 'running';
    workflow.lastExecution = new Date().toISOString();

    const executionId = `${workflowId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await this.executeWorkflowSteps(workflow.definition.steps, context);

      workflow.status = 'completed';
      this.emit('workflow_completed', workflowId, result);

      return result;
    } catch (error) {
      workflow.status = 'failed';
      this.emit('workflow_failed', workflowId, error);
      throw error;
    }
  }

  async executeWorkflowSteps(steps, context) {
    let result = { ...context };

    for (const step of steps) {
      const stepResult = await this.executeTask(step.taskId, { ...step.params, ...result });
      result = { ...result, ...stepResult };
    }

    return result;
  }

  scheduleTask(taskId, cronExpression) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        await this.executeTask(taskId);
      } catch (error) {
        console.error(`Scheduled task failed: ${taskId}`, error);
      }
    });

    task.cronJob = job;
    console.log(`Task scheduled: ${taskId} with expression: ${cronExpression}`);
  }

  initializeCronJobs() {
    // Initialize any predefined cron jobs from config
    if (this.config.scheduledTasks) {
      for (const [taskId, cronExpr] of Object.entries(this.config.scheduledTasks)) {
        this.scheduleTask(taskId, cronExpr);
      }
    }
  }

  startProcessing() {
    // Start processing task queue
    setInterval(() => {
      this.processQueuedTasks();
    }, 1000);

    // Start processing workflow queue
    setInterval(() => {
      this.processQueuedWorkflows();
    }, 2000);
  }

  async processQueuedTasks() {
    if (this.taskQueue.length > 0 && this.runningTasks.size < this.maxConcurrentTasks) {
      const queuedTask = this.taskQueue.shift();
      try {
        const result = await this.executeTask(queuedTask.taskId, queuedTask.params);
        queuedTask.resolve(result);
      } catch (error) {
        queuedTask.reject(error);
      }
    }
  }

  async processQueuedWorkflows() {
    // Process workflow queue
    while (this.workflowQueue.length > 0 && this.runningTasks.size < this.maxConcurrentTasks - 2) {
      const queuedWorkflow = this.workflowQueue.shift();
      try {
        const result = await this.executeWorkflow(queuedWorkflow.workflowId, queuedWorkflow.context);
        queuedWorkflow.resolve(result);
      } catch (error) {
        queuedWorkflow.reject(error);
      }
    }
  }

  async handleTaskFailure(taskId, error) {
    console.error(`Handling task failure: ${taskId}`, error);

    // Log failure for monitoring
    this.emit('failure_detected', {
      type: 'task',
      id: taskId,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Implement any specific failure handling logic
    // For example, alerting, escalation, etc.
  }

  async handleWorkflowFailure(workflowId, error) {
    console.error(`Handling workflow failure: ${workflowId}`, error);

    // Log failure for monitoring
    this.emit('failure_detected', {
      type: 'workflow',
      id: workflowId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  async registerService(serviceId, serviceInstance) {
    const service = {
      id: serviceId,
      instance: serviceInstance,
      status: 'active',
      heartbeat: new Date().toISOString(),
      metrics: {}
    };

    this.services.set(serviceId, service);
    console.log(`Service registered: ${serviceId}`);
  }

  async deregisterService(serviceId) {
    this.services.delete(serviceId);
    console.log(`Service deregistered: ${serviceId}`);
  }

  async getServiceStatus(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      return null;
    }

    // Update heartbeat
    service.heartbeat = new Date().toISOString();
    return service;
  }

  getSystemMetrics() {
    return {
      taskQueueLength: this.taskQueue.length,
      workflowQueueLength: this.workflowQueue.length,
      runningTasks: this.runningTasks.size,
      totalTasks: this.tasks.size,
      totalWorkflows: this.workflows.size,
      totalServices: this.services.size,
      timestamp: new Date().toISOString()
    };
  }

  async shutdown() {
    console.log('Shutting down Task Orchestrator...');

    // Cancel all cron jobs
    for (const [taskId, task] of this.tasks) {
      if (task.cronJob) {
        task.cronJob.destroy();
      }
    }

    // Wait for running tasks to complete
    const runningTaskIds = Array.from(this.runningTasks.keys());
    for (const taskId of runningTaskIds) {
      // Allow running tasks to complete gracefully
      // In a real implementation, you might want to implement cancellation
    }

    console.log('Task Orchestrator shutdown complete');
  }
}

module.exports = TaskOrchestrator;
```

### System Watchdog (`system_watchdog.js`)
```javascript
const os = require('os');
const EventEmitter = require('events');

class SystemWatchdog extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.monitoredServices = new Map();
    this.heartbeats = new Map();
    this.alerts = [];
    this.metricsHistory = [];

    this.cpuThreshold = config.cpuThreshold || 80; // percentage
    this.memoryThreshold = config.memoryThreshold || 80; // percentage
    this.diskThreshold = config.diskThreshold || 85; // percentage
    this.networkThreshold = config.networkThreshold || 1000; // ms response time
    this.heartbeatInterval = config.heartbeatInterval || 30000; // 30 seconds
    this.checkInterval = config.checkInterval || 10000; // 10 seconds
    this.alertCooldown = config.alertCooldown || 300000; // 5 minutes

    this.lastAlerts = new Map();
    this.autoHealingEnabled = config.autoHealingEnabled !== false;

    this.initialize();
  }

  async initialize() {
    console.log('Initializing System Watchdog...');

    // Set up monitoring
    this.setupMonitoring();

    // Start health checks
    this.startHealthChecks();

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    // Start metrics collection
    this.startMetricsCollection();
  }

  setupMonitoring() {
    // Monitor system alerts
    this.on('system_alert', (alert) => {
      console.error(`System Alert: ${alert.type} - ${alert.message}`);
      this.handleSystemAlert(alert);
    });

    // Monitor service failures
    this.on('service_failure', (serviceId, error) => {
      console.error(`Service Failure: ${serviceId} - ${error.message}`);
      this.handleServiceFailure(serviceId, error);
    });

    // Monitor resource exhaustion
    this.on('resource_exhaustion', (resource, value) => {
      console.warn(`Resource Exhaustion: ${resource} at ${value}%`);
      this.handleResourceExhaustion(resource, value);
    });
  }

  startHealthChecks() {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.checkInterval);
  }

  startHeartbeatMonitoring() {
    setInterval(async () => {
      await this.checkHeartbeats();
    }, this.heartbeatInterval);
  }

  startMetricsCollection() {
    setInterval(async () => {
      await this.collectSystemMetrics();
    }, 5000); // Collect metrics every 5 seconds
  }

  async monitorService(serviceId, healthCheckFn, config = {}) {
    const service = {
      id: serviceId,
      healthCheck: healthCheckFn,
      config: {
        heartbeatInterval: config.heartbeatInterval || this.heartbeatInterval,
        timeout: config.timeout || 10000,
        autoRestart: config.autoRestart !== false
      },
      lastHeartbeat: new Date().toISOString(),
      status: 'unknown',
      consecutiveFailures: 0
    };

    this.monitoredServices.set(serviceId, service);
    console.log(`Started monitoring service: ${serviceId}`);
  }

  async performHealthCheck() {
    try {
      // Check system resources
      await this.checkSystemResources();

      // Check monitored services
      await this.checkMonitoredServices();

      // Check overall system health
      await this.checkOverallHealth();

    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  async checkSystemResources() {
    const metrics = await this.getSystemMetrics();

    // Check CPU usage
    if (metrics.cpuUsage > this.cpuThreshold) {
      this.emit('resource_exhaustion', 'cpu', metrics.cpuUsage);
      this.sendAlert('HIGH_CPU_USAGE', `CPU usage at ${metrics.cpuUsage}%`, metrics);
    }

    // Check memory usage
    if (metrics.memoryUsage > this.memoryThreshold) {
      this.emit('resource_exhaustion', 'memory', metrics.memoryUsage);
      this.sendAlert('HIGH_MEMORY_USAGE', `Memory usage at ${metrics.memoryUsage}%`, metrics);
    }

    // Check disk usage
    if (metrics.diskUsage > this.diskThreshold) {
      this.emit('resource_exhaustion', 'disk', metrics.diskUsage);
      this.sendAlert('HIGH_DISK_USAGE', `Disk usage at ${metrics.diskUsage}%`, metrics);
    }

    // Check network latency
    if (metrics.networkLatency > this.networkThreshold) {
      this.sendAlert('HIGH_NETWORK_LATENCY', `Network latency at ${metrics.networkLatency}ms`, metrics);
    }
  }

  async checkMonitoredServices() {
    for (const [serviceId, service] of this.monitoredServices) {
      try {
        const health = await this.checkServiceHealth(service);

        if (health.healthy) {
          service.status = 'healthy';
          service.consecutiveFailures = 0;

          // Update heartbeat
          service.lastHeartbeat = new Date().toISOString();
          this.heartbeats.set(serviceId, service.lastHeartbeat);
        } else {
          service.consecutiveFailures++;
          service.status = 'unhealthy';

          if (service.consecutiveFailures >= 3) { // After 3 consecutive failures
            this.emit('service_failure', serviceId, new Error(health.message));

            // Auto-healing attempt
            if (this.autoHealingEnabled && service.config.autoRestart) {
              await this.attemptAutoHealing(serviceId, service);
            }
          }
        }
      } catch (error) {
        service.consecutiveFailures++;
        service.status = 'error';
        console.error(`Error checking service ${serviceId}:`, error);
      }
    }
  }

  async checkServiceHealth(service) {
    try {
      const result = await Promise.race([
        service.healthCheck(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), service.config.timeout)
        )
      ]);

      return {
        healthy: result?.healthy !== false,
        message: result?.message || 'Service is healthy',
        details: result?.details
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message,
        details: { error: error.message }
      };
    }
  }

  async checkOverallHealth() {
    const metrics = await this.getSystemMetrics();
    const unhealthyServices = Array.from(this.monitoredServices.values())
      .filter(service => service.status !== 'healthy');

    const healthScore = this.calculateHealthScore(metrics, unhealthyServices);

    if (healthScore < 70) { // Unhealthy if score below 70
      this.sendAlert('SYSTEM_UNHEALTHY', `System health score: ${healthScore}`, {
        ...metrics,
        unhealthyServices: unhealthyServices.length
      });
    } else if (healthScore < 90) { // Warning if score below 90
      this.sendAlert('SYSTEM_WARNING', `System health score: ${healthScore}`, {
        ...metrics,
        unhealthyServices: unhealthyServices.length
      });
    }
  }

  calculateHealthScore(metrics, unhealthyServices) {
    let score = 100;

    // Deduct points for resource usage
    score -= (metrics.cpuUsage / 100) * 20; // Up to 20 points for CPU
    score -= (metrics.memoryUsage / 100) * 20; // Up to 20 points for memory
    score -= (metrics.diskUsage / 100) * 15; // Up to 15 points for disk
    score -= (metrics.networkLatency / 1000) * 10; // Up to 10 points for network

    // Deduct points for unhealthy services
    const servicePenalty = (unhealthyServices.length / this.monitoredServices.size) * 35;
    score -= servicePenalty;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async checkHeartbeats() {
    const now = new Date();

    for (const [serviceId, service] of this.monitoredServices) {
      const lastHeartbeat = new Date(this.heartbeats.get(serviceId) || service.lastHeartbeat);
      const timeSinceHeartbeat = now - lastHeartbeat;

      // If heartbeat is too old, consider service as failed
      if (timeSinceHeartbeat > service.config.heartbeatInterval * 2) {
        service.status = 'no_heartbeat';
        service.consecutiveFailures++;

        this.emit('service_failure', serviceId, new Error('No heartbeat received'));

        if (this.autoHealingEnabled && service.config.autoRestart) {
          await this.attemptAutoHealing(serviceId, service);
        }
      }
    }
  }

  async attemptAutoHealing(serviceId, service) {
    console.log(`Attempting auto-healing for service: ${serviceId}`);

    try {
      // This would call a restart function if available
      if (service.restartFn) {
        await service.restartFn();
        console.log(`Auto-healing successful for service: ${serviceId}`);
        service.consecutiveFailures = 0;
      } else {
        console.log(`No restart function available for service: ${serviceId}`);
      }
    } catch (error) {
      console.error(`Auto-healing failed for service ${serviceId}:`, error);

      // Escalate to manual intervention
      this.sendAlert('AUTO_HEALING_FAILED', `Auto-healing failed for service: ${serviceId}`, {
        serviceId,
        error: error.message
      });
    }
  }

  async getSystemMetrics() {
    const cpus = os.cpus();
    const totalCpu = cpus.length;
    let totalUsed = 0;

    cpus.forEach(cpu => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const used = total - cpu.times.idle;
      totalUsed += (used / total) * 100;
    });

    const cpuUsage = totalUsed / totalCpu;

    const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem() * 100;

    // Disk usage (simplified - would need more sophisticated checking in production)
    const diskUsage = 50; // Placeholder - would check actual disk usage

    // Network latency (placeholder - would check actual network responsiveness)
    const networkLatency = 50; // Placeholder

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      diskUsage: Math.round(diskUsage * 100) / 100,
      networkLatency: networkLatency,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  collectSystemMetrics() {
    const metrics = this.getSystemMetrics();

    // Store in history (keep last 100 measurements)
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    this.emit('metrics_collected', metrics);
  }

  sendAlert(type, message, details) {
    const alertId = `${type}_${Date.now()}`;
    const now = new Date().toISOString();

    // Check cooldown to avoid spam
    const lastAlertTime = this.lastAlerts.get(type);
    if (lastAlertTime && (new Date() - new Date(lastAlertTime)) < this.alertCooldown) {
      return; // Skip if in cooldown period
    }

    const alert = {
      id: alertId,
      type,
      message,
      details,
      timestamp: now,
      severity: this.getAlertSeverity(type)
    };

    this.alerts.push(alert);
    this.lastAlerts.set(type, now);

    // Keep only recent alerts (last 1000)
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    this.emit('system_alert', alert);
  }

  getAlertSeverity(type) {
    const highSeverity = ['SERVICE_FAILURE', 'RESOURCE_EXHAUSTION', 'SYSTEM_UNHEALTHY'];
    const mediumSeverity = ['HIGH_CPU_USAGE', 'HIGH_MEMORY_USAGE', 'AUTO_HEALING_FAILED'];

    if (highSeverity.includes(type.toUpperCase())) return 'high';
    if (mediumSeverity.includes(type.toUpperCase())) return 'medium';
    return 'low';
  }

  async handleSystemAlert(alert) {
    // Handle system alerts - could send notifications, log, etc.
    console.error(`System Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // In a real implementation, this might:
    // - Send notifications to administrators
    // - Create tickets in issue tracking systems
    // - Trigger automated responses
  }

  async handleServiceFailure(serviceId, error) {
    console.error(`Service ${serviceId} failed:`, error.message);

    // Log the failure
    this.sendAlert('SERVICE_FAILURE', `Service ${serviceId} failed`, {
      serviceId,
      error: error.message,
      stack: error.stack
    });
  }

  async handleResourceExhaustion(resource, value) {
    console.warn(`Resource ${resource} exhausted: ${value}%`);

    // Take corrective action if possible
    await this.takeCorrectiveAction(resource, value);
  }

  async takeCorrectiveAction(resource, value) {
    switch (resource) {
      case 'memory':
        if (value > 90) {
          // Try to free up memory or scale resources
          this.sendAlert('MEMORY_SCALING_NEEDED', `Memory usage critical: ${value}%`, { resource, value });
        }
        break;
      case 'cpu':
        if (value > 95) {
          // Scale down non-critical tasks
          this.sendAlert('CPU_SCALING_NEEDED', `CPU usage critical: ${value}%`, { resource, value });
        }
        break;
      case 'disk':
        if (value > 95) {
          // Trigger cleanup or scaling
          this.sendAlert('DISK_CLEANUP_NEEDED', `Disk usage critical: ${value}%`, { resource, value });
        }
        break;
    }
  }

  getServiceHealth(serviceId) {
    const service = this.monitoredServices.get(serviceId);
    if (!service) {
      return null;
    }

    return {
      id: serviceId,
      status: service.status,
      lastHeartbeat: service.lastHeartbeat,
      consecutiveFailures: service.consecutiveFailures,
      config: service.config
    };
  }

  getSystemHealth() {
    const metrics = this.getSystemMetrics();
    const services = Array.from(this.monitoredServices.values()).map(service => ({
      id: service.id,
      status: service.status,
      lastHeartbeat: service.lastHeartbeat
    }));

    return {
      metrics,
      services,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      healthScore: this.calculateHealthScore(metrics, services.filter(s => s.status !== 'healthy')),
      timestamp: new Date().toISOString()
    };
  }

  getAlertHistory(limit = 50) {
    return this.alerts.slice(-limit).reverse(); // Most recent first
  }

  async restartService(serviceId) {
    const service = this.monitoredServices.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    if (service.restartFn) {
      try {
        await service.restartFn();
        service.consecutiveFailures = 0;
        service.status = 'healthy';
        console.log(`Service restarted: ${serviceId}`);
        return { success: true, serviceId };
      } catch (error) {
        console.error(`Failed to restart service ${serviceId}:`, error);
        throw error;
      }
    } else {
      throw new Error(`No restart function available for service: ${serviceId}`);
    }
  }

  async shutdown() {
    console.log('Shutting down System Watchdog...');

    // Clear intervals
    // In a real implementation, you would store interval IDs and clear them

    console.log('System Watchdog shutdown complete');
  }
}

module.exports = SystemWatchdog;
```

### Orchestrator Controller (`orchestrator_controller.js`)
```javascript
const TaskOrchestrator = require('./task_orchestrator');
const SystemWatchdog = require('./system_watchdog');

class OrchestratorController {
  constructor(config) {
    this.config = config;
    this.orchestrator = new TaskOrchestrator(config.orchestrator);
    this.watchdog = new SystemWatchdog(config.watchdog);
    this.services = new Map();
  }

  async initialize() {
    console.log('Initializing Orchestrator Controller...');

    // Initialize orchestrator
    await this.orchestrator.initialize();

    // Initialize watchdog
    await this.watchdog.initialize();

    // Register core services with watchdog
    await this.registerCoreServices();

    // Set up event handling
    this.setupEventHandling();
  }

  async registerCoreServices() {
    // Register orchestrator as a monitored service
    await this.watchdog.monitorService('task-orchestrator', async () => {
      return { healthy: true, message: 'Task orchestrator is running' };
    }, { autoRestart: true });

    // Register watchdog as a monitored service
    await this.watchdog.monitorService('system-watchdog', async () => {
      return { healthy: true, message: 'System watchdog is running' };
    }, { autoRestart: true });

    console.log('Core services registered with watchdog');
  }

  setupEventHandling() {
    // Handle orchestrator events
    this.orchestrator.on('task_completed', (taskId, result) => {
      this.watchdog.emit('task_completed', { taskId, result });
    });

    this.orchestrator.on('task_failed', (taskId, error) => {
      this.watchdog.sendAlert('TASK_FAILED', `Task ${taskId} failed`, {
        taskId,
        error: error.message
      });
    });

    // Handle watchdog events
    this.watchdog.on('system_alert', (alert) => {
      console.error(`System Alert: ${alert.type} - ${alert.message}`);
      // Could trigger notifications, escalate issues, etc.
    });

    this.watchdog.on('service_failure', (serviceId, error) => {
      console.error(`Service Failure: ${serviceId} - ${error.message}`);
      // Could trigger auto-recovery, notifications, etc.
    });
  }

  // Task management
  async registerTask(taskId, taskFunction, config = {}) {
    return await this.orchestrator.registerTask(taskId, taskFunction, config);
  }

  async executeTask(taskId, params = {}) {
    return await this.orchestrator.executeTask(taskId, params);
  }

  async scheduleTask(taskId, cronExpression) {
    return await this.orchestrator.scheduleTask(taskId, cronExpression);
  }

  // Workflow management
  async registerWorkflow(workflowId, workflowDefinition) {
    return await this.orchestrator.registerWorkflow(workflowId, workflowDefinition);
  }

  async executeWorkflow(workflowId, context = {}) {
    return await this.orchestrator.executeWorkflow(workflowId, context);
  }

  // Service management
  async registerService(serviceId, serviceInstance, healthCheckFn, config = {}) {
    // Register with orchestrator
    await this.orchestrator.registerService(serviceId, serviceInstance);

    // Register with watchdog
    await this.watchdog.monitorService(serviceId, healthCheckFn, config);

    this.services.set(serviceId, {
      instance: serviceInstance,
      healthCheck: healthCheckFn,
      config
    });

    console.log(`Service registered: ${serviceId}`);
  }

  async getServiceStatus(serviceId) {
    // Get status from both orchestrator and watchdog
    const orchStatus = await this.orchestrator.getServiceStatus(serviceId);
    const wdStatus = this.watchdog.getServiceHealth(serviceId);

    return {
      orchestrator: orchStatus,
      watchdog: wdStatus,
      combined: {
        status: wdStatus?.status || orchStatus?.status || 'unknown',
        lastHeartbeat: wdStatus?.lastHeartbeat || orchStatus?.heartbeat,
        timestamp: new Date().toISOString()
      }
    };
  }

  // System monitoring
  getSystemMetrics() {
    const orchMetrics = this.orchestrator.getSystemMetrics();
    const wdMetrics = this.watchdog.getSystemHealth();

    return {
      orchestrator: orchMetrics,
      watchdog: wdMetrics,
      combined: {
        taskQueue: orchMetrics.taskQueueLength,
        runningTasks: orchMetrics.runningTasks,
        systemHealth: wdMetrics.healthScore,
        servicesHealthy: wdMetrics.services.filter(s => s.status === 'healthy').length,
        totalServices: wdMetrics.services.length,
        alertsPending: wdMetrics.alerts.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  getSystemHealth() {
    return this.watchdog.getSystemHealth();
  }

  getAlertHistory(limit = 50) {
    return this.watchdog.getAlertHistory(limit);
  }

  async restartService(serviceId) {
    return await this.watchdog.restartService(serviceId);
  }

  // Core system operations
  async startSystem() {
    console.log('Starting Gold Tier Autonomous Employee System...');

    try {
      // Initialize orchestrator and watchdog
      await this.initialize();

      // Register all core system tasks and workflows
      await this.registerCoreTasks();
      await this.registerCoreWorkflows();

      console.log('Gold Tier system started successfully');
      return { success: true, message: 'System started successfully' };
    } catch (error) {
      console.error('Failed to start system:', error);
      throw error;
    }
  }

  async registerCoreTasks() {
    // Register core system tasks
    await this.registerTask('health-check', async () => {
      return { healthy: true, timestamp: new Date().toISOString() };
    }, { schedule: '*/5 * * * * *' }); // Every 5 seconds

    await this.registerTask('metrics-collection', async () => {
      const metrics = this.getSystemMetrics();
      return { collected: true, metrics };
    }, { schedule: '*/30 * * * * *' }); // Every 30 seconds

    console.log('Core tasks registered');
  }

  async registerCoreWorkflows() {
    // Register core system workflows
    await this.registerWorkflow('daily-system-maintenance', {
      steps: [
        { taskId: 'health-check', params: {} },
        { taskId: 'metrics-collection', params: {} }
      ]
    });

    console.log('Core workflows registered');
  }

  async shutdown() {
    console.log('Shutting down Orchestrator Controller...');

    // Shutdown orchestrator
    await this.orchestrator.shutdown();

    // Shutdown watchdog
    await this.watchdog.shutdown();

    console.log('Orchestrator Controller shutdown complete');
  }

  // Auto-healing and recovery
  async performSystemRecovery() {
    console.log('Performing system recovery...');

    const health = this.getSystemHealth();

    if (health.healthScore < 70) {
      // Perform recovery actions based on issues detected
      const recoveryActions = [];

      // Restart unhealthy services
      for (const service of health.services) {
        if (service.status !== 'healthy') {
          try {
            await this.restartService(service.id);
            recoveryActions.push({ service: service.id, action: 'restarted', success: true });
          } catch (error) {
            recoveryActions.push({ service: service.id, action: 'restart_failed', error: error.message });
          }
        }
      }

      return { success: true, actions: recoveryActions, finalHealth: this.getSystemHealth() };
    }

    return { success: true, message: 'System is healthy, no recovery needed' };
  }
}

module.exports = OrchestratorController;
```

This completes the orchestrator and watchdog system that coordinates all autonomous employee functions and monitors system health.