import { getBucket } from '../lib/bucketing';
import { UserAttributes, FlagEvaluationResult } from '../types';

export interface FlagshipConfig {
  apiUrl: string;
  apiKey?: string; // Add API key for authentication
  refreshInterval?: number; // seconds
  enableDebugLogs?: boolean;
}

export interface FlagCache {
  [flagKey: string]: {
    result: FlagEvaluationResult;
    timestamp: number;
    ttl: number;
  };
}

export class FlagshipClient {
  private config: FlagshipConfig;
  private cache: FlagCache = {};
  private refreshTimer?: NodeJS.Timeout;
  private userKey: string;
  private userAttributes: UserAttributes;

  constructor(
    userKey: string, 
    userAttributes: UserAttributes, 
    config: FlagshipConfig
  ) {
    this.userKey = userKey;
    this.userAttributes = userAttributes;
    this.config = {
      refreshInterval: 60, // Default 60 seconds
      enableDebugLogs: false,
      ...config
    };

    // Start periodic refresh if enabled
    if (this.config.refreshInterval && this.config.refreshInterval > 0) {
      this.startPeriodicRefresh();
    }
  }

  /**
   * Evaluate a feature flag for the current user
   */
  async getFlag(flagKey: string): Promise<FlagEvaluationResult> {
    // Check cache first
    const cached = this.getCachedFlag(flagKey);
    if (cached) {
      this.log(`Cache hit for flag: ${flagKey}`);
      return cached;
    }

    // Fetch from API
    this.log(`Cache miss for flag: ${flagKey}, fetching from API`);
    return this.fetchAndCacheFlag(flagKey);
  }

  /**
   * Get multiple flags at once
   */
  async getFlags(flagKeys?: string[]): Promise<Record<string, FlagEvaluationResult>> {
    const params = new URLSearchParams({
      userKey: this.userKey,
      country: this.userAttributes.country || '',
      deviceType: this.userAttributes.deviceType || '',
      customProperties: JSON.stringify(this.userAttributes.customProperties || {})
    });

    if (flagKeys && flagKeys.length > 0) {
      params.set('flagKeys', flagKeys.join(','));
    }

    const headers: Record<string, string> = {
      'User-Agent': this.userAttributes.userAgent || navigator.userAgent
    };

    // Add API key authentication if provided
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/edge/flags?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const results: Record<string, FlagEvaluationResult> = {};

      // Cache and return results
      for (const flag of data.flags || []) {
        this.cacheFlag(flag.flagKey, flag);
        results[flag.flagKey] = flag;
      }

      this.log(`Fetched ${Object.keys(results).length} flags from API`);
      return results;
    } catch (error) {
      this.log(`Error fetching flags: ${error}`, 'error');
      return {};
    }
  }

  /**
   * Check if a boolean flag is enabled
   */
  async isEnabled(flagKey: string): Promise<boolean> {
    const result = await this.getFlag(flagKey);
    return result.isActive && Boolean(result.value);
  }

  /**
   * Get the variant value for a flag
   */
  async getVariant(flagKey: string): Promise<any> {
    const result = await this.getFlag(flagKey);
    return result.isActive ? result.value : null;
  }

  /**
   * Log an exposure event
   */
  async logExposure(flagKey: string, variant: string): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/exposures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userKey: this.userKey,
          flagKey,
          variant,
          attributes: this.userAttributes
        })
      });

      this.log(`Logged exposure: ${flagKey} = ${variant}`);
    } catch (error) {
      this.log(`Error logging exposure: ${error}`, 'error');
    }
  }

  /**
   * Update user attributes
   */
  updateUserAttributes(attributes: Partial<UserAttributes>): void {
    this.userAttributes = { ...this.userAttributes, ...attributes };
    // Clear cache since user attributes changed
    this.clearCache();
    this.log('User attributes updated, cache cleared');
  }

  /**
   * Manually refresh all cached flags
   */
  async refresh(): Promise<void> {
    this.clearCache();
    const cachedKeys = Object.keys(this.cache);
    if (cachedKeys.length > 0) {
      await this.getFlags(cachedKeys);
    }
    this.log('Manual refresh completed');
  }

  /**
   * Stop the client and cleanup
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.clearCache();
    this.log('Client stopped');
  }

  private async fetchAndCacheFlag(flagKey: string): Promise<FlagEvaluationResult> {
    const flags = await this.getFlags([flagKey]);
    
    if (flags[flagKey]) {
      // Auto-log exposure for active flags
      if (flags[flagKey].isActive) {
        this.logExposure(flagKey, flags[flagKey].variant).catch(() => {
          // Silently handle exposure logging failures
        });
      }
      return flags[flagKey];
    }

    // Return default if flag not found
    const defaultResult: FlagEvaluationResult = {
      flagKey,
      variant: 'control',
      value: false,
      isActive: false,
      reason: 'flag_not_found'
    };

    this.cacheFlag(flagKey, defaultResult);
    return defaultResult;
  }

  private getCachedFlag(flagKey: string): FlagEvaluationResult | null {
    const cached = this.cache[flagKey];
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      delete this.cache[flagKey];
      return null;
    }

    return cached.result;
  }

  private cacheFlag(flagKey: string, result: FlagEvaluationResult): void {
    this.cache[flagKey] = {
      result,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    };
  }

  private clearCache(): void {
    this.cache = {};
  }

  private startPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.refresh().catch(error => {
        this.log(`Periodic refresh failed: ${error}`, 'error');
      });
    }, (this.config.refreshInterval || 60) * 1000);

    this.log(`Started periodic refresh every ${this.config.refreshInterval} seconds`);
  }

  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.config.enableDebugLogs) {
      const timestamp = new Date().toISOString();
      if (level === 'error') {
        console.error(`[Flagship ${timestamp}] ${message}`);
      } else {
        console.log(`[Flagship ${timestamp}] ${message}`);
      }
    }
  }
}

// Factory function for easier usage
export function createFlagshipClient(
  userKey: string,
  userAttributes: UserAttributes,
  config: FlagshipConfig
): FlagshipClient {
  return new FlagshipClient(userKey, userAttributes, config);
}