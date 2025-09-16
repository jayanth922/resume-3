import crypto from 'crypto';
import { prisma } from './database';

export interface ApplicationConfig {
  name: string;
  description?: string;
  ownerEmail: string;
  environment: 'development' | 'staging' | 'production';
}

export interface ApiKeyConfig {
  name: string;
  environment: string;
  permissions: string[];
  expiresInDays?: number;
}

export class ApplicationManager {
  /**
   * Create a new application registration
   */
  static async createApplication(config: ApplicationConfig) {
    const application = await prisma.application.create({
      data: config
    });

    // Create default API key
    const apiKey = await this.createApiKey(application.id, {
      name: 'Default API Key',
      environment: config.environment,
      permissions: ['read_flags', 'log_exposures']
    });

    return {
      application,
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        preview: apiKey.keyPreview
      }
    };
  }

  /**
   * Generate secure API key for an application
   */
  static async createApiKey(applicationId: string, config: ApiKeyConfig) {
    // Generate secure random key
    const key = `ff_${config.environment}_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPreview = key.substring(0, 8) + '...';

    const expiresAt = config.expiresInDays
      ? new Date(Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        applicationId,
        keyHash,
        keyPreview,
        name: config.name,
        environment: config.environment,
        permissions: config.permissions,
        expiresAt
      }
    });

    return {
      ...apiKey,
      key // Only return the raw key once
    };
  }

  /**
   * Validate API key and return application context
   */
  static async validateApiKey(key: string) {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        application: true
      }
    });

    if (!apiKey || !apiKey.isActive) {
      throw new Error('Invalid or inactive API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new Error('API key has expired');
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      applicationId: apiKey.applicationId,
      application: apiKey.application,
      permissions: apiKey.permissions,
      environment: apiKey.environment
    };
  }

  /**
   * Get application with its API keys and flags
   */
  static async getApplication(applicationId: string) {
    return prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        apiKeys: {
          select: {
            id: true,
            name: true,
            keyPreview: true,
            environment: true,
            permissions: true,
            isActive: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true
          }
        },
        flags: {
          select: {
            id: true,
            key: true,
            name: true,
            isActive: true,
            rolloutPct: true,
            environment: true,
            createdAt: true
          }
        }
      }
    });
  }

  /**
   * Get applications by owner email
   */
  static async getApplicationsByOwner(ownerEmail: string) {
    return prisma.application.findMany({
      where: { ownerEmail },
      include: {
        _count: {
          select: {
            apiKeys: true,
            flags: true
          }
        }
      }
    });
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(apiKeyId: string) {
    return prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false }
    });
  }

  /**
   * Get usage analytics for an application
   */
  static async getApplicationAnalytics(applicationId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [exposureCount, flagCount, activeApiKeys] = await Promise.all([
      prisma.exposure.count({
        where: {
          timestamp: { gte: since },
          flag: { applicationId }
        }
      }),
      prisma.flag.count({
        where: { applicationId }
      }),
      prisma.apiKey.count({
        where: {
          applicationId,
          isActive: true,
          lastUsedAt: { gte: since }
        }
      })
    ]);

    return {
      exposureCount,
      flagCount,
      activeApiKeys,
      period: `${days} days`
    };
  }
}