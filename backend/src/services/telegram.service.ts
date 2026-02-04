/**
 * Telegram Notification Service
 * Sends security alerts and notifications via Telegram Bot
 */

import axios from "axios";
import log from '../services/logger.service';

// Configuration from environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_notification?: boolean;
}

interface AlertData {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

class TelegramService {
  private baseUrl: string;
  private retryAttempts = 2;
  private retryDelay = 1000;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }

  /**
   * Check if Telegram service is configured
   */
  isEnabled(): boolean {
    return !!TELEGRAM_ENABLED;
  }

  /**
   * Send a plain text message
   */
  async sendMessage(text: string, disableNotification = false): Promise<boolean> {
    if (!this.isEnabled()) {
      log.warn("[Telegram] Service not configured, skipping message");
      return false;
    }

    const payload: TelegramMessage = {
      chat_id: TELEGRAM_CHAT_ID!,
      text,
      parse_mode: "HTML",
      disable_notification: disableNotification,
    };

    return this.sendRequest(payload);
  }

  /**
   * Send a security alert with formatted message
   */
  async sendSecurityAlert(alert: AlertData): Promise<boolean> {
    if (!this.isEnabled()) {
      log.warn("[Telegram] Service not configured, skipping security alert");
      return false;
    }

    const severityEmoji = this.getSeverityEmoji(alert.severity);
    const timestamp = alert.timestamp || new Date().toISOString();
    
    let message = `${severityEmoji} <b>${this.escapeHtml(alert.title)}</b>\n\n`;
    message += `<b>Severity:</b> ${alert.severity.toUpperCase()}\n`;
    message += `<b>Time:</b> ${timestamp}\n\n`;
    message += `${this.escapeHtml(alert.message)}`;

    if (alert.details && Object.keys(alert.details).length > 0) {
      message += `\n\n<b>Details:</b>\n`;
      for (const [key, value] of Object.entries(alert.details)) {
        const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        message += `- <b>${this.escapeHtml(key)}:</b> ${this.escapeHtml(displayValue)}\n`;
      }
    }

    const payload: TelegramMessage = {
      chat_id: TELEGRAM_CHAT_ID!,
      text: message,
      parse_mode: "HTML",
      disable_notification: alert.severity === "low",
    };

    return this.sendRequest(payload);
  }

  /**
   * Send a health check failure alert
   */
  async sendHealthAlert(service: string, status: string, errorMessage?: string): Promise<boolean> {
    return this.sendSecurityAlert({
      title: "Health Check Failed",
      severity: "high",
      message: `Service "${service}" is reporting status: ${status}`,
      details: errorMessage ? { error: errorMessage } : undefined,
    });
  }

  /**
   * Send a backup notification
   */
  async sendBackupNotification(projectName: string, success: boolean, details?: string): Promise<boolean> {
    const emoji = success ? "\u2705" : "\u274C";
    const status = success ? "completed successfully" : "failed";
    
    return this.sendSecurityAlert({
      title: `${emoji} Backup ${success ? "Completed" : "Failed"}`,
      severity: success ? "low" : "high",
      message: `Backup for project "${projectName}" ${status}.`,
      details: details ? { info: details } : undefined,
    });
  }

  /**
   * Send deployment notification
   */
  async sendDeploymentNotification(projectName: string, success: boolean, version?: string): Promise<boolean> {
    const emoji = success ? "\u{1F680}" : "\u274C";
    const status = success ? "deployed successfully" : "deployment failed";
    
    return this.sendSecurityAlert({
      title: `${emoji} Deployment ${success ? "Success" : "Failed"}`,
      severity: success ? "low" : "high",
      message: `Project "${projectName}" ${status}.`,
      details: version ? { version } : undefined,
    });
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case "critical":
        return "\u{1F6A8}"; // Rotating light
      case "high":
        return "\u26A0\uFE0F"; // Warning
      case "medium":
        return "\u{1F536}"; // Orange diamond
      case "low":
      default:
        return "\u2139\uFE0F"; // Info
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private async sendRequest(payload: TelegramMessage): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(`${this.baseUrl}/sendMessage`, payload, {
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
        });

        if (response.data?.ok) {
          log.info("[Telegram] Message sent successfully");
          return true;
        }

        log.warn("[Telegram] API returned ok=false:", response.data);
        return false;

      } catch (error) {
        lastError = error as Error;
        log.warn(`[Telegram] Send attempt ${attempt} failed:`, (error as Error).message);
        
        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    log.error("[Telegram] All send attempts failed:", lastError?.message);
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test the Telegram connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isEnabled()) {
      return {
        success: false,
        message: "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.",
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getMe`, { timeout: 5000 });
      if (response.data?.ok) {
        const botName = response.data.result?.username || "unknown";
        return {
          success: true,
          message: `Connected to Telegram bot: @${botName}`,
        };
      }
      return {
        success: false,
        message: "Telegram API returned ok=false",
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      };
    }
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
