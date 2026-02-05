import { EmailAccount } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import axios, { AxiosInstance } from 'axios';
import { config } from '../../config/env';
import { AppError } from '../../utils/errors';
import { PasswordValidator } from '../../utils/password-validator';
import log from '../../services/logger.service';



interface CreateEmailData {
  email: string;
  password: string;
  quota?: number; // In MB
  clientName?: string;
  notes?: string;
}

interface UpdateEmailData {
  quota?: number;
  forwardTo?: string;
  autoReply?: boolean;
  autoReplyMsg?: string;
  isActive?: boolean;
  clientName?: string;
  notes?: string;
}

class EmailService {
  private hostingerClient: AxiosInstance | null = null;

  constructor() {
    // Initialize Hostinger API client if credentials are provided
    if (config.HOSTINGER_API_KEY && config.HOSTINGER_API_URL) {
      this.hostingerClient = axios.create({
        baseURL: config.HOSTINGER_API_URL,
        headers: {
          'Authorization': `Bearer ${config.HOSTINGER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
  }

  /**
   * Check if Hostinger API is configured
   */
  private isHostingerConfigured(): boolean {
    return this.hostingerClient !== null;
  }

  /**
   * Create email account
   */
  async createEmailAccount(data: CreateEmailData): Promise<EmailAccount> {
    try {
      let hostingerId: string | undefined;
      let usedSpace = 0;

      // Create email via Hostinger API if configured
      if (this.isHostingerConfigured()) {
        try {
          const response = await this.hostingerClient!.post('/email/accounts', {
            email: data.email,
            password: data.password,
            quota: data.quota || 1024, // Default 1GB
          });

          hostingerId = response.data.id;
          usedSpace = response.data.used_space || 0;
        } catch (error) {
          throw new AppError(500, `Hostinger API error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Save to database
      const emailAccount = await prisma.emailAccount.create({
        data: {
          email: data.email,
          hostingerId,
          quota: data.quota || 1024,
          usedSpace,
          clientName: data.clientName,
          notes: data.notes,
        },
      });

      return emailAccount;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all email accounts
   */
  async getAllEmailAccounts(): Promise<EmailAccount[]> {
    try {
      const accounts = await prisma.emailAccount.findMany({
        orderBy: { createdAt: 'desc' },
      });

      // Update usage stats from Hostinger if configured
      if (this.isHostingerConfigured()) {
        await this.syncUsageStats(accounts);
      }

      return accounts;
    } catch (error) {
      throw new AppError(500, `Failed to fetch email accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get email account by ID
   */
  async getEmailAccountById(id: string): Promise<EmailAccount> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id },
      });

      if (!account) {
        throw new AppError(404, 'Email account not found');
      }

      // Update usage stats from Hostinger if configured
      if (this.isHostingerConfigured() && account.hostingerId) {
        await this.updateUsageStats(account);
      }

      return account;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to fetch email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get email account by email address
   */
  async getEmailAccountByEmail(email: string): Promise<EmailAccount | null> {
    try {
      return await prisma.emailAccount.findUnique({
        where: { email },
      });
    } catch (error) {
      throw new AppError(500, `Failed to fetch email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update email account
   */
  async updateEmailAccount(
    id: string,
    data: UpdateEmailData
  ): Promise<EmailAccount> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id },
      });

      if (!account) {
        throw new AppError(404, 'Email account not found');
      }

      // Update via Hostinger API if configured and has hostingerId
      if (this.isHostingerConfigured() && account.hostingerId) {
        try {
          const hostingerData: Record<string, unknown> = {};
          if (data.quota !== undefined) hostingerData.quota = data.quota;
          if (data.isActive !== undefined) hostingerData.is_active = data.isActive;

          if (Object.keys(hostingerData).length > 0) {
            await this.hostingerClient!.patch(
              `/email/accounts/${account.hostingerId}`,
              hostingerData
            );
          }
        } catch (error) {
          throw new AppError(500, `Hostinger API error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Update database
      const updated = await prisma.emailAccount.update({
        where: { id },
        data: {
          quota: data.quota,
          forwardTo: data.forwardTo,
          autoReply: data.autoReply,
          autoReplyMsg: data.autoReplyMsg,
          isActive: data.isActive,
          clientName: data.clientName,
          notes: data.notes,
        },
      });

      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete email account
   */
  async deleteEmailAccount(id: string): Promise<void> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id },
      });

      if (!account) {
        throw new AppError(404, 'Email account not found');
      }

      // Delete from Hostinger if configured and has hostingerId
      if (this.isHostingerConfigured() && account.hostingerId) {
        try {
          await this.hostingerClient!.delete(
            `/email/accounts/${account.hostingerId}`
          );
        } catch (error) {
          // Log error but continue with database deletion
          log.error('Failed to delete from Hostinger:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Delete from database
      await prisma.emailAccount.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change email password
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id },
      });

      if (!account) {
        throw new AppError(404, 'Email account not found');
      }

      if (!this.isHostingerConfigured() || !account.hostingerId) {
        throw new AppError(400, 'Hostinger API not configured or account not synced');
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(400, `Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Update password via Hostinger API
      await this.hostingerClient!.patch(
        `/email/accounts/${account.hostingerId}/password`,
        { password: newPassword }
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to change password: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sync email accounts from Hostinger
   * Note: Hostinger public API does not support email management.
   * This function is kept for future compatibility but currently returns
   * an informative message that sync is not available.
   */
  async syncFromHostinger(): Promise<{ synced: number; message: string }> {
    // Hostinger public API (developers.hostinger.com) does not support email endpoints.
    // Email accounts must be managed manually via hPanel or stored locally in the database.
    // Return success with informative message instead of throwing an error.
    return {
      synced: 0,
      message: 'La sincronizzazione con Hostinger non è disponibile. L\'API pubblica di Hostinger non supporta la gestione delle email. Gli account email possono essere gestiti manualmente nel database locale.'
    };
  }

  /**
   * Update usage stats for a single account from Hostinger
   */
  private async updateUsageStats(account: EmailAccount): Promise<void> {
    try {
      if (!account.hostingerId) return;

      const response = await this.hostingerClient!.get(
        `/email/accounts/${account.hostingerId}`
      );

      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          usedSpace: response.data.used_space,
        },
      });
    } catch (error) {
      log.error('Failed to update usage stats:', error);
    }
  }

  /**
   * Sync usage stats for multiple accounts
   */
  private async syncUsageStats(accounts: EmailAccount[]): Promise<void> {
    const promises = accounts
      .filter((a) => a.hostingerId)
      .map((account) => this.updateUsageStats(account));

    await Promise.allSettled(promises);
  }

  /**
   * Get email statistics
   */
  async getEmailStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalQuota: number;
    totalUsed: number;
  }> {
    try {
      const accounts = await prisma.emailAccount.findMany();

      const stats = {
        total: accounts.length,
        active: accounts.filter((a) => a.isActive).length,
        inactive: accounts.filter((a) => !a.isActive).length,
        totalQuota: accounts.reduce((sum, a) => sum + a.quota, 0),
        totalUsed: accounts.reduce((sum, a) => sum + (a.usedSpace || 0), 0),
      };

      return stats;
    } catch (error) {
      throw new AppError(500, `Failed to fetch email stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const emailService = new EmailService();
