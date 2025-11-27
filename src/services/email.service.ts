import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

/**
 * Email Service Class
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter
   */
  private async initTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      console.log('[EmailService] Email transporter initialized successfully');
    } catch (error) {
      console.error('[EmailService] Failed to initialize email transporter:', error);
      throw new Error('Failed to initialize email service');
    }

    return this.transporter;
  }

  /**
   * Send OTP email
   */
  async sendOTPEmail(to: string, otp: string): Promise<void> {
    const transporter = await this.initTransporter();

    const mailOptions = {
      from: `"Plagiarism Checker Service" <${EMAIL_FROM}>`,
      to: to,
      subject: 'Your OTP Code - Plagiarism Checker',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .otp-code {
              background-color: #2c3e50;
              color: #fff;
              font-size: 32px;
              font-weight: bold;
              padding: 20px;
              text-align: center;
              border-radius: 5px;
              margin: 20px 0;
              letter-spacing: 5px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Your OTP Code</h2>
            <p>You have requested to login to Plagiarism Checker Service.</p>
            <p>Your one-time password (OTP) is:</p>

            <div class="otp-code">${otp}</div>

            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This code will expire in <strong>10 minutes</strong></li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>

            <p>For security reasons, this code can only be used once.</p>

            <div class="footer">
              <p>This is an automated email from Plagiarism Checker Service</p>
              <p>Please do not reply to this email</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your OTP Code - Plagiarism Checker Service

Your one-time password (OTP) is: ${otp}

This code will expire in 10 minutes.
Do not share this code with anyone.

If you didn't request this code, please ignore this email.

---
This is an automated email from Plagiarism Checker Service.
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[EmailService] OTP email sent to ${to}`);
    } catch (error) {
      console.error('[EmailService] Failed to send OTP email:', error);
      throw new Error('Failed to send OTP email');
    }
  }

  /**
   * Send welcome email (optional)
   */
  async sendWelcomeEmail(to: string, name?: string): Promise<void> {
    const transporter = await this.initTransporter();

    const mailOptions = {
      from: `"Plagiarism Checker Service" <${EMAIL_FROM}>`,
      to: to,
      subject: 'Welcome to Plagiarism Checker Service',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome to Plagiarism Checker Service!</h2>
            <p>Hello ${name || 'User'},</p>
            <p>Your account has been created successfully.</p>
            <p>You can now login using your email and password.</p>
            <p>For security, we recommend setting up 2-Factor Authentication (2FA) on your first login.</p>
            <br>
            <p>Best regards,<br>Plagiarism Checker Team</p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Welcome email sent to ${to}`);
    } catch (error) {
      console.error('[EmailService] Failed to send welcome email:', error);
      // Don't throw error for welcome emails
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
