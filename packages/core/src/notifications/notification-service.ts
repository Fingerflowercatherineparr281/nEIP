/**
 * NotificationService — Send notifications via email (nodemailer) and LINE (LINE Notify API).
 *
 * Features:
 * - Template system with Thai language support
 * - Configurable per-user preferences (channel + event type opt-in/opt-out)
 * - Email delivery via SMTP (nodemailer)
 * - LINE delivery via LINE Notify HTTP API
 *
 * Story 14.1 — Notification System
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel = 'email' | 'line';

export type NotificationEventType =
  | 'hitl_created'
  | 'approval_result'
  | 'system_alert';

export interface NotificationTemplate {
  readonly subject: string;
  readonly subjectTh: string;
  readonly body: string;
  readonly bodyTh: string;
}

export interface UserPreferences {
  readonly emailEnabled: boolean;
  readonly lineEnabled: boolean;
  readonly lineNotifyToken: string | null;
  readonly eventHitlCreated: boolean;
  readonly eventApprovalResult: boolean;
  readonly eventSystemAlert: boolean;
}

export interface SendNotificationInput {
  readonly channel: NotificationChannel;
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly templateId: string;
  readonly templateData: Record<string, string | number | boolean>;
  readonly lineNotifyToken?: string | undefined;
  readonly language?: 'en' | 'th' | undefined;
}

export interface SendResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, NotificationTemplate> = {
  'hitl.created': {
    subject: 'New item requires your review — {{documentRef}}',
    subjectTh: 'มีรายการใหม่รอการตรวจสอบ — {{documentRef}}',
    body: [
      'Hello {{recipientName}},',
      '',
      'A new {{documentType}} item ({{documentRef}}) has been created and requires your review.',
      '',
      'Amount: ฿{{amount}}',
      'Confidence: {{confidence}}%',
      '',
      'Please log in to review and approve or reject this item.',
      '',
      'Regards,',
      'nEIP System',
    ].join('\n'),
    bodyTh: [
      'สวัสดีคุณ{{recipientName}}',
      '',
      'มีรายการ {{documentType}} ใหม่ ({{documentRef}}) ที่ต้องการการตรวจสอบของคุณ',
      '',
      'จำนวน: ฿{{amount}}',
      'ความมั่นใจ: {{confidence}}%',
      '',
      'กรุณาเข้าสู่ระบบเพื่อตรวจสอบและอนุมัติหรือปฏิเสธรายการนี้',
      '',
      'ด้วยความนับถือ',
      'ระบบ nEIP',
    ].join('\n'),
  },
  'approval.result': {
    subject: 'Approval {{status}} — {{documentRef}}',
    subjectTh: 'ผลการอนุมัติ {{status}} — {{documentRef}}',
    body: [
      'Hello {{recipientName}},',
      '',
      'Your {{documentType}} item ({{documentRef}}) has been {{status}}.',
      '',
      '{{reason}}',
      '',
      'Reviewed by: {{reviewerName}}',
      '',
      'Regards,',
      'nEIP System',
    ].join('\n'),
    bodyTh: [
      'สวัสดีคุณ{{recipientName}}',
      '',
      'รายการ {{documentType}} ({{documentRef}}) ของคุณได้รับการ{{status}}แล้ว',
      '',
      '{{reason}}',
      '',
      'ตรวจสอบโดย: {{reviewerName}}',
      '',
      'ด้วยความนับถือ',
      'ระบบ nEIP',
    ].join('\n'),
  },
  'system.alert': {
    subject: 'System Alert — {{alertTitle}}',
    subjectTh: 'แจ้งเตือนระบบ — {{alertTitle}}',
    body: [
      'Hello {{recipientName}},',
      '',
      '{{alertMessage}}',
      '',
      'Severity: {{severity}}',
      '',
      'Regards,',
      'nEIP System',
    ].join('\n'),
    bodyTh: [
      'สวัสดีคุณ{{recipientName}}',
      '',
      '{{alertMessage}}',
      '',
      'ระดับความสำคัญ: {{severity}}',
      '',
      'ด้วยความนับถือ',
      'ระบบ nEIP',
    ].join('\n'),
  },
};

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Preference check
// ---------------------------------------------------------------------------

export function shouldSendNotification(
  preferences: UserPreferences,
  channel: NotificationChannel,
  eventType: NotificationEventType,
): boolean {
  // Check channel enabled
  if (channel === 'email' && !preferences.emailEnabled) return false;
  if (channel === 'line' && !preferences.lineEnabled) return false;
  if (channel === 'line' && !preferences.lineNotifyToken) return false;

  // Check event type enabled
  switch (eventType) {
    case 'hitl_created':
      return preferences.eventHitlCreated;
    case 'approval_result':
      return preferences.eventApprovalResult;
    case 'system_alert':
      return preferences.eventSystemAlert;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// NotificationService class
// ---------------------------------------------------------------------------

export class NotificationService {
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor(smtpConfig?: SmtpConfig) {
    this.fromAddress = smtpConfig?.from ?? 'noreply@neip.app';

    if (smtpConfig) {
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      });
    }
  }

  /**
   * Send a notification via the specified channel.
   */
  async send(input: SendNotificationInput): Promise<SendResult> {
    const template = TEMPLATES[input.templateId];
    if (!template) {
      return { success: false, error: `Unknown template: ${input.templateId}` };
    }

    const lang = input.language ?? 'th';
    const subject = renderTemplate(
      lang === 'th' ? template.subjectTh : template.subject,
      { ...input.templateData, recipientName: input.recipientName },
    );
    const body = renderTemplate(
      lang === 'th' ? template.bodyTh : template.body,
      { ...input.templateData, recipientName: input.recipientName },
    );

    if (input.channel === 'email') {
      return this.sendEmail(input.recipientEmail, subject, body);
    }

    if (input.channel === 'line') {
      if (!input.lineNotifyToken) {
        return { success: false, error: 'LINE Notify token not provided' };
      }
      return this.sendLine(input.lineNotifyToken, `${subject}\n\n${body}`);
    }

    return { success: false, error: `Unknown channel: ${String(input.channel)}` };
  }

  /**
   * Send email via nodemailer SMTP.
   */
  private async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<SendResult> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP transport not configured' };
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text: body,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Email send failed: ${message}` };
    }
  }

  /**
   * Send LINE notification via LINE Notify API.
   */
  private async sendLine(
    accessToken: string,
    message: string,
  ): Promise<SendResult> {
    try {
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ message }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `LINE Notify failed (${String(response.status)}): ${errorBody}`,
        };
      }

      return { success: true };
    } catch (err) {
      const message2 = err instanceof Error ? err.message : String(err);
      return { success: false, error: `LINE Notify failed: ${message2}` };
    }
  }

  /**
   * Get the list of available templates.
   */
  getTemplateIds(): string[] {
    return Object.keys(TEMPLATES);
  }
}
