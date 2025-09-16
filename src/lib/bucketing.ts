import { UserAttributes, TargetingRules } from '@/types';

/**
 * Simple hash function for Edge Runtime (replaces murmur3 to reduce bundle size)
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a consistent bucket for a user using simple hash
 */
export function getBucket(userKey: string, salt: string): number {
  const combined = `${userKey}:${salt}`;
  const hash = simpleHash(combined);
  return hash % 100;
}

/**
 * Check if user matches targeting rules
 */
export function matchesTargetingRules(
  attributes: UserAttributes,
  rules: TargetingRules
): boolean {
  // If no rules, everyone matches
  if (!rules || Object.keys(rules).length === 0) {
    return true;
  }

  // Check country targeting
  if (rules.country && rules.country.length > 0) {
    if (!attributes.country || !rules.country.includes(attributes.country)) {
      return false;
    }
  }

  // Check device type targeting
  if (rules.deviceType && rules.deviceType.length > 0) {
    if (!attributes.deviceType || !rules.deviceType.includes(attributes.deviceType)) {
      return false;
    }
  }

  // Check user agent targeting
  if (rules.userAgent && rules.userAgent.length > 0) {
    if (!attributes.userAgent) {
      return false;
    }
    const matches = rules.userAgent.some(pattern => 
      attributes.userAgent!.toLowerCase().includes(pattern.toLowerCase())
    );
    if (!matches) {
      return false;
    }
  }

  // Check custom properties
  if (rules.customProperties) {
    for (const [key, expectedValue] of Object.entries(rules.customProperties)) {
      const userValue = attributes.customProperties?.[key];
      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(userValue)) {
          return false;
        }
      } else if (userValue !== expectedValue) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Select variant for multivariate flags based on weighted distribution
 */
export function selectVariant(variants: any[], bucket: number): any {
  if (variants.length === 0) {
    throw new Error('No variants available');
  }

  if (variants.length === 1) {
    return variants[0];
  }

  // If weights are specified, use weighted selection
  const hasWeights = variants.some(v => v.weight !== undefined);
  
  if (hasWeights) {
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight === 0) {
      // Fallback to equal distribution if all weights are 0
      return variants[bucket % variants.length];
    }
    
    const target = (bucket / 100) * totalWeight;
    let currentWeight = 0;
    
    for (const variant of variants) {
      currentWeight += variant.weight || 0;
      if (target <= currentWeight) {
        return variant;
      }
    }
  }

  // Equal distribution
  return variants[bucket % variants.length];
}