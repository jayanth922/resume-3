import { NextRequest } from 'next/server';
import { redis, CACHE_KEYS } from '@/lib/redis';
import { getBucket, matchesTargetingRules, selectVariant } from '@/lib/bucketing';
import { Flag, UserAttributes, FlagEvaluationResult } from '@/types';
import { ApplicationManager } from '@/lib/applications';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Optional API key authentication
    let applicationContext = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      try {
        applicationContext = await ApplicationManager.validateApiKey(apiKey);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get('userKey');
    const flagKeys = searchParams.get('flagKeys')?.split(',') || [];
    
    if (!userKey) {
      return new Response(
        JSON.stringify({ error: 'userKey is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse user attributes from query params
    const attributes: UserAttributes = {
      userId: userKey,
      country: searchParams.get('country') || undefined,
      deviceType: searchParams.get('deviceType') as any || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };

    // Add custom properties if provided
    const customPropsStr = searchParams.get('customProperties');
    if (customPropsStr) {
      try {
        attributes.customProperties = JSON.parse(customPropsStr);
      } catch (e) {
        // Ignore invalid JSON
      }
    }

    const results: FlagEvaluationResult[] = [];

    if (flagKeys.length === 0) {
      // Return all active flags (filtered by application if authenticated)
      const allFlags = await redis.get<Flag[]>(CACHE_KEYS.allFlags());
      if (allFlags) {
        for (const flag of allFlags) {
          // Filter flags by application if API key is provided
          if (applicationContext && flag.applicationId && 
              flag.applicationId !== applicationContext.applicationId) {
            continue;
          }
          
          const result = evaluateFlag(flag, userKey, attributes);
          results.push(result);
        }
      }
    } else {
      // Return specific flags
      for (const flagKey of flagKeys) {
        const flag = await redis.get<Flag>(CACHE_KEYS.flag(flagKey));
        if (flag) {
          // Check application access
          if (applicationContext && flag.applicationId && 
              flag.applicationId !== applicationContext.applicationId) {
            results.push({
              flagKey,
              variant: 'control',
              value: false,
              isActive: false,
              reason: 'access_denied'
            });
            continue;
          }

          const result = evaluateFlag(flag, userKey, attributes);
          results.push(result);
        } else {
          results.push({
            flagKey,
            variant: 'control',
            value: false,
            isActive: false,
            reason: 'flag_not_found'
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        flags: results,
        userKey,
        attributes,
        evaluationTime: duration
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Evaluation-Time': duration.toString(),
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('Flag evaluation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function evaluateFlag(
  flag: Flag,
  userKey: string,
  attributes: UserAttributes
): FlagEvaluationResult {
  // Check if flag is active
  if (!flag.isActive) {
    const defaultVariant = flag.variants[0] || { key: 'control', value: false };
    return {
      flagKey: flag.key,
      variant: defaultVariant.key,
      value: defaultVariant.value,
      isActive: false,
      reason: 'flag_disabled'
    };
  }

  // Check targeting rules
  if (!matchesTargetingRules(attributes, flag.rules)) {
    const defaultVariant = flag.variants[0] || { key: 'control', value: false };
    return {
      flagKey: flag.key,
      variant: defaultVariant.key,
      value: defaultVariant.value,
      isActive: false,
      reason: 'targeting_rules_not_met'
    };
  }

  // Check rollout percentage
  const bucket = getBucket(userKey, flag.salt);
  if (bucket >= flag.rolloutPct) {
    const defaultVariant = flag.variants[0] || { key: 'control', value: false };
    return {
      flagKey: flag.key,
      variant: defaultVariant.key,
      value: defaultVariant.value,
      isActive: false,
      reason: 'not_in_rollout'
    };
  }

  // Select variant
  const variant = selectVariant(flag.variants, bucket);
  
  return {
    flagKey: flag.key,
    variant: variant.key,
    value: variant.value,
    isActive: true,
    reason: 'evaluated'
  };
}