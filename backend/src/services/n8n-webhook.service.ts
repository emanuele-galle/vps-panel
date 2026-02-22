/**
 * N8N Webhook Service
 * Triggers N8N workflows via webhooks for automation
 */

import axios, { AxiosError } from "axios";
import log from '../services/logger.service';

// Configuration from environment
const N8N_WEBHOOK_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL || `https://n8n.${process.env.PANEL_DOMAIN || 'localhost'}/webhook`;
const N8N_WEBHOOK_TIMEOUT = parseInt(process.env.N8N_WEBHOOK_TIMEOUT || "10000", 10);

// Webhook endpoints for different events
const WEBHOOK_ENDPOINTS = {
  "new-lead": "/new-lead",
  "lead-updated": "/lead-updated",
  "security-alert": "/security-alert",
  "backup-completed": "/backup-completed",
  "project-created": "/project-created",
  "deployment-completed": "/deployment-completed",
  "health-check-failed": "/health-check-failed",
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_ENDPOINTS;

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookResponse {
  success: boolean;
  message?: string;
  executionId?: string;
  error?: string;
}

class N8NWebhookService {
  private retryAttempts = 3;
  private retryDelay = 1000; // ms

  /**
   * Trigger an N8N webhook
   */
  async trigger(event: WebhookEvent, data: Record<string, unknown>): Promise<WebhookResponse> {
    const endpoint = WEBHOOK_ENDPOINTS[event];
    if (!endpoint) {
      log.error(`[N8NWebhook] Unknown event type: ${event}`);
      return {
        success: false,
        error: `Unknown event type: ${event}`,
      };
    }

    const url = `${N8N_WEBHOOK_BASE_URL}${endpoint}`;
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        log.info(`[N8NWebhook] Triggering ${event} webhook (attempt ${attempt}/${this.retryAttempts})`);

        const response = await axios.post(url, payload, {
          timeout: N8N_WEBHOOK_TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Source": "vps-panel",
            "X-Webhook-Event": event,
          },
        });

        log.info(`[N8NWebhook] Webhook ${event} triggered successfully`, {
          status: response.status,
          executionId: response.data?.executionId,
        });

        return {
          success: true,
          message: `Webhook triggered successfully`,
          executionId: response.data?.executionId,
        };

      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;

          // Do not retry on 4xx errors (client errors)
          if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
            log.error(`[N8NWebhook] Client error triggering ${event}:`, {
              status: axiosError.response.status,
              message: axiosError.message,
            });
            return {
              success: false,
              error: `Client error: ${axiosError.response.status} - ${axiosError.message}`,
            };
          }

          log.warn(`[N8NWebhook] Failed to trigger ${event} (attempt ${attempt}):`, axiosError.message);
        } else {
          log.warn(`[N8NWebhook] Failed to trigger ${event} (attempt ${attempt}):`, (error as Error).message);
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    log.error(`[N8NWebhook] All attempts failed for ${event}:`, lastError?.message);

    return {
      success: false,
      error: lastError?.message || "Unknown error",
    };
  }

  /**
   * Trigger new lead webhook
   */
  async triggerNewLead(leadData: {
    leadId: string;
    name: string;
    email: string;
    company?: string;
    phone?: string;
    interest: string;
    budgetRange?: string;
    source: string;
    conversationId?: string;
  }): Promise<WebhookResponse> {
    return this.trigger("new-lead", leadData);
  }

  /**
   * Trigger security alert webhook
   */
  async triggerSecurityAlert(alertData: {
    alertType: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    ipAddress?: string;
    userId?: string;
    details?: Record<string, unknown>;
  }): Promise<WebhookResponse> {
    return this.trigger("security-alert", alertData);
  }

  /**
   * Trigger health check failed webhook
   */
  async triggerHealthCheckFailed(healthData: {
    service: string;
    status: string;
    latency?: number;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }): Promise<WebhookResponse> {
    return this.trigger("health-check-failed", healthData);
  }

  /**
   * Check if N8N webhook service is reachable
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Try to reach the base URL with a HEAD request
      await axios.head(N8N_WEBHOOK_BASE_URL, {
        timeout: 5000,
      });
      return { healthy: true, message: "N8N webhook service is reachable" };
    } catch (error) {
      return {
        healthy: false,
        message: `N8N webhook service is not reachable: ${(error as Error).message}`,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const n8nWebhookService = new N8NWebhookService();
