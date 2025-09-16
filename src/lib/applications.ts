import { prisma } from './database';

// Web Crypto API helpers for Edge Runtime compatibility
function generateRandomBytes(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
}

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
    const key = `ff_${config.environment}_${generateRandomBytes(32)}`;
    const keyHash = await sha256Hash(key);
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
    const keyHash = await sha256Hash(key);

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