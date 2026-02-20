/**
 * Communication MCP Server
 * Handles email, SMS, social media, and notifications
 * Port: 3001
 */

const BaseMCPServer = require('./base_mcp_server');
const nodemailer = require('nodemailer');

class CommunicationMCPServer extends BaseMCPServer {
  constructor() {
    super({
      serverId: 'communication-mcp',
      name: 'Communication MCP Server',
      port: parseInt(process.env.MCP_SERVER_PORT) || 3001,
      capabilities: ['email-send', 'email-receive', 'sms-send', 'social-post', 'notification-send']
    });

    // Setup email transporter
    this.setupEmailTransporter();

    // Setup communication routes
    this.setupCommunicationRoutes();
  }

  setupEmailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log('[communication-mcp] Email transporter configured');
    } else {
      console.warn('[communication-mcp] Email transporter not configured - missing environment variables');
    }
  }

  setupCommunicationRoutes() {
    // Email sending endpoint
    this.app.post('/email/send', async (req, res) => {
      try {
        const { to, subject, text, html, cc, bcc, attachments } = req.body;

        if (!to || !subject || (!text && !html)) {
          return res.status(400).json({ error: 'Missing required fields: to, subject, and text/html' });
        }

        if (!this.emailTransporter) {
          return res.status(503).json({ error: 'Email service not configured' });
        }

        const mailOptions = {
          from: process.env.SMTP_USER,
          to,
          subject,
          text,
          html,
          cc,
          bcc,
          attachments
        };

        const info = await this.emailTransporter.sendMail(mailOptions);

        await this.logAuditEvent('COMMUNICATION', 'EMAIL_SENT', {
          to,
          subject,
          messageId: info.messageId
        });

        res.json({
          success: true,
          messageId: info.messageId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[communication-mcp] Email send error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // SMS sending endpoint (placeholder - requires Twilio/similar)
    this.app.post('/sms/send', async (req, res) => {
      try {
        const { to, message } = req.body;

        if (!to || !message) {
          return res.status(400).json({ error: 'Missing required fields: to, message' });
        }

        // Placeholder implementation
        // In production, integrate with Twilio or similar service
        console.log(`[communication-mcp] SMS to ${to}: ${message}`);

        await this.logAuditEvent('COMMUNICATION', 'SMS_SENT', { to, message });

        res.json({
          success: true,
          messageId: `sms_${Date.now()}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[communication-mcp] SMS send error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Social media posting endpoint (LinkedIn)
    this.app.post('/social/post', async (req, res) => {
      try {
        const { platform, content, media } = req.body;

        if (!platform || !content) {
          return res.status(400).json({ error: 'Missing required fields: platform, content' });
        }

        // Placeholder implementation
        // In production, integrate with LinkedIn/Twitter APIs
        console.log(`[communication-mcp] Social post to ${platform}: ${content}`);

        await this.logAuditEvent('COMMUNICATION', 'SOCIAL_POST', { platform, content });

        res.json({
          success: true,
          postId: `post_${Date.now()}`,
          platform,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[communication-mcp] Social post error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Notification sending endpoint
    this.app.post('/notification/send', async (req, res) => {
      try {
        const { userId, title, message, type, priority } = req.body;

        if (!userId || !message) {
          return res.status(400).json({ error: 'Missing required fields: userId, message' });
        }

        // Store notification (in production, use database)
        console.log(`[communication-mcp] Notification to ${userId}: ${message}`);

        await this.logAuditEvent('COMMUNICATION', 'NOTIFICATION_SENT', {
          userId,
          title,
          type
        });

        res.json({
          success: true,
          notificationId: `notif_${Date.now()}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[communication-mcp] Notification error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  getEndpoints() {
    return [
      { method: 'POST', path: '/email/send', description: 'Send email' },
      { method: 'POST', path: '/sms/send', description: 'Send SMS' },
      { method: 'POST', path: '/social/post', description: 'Post to social media' },
      { method: 'POST', path: '/notification/send', description: 'Send notification' }
    ];
  }

  getPublicConfig() {
    return {
      ...super.getPublicConfig(),
      email: {
        configured: !!this.emailTransporter,
        host: process.env.SMTP_HOST || 'not configured'
      },
      sms: {
        configured: false,
        provider: 'not configured'
      },
      social: {
        linkedin: process.env.LINKEDIN_CLIENT_ID ? true : false
      }
    };
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new CommunicationMCPServer();
  server.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[communication-mcp] SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

module.exports = CommunicationMCPServer;
