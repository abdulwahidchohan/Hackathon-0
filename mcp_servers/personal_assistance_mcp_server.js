/**
 * Personal Assistance MCP Server
 * Handles calendar, tasks, reminders, health tracking
 * Port: 3003
 */

const BaseMCPServer = require('./base_mcp_server');

class PersonalAssistanceMCPServer extends BaseMCPServer {
  constructor() {
    super({
      serverId: 'personal-assistance-mcp',
      name: 'Personal Assistance MCP Server',
      port: parseInt(process.env.MCP_SERVER_PORT) || 3003,
      capabilities: ['calendar-manage', 'task-schedule', 'reminder-set', 'health-track']
    });

    this.setupPersonalRoutes();
  }

  setupPersonalRoutes() {
    // Calendar management
    this.app.post('/calendar/event', async (req, res) => {
      try {
        const { title, start, end, description, attendees } = req.body;

        const event = await this.createCalendarEvent({ title, start, end, description, attendees });

        await this.logAuditEvent('PERSONAL_ASSIST', 'CALENDAR_EVENT_CREATED', {
          title,
          start
        });

        res.json({
          success: true,
          event,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[personal-assistance-mcp] Calendar error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Task scheduling
    this.app.post('/task/schedule', async (req, res) => {
      try {
        const { title, dueDate, priority, description } = req.body;

        const task = await this.scheduleTask({ title, dueDate, priority, description });

        res.json({
          success: true,
          task,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[personal-assistance-mcp] Task scheduling error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Reminder setting
    this.app.post('/reminder/set', async (req, res) => {
      try {
        const { title, time, recurring } = req.body;

        const reminder = await this.setReminder({ title, time, recurring });

        res.json({
          success: true,
          reminder,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[personal-assistance-mcp] Reminder error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async createCalendarEvent(eventData) {
    // Placeholder - integrate with Google Calendar API
    return {
      id: `event_${Date.now()}`,
      ...eventData
    };
  }

  async scheduleTask(taskData) {
    return {
      id: `task_${Date.now()}`,
      ...taskData,
      status: 'scheduled'
    };
  }

  async setReminder(reminderData) {
    return {
      id: `reminder_${Date.now()}`,
      ...reminderData,
      active: true
    };
  }

  getEndpoints() {
    return [
      { method: 'POST', path: '/calendar/event', description: 'Create calendar event' },
      { method: 'POST', path: '/task/schedule', description: 'Schedule task' },
      { method: 'POST', path: '/reminder/set', description: 'Set reminder' }
    ];
  }
}

if (require.main === module) {
  const server = new PersonalAssistanceMCPServer();
  server.start().catch(console.error);

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

module.exports = PersonalAssistanceMCPServer;
