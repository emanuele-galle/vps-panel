/**
 * Security Audit Service
 *
 * Provides specialized logging for security-related events such as:
 * - Authentication attempts (success/failure)
 * - Authorization failures (access denied)
 * - Path traversal attempts
 * - Input validation failures
 * - Rate limiting events
 * - Suspicious activity patterns
 */

import { prisma } from './prisma.service';
import { LogStatus } from '@prisma/client';
import { telegramService } from './telegram.service';
import { n8nWebhookService } from './n8n-webhook.service';
import log from '../services/logger.service';

// Security event types
export enum SecurityEventType {
  // Authentication
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE = 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESH = 'AUTH_TOKEN_REFRESH',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_2FA_SUCCESS = 'AUTH_2FA_SUCCESS',
  AUTH_2FA_FAILURE = 'AUTH_2FA_FAILURE',
  AUTH_PASSWORD_CHANGE = 'AUTH_PASSWORD_CHANGE',
  AUTH_PASSWORD_RESET_REQUEST = 'AUTH_PASSWORD_RESET_REQUEST',

  // Authorization
  AUTHZ_ACCESS_DENIED = 'AUTHZ_ACCESS_DENIED',
  AUTHZ_ROLE_INSUFFICIENT = 'AUTHZ_ROLE_INSUFFICIENT',
  AUTHZ_RESOURCE_NOT_OWNED = 'AUTHZ_RESOURCE_NOT_OWNED',

  // Input validation
  VALIDATION_FAILURE = 'VALIDATION_FAILURE',
  PATH_TRAVERSAL_ATTEMPT = 'PATH_TRAVERSAL_ATTEMPT',
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',

  // File operations
  FILE_ACCESS_UNAUTHORIZED = 'FILE_ACCESS_UNAUTHORIZED',
  FILE_UPLOAD_BLOCKED = 'FILE_UPLOAD_BLOCKED',
  BACKUP_DOWNLOAD_ATTEMPT = 'BACKUP_DOWNLOAD_ATTEMPT',

  // Account actions
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  ACCOUNT_ROLE_CHANGED = 'ACCOUNT_ROLE_CHANGED',

  // System
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  DANGEROUS_COMMAND_EXECUTED = 'DANGEROUS_COMMAND_EXECUTED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

// Severity levels
export enum SecuritySeverity {
  LOW = 'LOW',       // Informational events
  MEDIUM = 'MEDIUM', // Potential issues
  HIGH = 'HIGH',     // Security violations
  CRITICAL = 'CRITICAL', // Active attacks or breaches
}

interface SecurityEventData {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  targetUserId?: string; // For admin actions on other users
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  blocked?: boolean; // Was the action blocked?
}

interface SecurityAlertThreshold {
  eventType: SecurityEventType;
  count: number;
  windowMinutes: number;
}

// Default alert thresholds
const ALERT_THRESHOLDS: SecurityAlertThreshold[] = [
  { eventType: SecurityEventType.AUTH_LOGIN_FAILURE, count: 5, windowMinutes: 15 },
  { eventType: SecurityEventType.AUTH_2FA_FAILURE, count: 3, windowMinutes: 10 },
  { eventType: SecurityEventType.PATH_TRAVERSAL_ATTEMPT, count: 3, windowMinutes: 5 },
  { eventType: SecurityEventType.INJECTION_ATTEMPT, count: 2, windowMinutes: 5 },
  { eventType: SecurityEventType.RATE_LIMIT_EXCEEDED, count: 10, windowMinutes: 5 },
  { eventType: SecurityEventType.AUTHZ_ACCESS_DENIED, count: 10, windowMinutes: 5 },
];

class SecurityAuditService {
  private failedLoginAttempts: Map<string, { count: number; firstAttempt: Date }> = new Map();

  /**
   * Log a security event
   */
  async logSecurityEvent(data: SecurityEventData): Promise<void> {
    try {
      // Determine log status based on severity
      let status: LogStatus = 'SUCCESS';
      if (data.severity === SecuritySeverity.HIGH || data.severity === SecuritySeverity.CRITICAL) {
        status = 'ERROR';
      } else if (data.severity === SecuritySeverity.MEDIUM) {
        status = 'WARNING';
      }

      // Create activity log entry with security metadata
      await prisma.activityLog.create({
        data: {
          userId: data.userId,
          action: `SECURITY_${data.eventType}`,
          resource: data.resourceType || 'security',
          resourceId: data.resourceId,
          description: data.description,
          metadata: {
            securityEvent: true,
            eventType: data.eventType,
            severity: data.severity,
            targetUserId: data.targetUserId,
            blocked: data.blocked,
            ...data.metadata,
          },
          status,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      // Log to console for immediate visibility
      const logLevel = data.severity === SecuritySeverity.CRITICAL ? 'error' :
                       data.severity === SecuritySeverity.HIGH ? 'warn' : 'info';
      console[logLevel](`[SECURITY] ${data.eventType}: ${data.description}`, {
        ip: data.ipAddress,
        userId: data.userId,
        blocked: data.blocked,
      });

      // Check if we need to trigger an alert
      await this.checkAlertThresholds(data);

    } catch (error) {
      log.error('[SECURITY] Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  }

  /**
   * Log a successful login
   */
  async logLoginSuccess(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Clear failed login tracking for this IP
    if (ipAddress) {
      this.failedLoginAttempts.delete(ipAddress);
    }

    await this.logSecurityEvent({
      eventType: SecurityEventType.AUTH_LOGIN_SUCCESS,
      severity: SecuritySeverity.LOW,
      userId,
      ipAddress,
      userAgent,
      description: 'User logged in successfully',
    });
  }

  /**
   * Log a failed login attempt
   */
  async logLoginFailure(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    reason: string = 'Invalid credentials'
  ): Promise<void> {
    // Track failed attempts for brute force detection
    if (ipAddress) {
      const existing = this.failedLoginAttempts.get(ipAddress);
      if (existing) {
        existing.count++;
      } else {
        this.failedLoginAttempts.set(ipAddress, { count: 1, firstAttempt: new Date() });
      }
    }

    await this.logSecurityEvent({
      eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
      severity: SecuritySeverity.MEDIUM,
      ipAddress,
      userAgent,
      description: `Login attempt failed for ${email}: ${reason}`,
      metadata: { email, reason },
    });
  }

  /**
   * Log a token refresh attempt
   */
  async logTokenRefresh(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    reason?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: success ? SecurityEventType.AUTH_TOKEN_REFRESH : SecurityEventType.AUTH_TOKEN_INVALID,
      severity: success ? SecuritySeverity.LOW : SecuritySeverity.MEDIUM,
      userId: success ? userId : undefined,
      ipAddress,
      userAgent,
      description: success
        ? 'Token refreshed successfully'
        : `Token refresh failed: ${reason || 'Unknown error'}`,
      metadata: { success, reason },
    });
  }

  /**
   * Log an access denied event
   */
  async logAccessDenied(
    userId: string | undefined,
    resource: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    reason: string = 'Insufficient permissions'
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.AUTHZ_ACCESS_DENIED,
      severity: SecuritySeverity.MEDIUM,
      userId,
      ipAddress,
      userAgent,
      resourceType: resource,
      description: `Access denied: ${action} on ${resource} - ${reason}`,
      metadata: { action, reason },
      blocked: true,
    });
  }

  /**
   * Log a path traversal attempt
   */
  async logPathTraversalAttempt(
    userId: string | undefined,
    attemptedPath: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'file',
      description: `Path traversal attempt blocked: ${attemptedPath}`,
      metadata: { attemptedPath },
      blocked: true,
    });
  }

  /**
   * Log an input validation failure
   */
  async logValidationFailure(
    userId: string | undefined,
    field: string,
    value: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Sanitize value to prevent log injection
    const sanitizedValue = value.length > 100 ? value.substring(0, 100) + '...' : value;

    await this.logSecurityEvent({
      eventType: SecurityEventType.VALIDATION_FAILURE,
      severity: SecuritySeverity.LOW,
      userId,
      ipAddress,
      userAgent,
      description: `Validation failed for field '${field}': ${reason}`,
      metadata: { field, valueSample: sanitizedValue, reason },
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    userId: string | undefined,
    endpoint: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.MEDIUM,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'api',
      resourceId: endpoint,
      description: `Rate limit exceeded for endpoint: ${endpoint}`,
      metadata: { endpoint },
      blocked: true,
    });
  }

  /**
   * Log backup download attempt
   */
  async logBackupDownload(
    userId: string,
    backupId: string,
    backupType: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.BACKUP_DOWNLOAD_ATTEMPT,
      severity: SecuritySeverity.LOW,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'backup',
      resourceId: backupId,
      description: `Backup download: ${backupType} backup (${backupId})`,
      metadata: { backupType },
    });
  }

  /**
   * Log account role change
   */
  async logRoleChange(
    adminUserId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.ACCOUNT_ROLE_CHANGED,
      severity: SecuritySeverity.HIGH,
      userId: adminUserId,
      targetUserId,
      ipAddress,
      userAgent,
      resourceType: 'user',
      resourceId: targetUserId,
      description: `Role changed from ${oldRole} to ${newRole}`,
      metadata: { oldRole, newRole },
    });
  }

  /**
   * Log system configuration change
   */
  async logConfigChange(
    userId: string,
    configKey: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.SYSTEM_CONFIG_CHANGED,
      severity: SecuritySeverity.MEDIUM,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'system_settings',
      resourceId: configKey,
      description: `System configuration changed: ${configKey}`,
      metadata: { configKey },
    });
  }

  /**
   * Check if alert thresholds have been exceeded
   */
  private async checkAlertThresholds(data: SecurityEventData): Promise<void> {
    const threshold = ALERT_THRESHOLDS.find(t => t.eventType === data.eventType);
    if (!threshold) return;

    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - threshold.windowMinutes);

    try {
      const recentCount = await prisma.activityLog.count({
        where: {
          action: `SECURITY_${data.eventType}`,
          createdAt: { gte: windowStart },
          ipAddress: data.ipAddress || undefined,
        },
      });

      if (recentCount >= threshold.count) {
        // Log alert
        log.error(`[SECURITY ALERT] ${data.eventType} threshold exceeded!`, {
          count: recentCount,
          threshold: threshold.count,
          windowMinutes: threshold.windowMinutes,
          ip: data.ipAddress,
        });

        // Create critical alert log
        await prisma.activityLog.create({
          data: {
            action: 'SECURITY_ALERT',
            resource: 'security',
            description: `Security alert: ${data.eventType} threshold exceeded (${recentCount}/${threshold.count} in ${threshold.windowMinutes}min)`,
            metadata: {
              alertType: data.eventType,
              count: recentCount,
              threshold: threshold.count,
              windowMinutes: threshold.windowMinutes,
              triggeringIp: data.ipAddress,
            },
            status: 'ERROR',
            ipAddress: data.ipAddress,
          },
        });

        // Send alerts via Telegram and N8N webhook
        await this.sendSecurityAlert(data, recentCount, threshold);
      }
    } catch (error) {
      log.error('[SECURITY] Failed to check alert thresholds:', error);
    }
  }

  /**
   * Get security events for dashboard
   */
  async getRecentSecurityEvents(
    hours: number = 24,
    limit: number = 100
  ): Promise<unknown[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return prisma.activityLog.findMany({
      where: {
        action: { startsWith: 'SECURITY_' },
        createdAt: { gte: since },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security event statistics
   */
  async getSecurityStats(hours: number = 24): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    blockedAttempts: number;
    topIps: { ip: string; count: number }[];
  }> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const events = await prisma.activityLog.findMany({
      where: {
        action: { startsWith: 'SECURITY_' },
        createdAt: { gte: since },
      },
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    let blockedAttempts = 0;

    for (const event of events) {
      // Count by type
      const eventType = event.action.replace('SECURITY_', '');
      byType[eventType] = (byType[eventType] || 0) + 1;

      // Count by severity
      const metadata = event.metadata as any;
      if (metadata?.severity) {
        bySeverity[metadata.severity] = (bySeverity[metadata.severity] || 0) + 1;
      }

      // Count blocked attempts
      if (metadata?.blocked) {
        blockedAttempts++;
      }

      // Count by IP
      if (event.ipAddress) {
        ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      }
    }

    // Get top IPs
    const topIps = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      totalEvents: events.length,
      byType,
      bySeverity,
      blockedAttempts,
      topIps,
    };
  }

  /**
   * Clean up old security logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await prisma.activityLog.deleteMany({
      where: {
        action: { startsWith: 'SECURITY_' },
        createdAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Send security alert via Telegram and N8N webhook
   */
  private async sendSecurityAlert(
    data: SecurityEventData,
    recentCount: number,
    threshold: SecurityAlertThreshold
  ): Promise<void> {
    const severity = this.getSeverityFromEventType(data.eventType);
    const alertMessage = `${data.eventType} threshold exceeded (${recentCount}/${threshold.count} in ${threshold.windowMinutes}min)`;

    // Send Telegram alert (fire-and-forget)
    telegramService.sendSecurityAlert({
      title: `Security Alert: ${data.eventType}`,
      severity: severity as "low" | "medium" | "high" | "critical",
      message: alertMessage,
      details: {
        eventType: data.eventType,
        count: recentCount,
        threshold: threshold.count,
        windowMinutes: threshold.windowMinutes,
        ipAddress: data.ipAddress || "unknown",
        description: data.description,
      },
    }).catch(err => {
      log.error("[SecurityAudit] Failed to send Telegram alert:", err.message);
    });

    // Send N8N webhook (fire-and-forget)
    n8nWebhookService.triggerSecurityAlert({
      alertType: data.eventType,
      severity: severity as "low" | "medium" | "high" | "critical",
      message: alertMessage,
      ipAddress: data.ipAddress,
      userId: data.userId,
      details: {
        eventType: data.eventType,
        count: recentCount,
        threshold: threshold.count,
        windowMinutes: threshold.windowMinutes,
        metadata: data.metadata,
      },
    }).catch(err => {
      log.error("[SecurityAudit] Failed to trigger N8N webhook:", err.message);
    });
  }

  /**
   * Map event type to severity for alerting
   */
  private getSeverityFromEventType(eventType: SecurityEventType): string {
    const criticalEvents = [
      SecurityEventType.INJECTION_ATTEMPT,
      SecurityEventType.BRUTE_FORCE_DETECTED,
      SecurityEventType.DANGEROUS_COMMAND_EXECUTED,
    ];
    const highEvents = [
      SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
      SecurityEventType.XSS_ATTEMPT,
      SecurityEventType.AUTH_2FA_FAILURE,
      SecurityEventType.FILE_ACCESS_UNAUTHORIZED,
    ];
    const mediumEvents = [
      SecurityEventType.AUTH_LOGIN_FAILURE,
      SecurityEventType.AUTHZ_ACCESS_DENIED,
      SecurityEventType.RATE_LIMIT_EXCEEDED,
    ];

    if (criticalEvents.includes(eventType)) return "critical";
    if (highEvents.includes(eventType)) return "high";
    if (mediumEvents.includes(eventType)) return "medium";
    return "low";
  }

}

export const securityAuditService = new SecurityAuditService();
