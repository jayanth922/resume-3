# 🚀 Flagship Integration Guide

## Overview

This guide shows you how to integrate Flagship feature flags into your applications. After [registering your application](/onboard), you'll have an API key that allows your app to securely access feature flags.

## 🔑 Authentication

All SDK requests require your application's API key:

```javascript
const client = createFlagshipClient('user-123', userAttributes, {
  apiUrl: 'https://your-flagship-instance.com',
  apiKey: 'ff_production_abc123...' // Your API key from registration
});
```

## 🌐 Frontend Integration

### React/Next.js Application

#### 1. Install Dependencies

```bash
# Copy the SDK files to your project
cp -r flagship-sdk/javascript.ts src/lib/flagship.ts
```

#### 2. Create Feature Flag Hook

```typescript
// src/hooks/useFeatureFlag.ts
import { useState, useEffect } from 'react';
import { createFlagshipClient, UserAttributes } from '@/lib/flagship';

export function useFeatureFlag(
  flagKey: string, 
  userKey: string, 
  userAttributes: UserAttributes
) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createFlagshipClient(userKey, userAttributes, {
      apiUrl: process.env.NEXT_PUBLIC_FLAGSHIP_URL!,
      apiKey: process.env.NEXT_PUBLIC_FLAGSHIP_API_KEY!
    });

    client.isEnabled(flagKey).then(enabled => {
      setIsEnabled(enabled);
      setLoading(false);
    });

    return () => client.stop();
  }, [flagKey, userKey]);

  return { isEnabled, loading };
}
```

#### 3. Use in Components

```tsx
// src/components/CheckoutButton.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/hooks/useUser';

export function CheckoutButton() {
  const user = useUser();
  const { isEnabled: useNewCheckout, loading } = useFeatureFlag(
    'new-checkout-flow',
    user.id,
    {
      userId: user.id,
      country: user.country,
      deviceType: 'desktop',
      customProperties: { plan: user.plan }
    }
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return useNewCheckout ? (
    <NewCheckoutButton />
  ) : (
    <OldCheckoutButton />
  );
}
```

### Vue.js Application

```javascript
// src/composables/useFeatureFlag.js
import { ref, onMounted, onUnmounted } from 'vue';
import { createFlagshipClient } from '@/lib/flagship';

export function useFeatureFlag(flagKey, userKey, userAttributes) {
  const isEnabled = ref(false);
  const loading = ref(true);
  let client = null;

  onMounted(async () => {
    client = createFlagshipClient(userKey, userAttributes, {
      apiUrl: import.meta.env.VITE_FLAGSHIP_URL,
      apiKey: import.meta.env.VITE_FLAGSHIP_API_KEY
    });

    isEnabled.value = await client.isEnabled(flagKey);
    loading.value = false;
  });

  onUnmounted(() => {
    if (client) client.stop();
  });

  return { isEnabled, loading };
}
```

## 🖥️ Backend Integration

### Node.js/Express Server

#### 1. Server-Side Feature Flags

```typescript
// src/lib/featureFlags.ts
import { createFlagshipClient } from './flagship';

class FeatureFlagService {
  private client: any;

  constructor() {
    this.client = createFlagshipClient('server', {}, {
      apiUrl: process.env.FLAGSHIP_URL!,
      apiKey: process.env.FLAGSHIP_API_KEY!
    });
  }

  async isFeatureEnabled(flagKey: string, userId: string, userAttributes = {}) {
    const userClient = createFlagshipClient(userId, {
      userId,
      ...userAttributes
    }, {
      apiUrl: process.env.FLAGSHIP_URL!,
      apiKey: process.env.FLAGSHIP_API_KEY!
    });

    return await userClient.isEnabled(flagKey);
  }

  async getFeatureVariant(flagKey: string, userId: string, userAttributes = {}) {
    const userClient = createFlagshipClient(userId, {
      userId,
      ...userAttributes
    }, {
      apiUrl: process.env.FLAGSHIP_URL!,
      apiKey: process.env.FLAGSHIP_API_KEY!
    });

    return await userClient.getVariant(flagKey);
  }
}

export const featureFlags = new FeatureFlagService();
```

#### 2. Use in API Routes

```typescript
// src/routes/checkout.ts
import express from 'express';
import { featureFlags } from '@/lib/featureFlags';

const router = express.Router();

router.post('/checkout', async (req, res) => {
  const { userId } = req.user;
  
  // Check if new checkout flow is enabled for this user
  const useNewFlow = await featureFlags.isFeatureEnabled(
    'new-checkout-flow',
    userId,
    { 
      country: req.user.country,
      plan: req.user.plan 
    }
  );

  if (useNewFlow) {
    // Use new checkout logic
    return res.json(await processNewCheckout(req.body));
  } else {
    // Use legacy checkout logic
    return res.json(await processLegacyCheckout(req.body));
  }
});
```

### Python/FastAPI Server

#### 1. Python SDK Integration

```python
# src/lib/feature_flags.py
import asyncio
import aiohttp
import os
from typing import Dict, Any, Optional

class FlagshipClient:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def is_enabled(self, flag_key: str, user_key: str, attributes: Optional[Dict] = None) -> bool:
        result = await self.get_flag(flag_key, user_key, attributes)
        return result.get('value', False)

    async def get_flag(self, flag_key: str, user_key: str, attributes: Optional[Dict] = None) -> Dict[str, Any]:
        params = {
            'userKey': user_key,
            'flagKeys': flag_key
        }
        
        if attributes:
            params.update(attributes)

        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }

        async with self.session.get(
            f'{self.api_url}/api/edge/flags',
            params=params,
            headers=headers
        ) as response:
            data = await response.json()
            flags = data.get('flags', [])
            return flags[0] if flags else {'value': False, 'variant': 'control'}

# Global client instance
feature_flags = FlagshipClient(
    api_url=os.getenv('FLAGSHIP_URL'),
    api_key=os.getenv('FLAGSHIP_API_KEY')
)
```

#### 2. Use in FastAPI Routes

```python
# src/routes/checkout.py
from fastapi import APIRouter, Depends
from src.lib.feature_flags import feature_flags
from src.models.user import User

router = APIRouter()

@router.post("/checkout")
async def checkout(user: User = Depends(get_current_user)):
    async with feature_flags as client:
        use_new_flow = await client.is_enabled(
            'new-checkout-flow',
            user.id,
            {
                'country': user.country,
                'plan': user.plan
            }
        )

        if use_new_flow:
            return await process_new_checkout(user)
        else:
            return await process_legacy_checkout(user)
```

## 📱 Mobile Integration

### React Native

```typescript
// src/lib/featureFlags.ts
import { createFlagshipClient } from './flagship';
import AsyncStorage from '@react-native-async-storage/async-storage';

class MobileFeatureFlags {
  private client: any;

  async initialize(userId: string, userAttributes: any) {
    this.client = createFlagshipClient(userId, userAttributes, {
      apiUrl: 'https://your-flagship-instance.com',
      apiKey: await AsyncStorage.getItem('FLAGSHIP_API_KEY')
    });
  }

  async isEnabled(flagKey: string): Promise<boolean> {
    if (!this.client) throw new Error('FeatureFlags not initialized');
    return await this.client.isEnabled(flagKey);
  }
}

export const mobileFeatureFlags = new MobileFeatureFlags();
```

### Flutter/Dart

```dart
// lib/services/feature_flags.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class FeatureFlagService {
  final String apiUrl;
  final String apiKey;

  FeatureFlagService({required this.apiUrl, required this.apiKey});

  Future<bool> isEnabled(String flagKey, String userKey, Map<String, dynamic> attributes) async {
    final response = await http.get(
      Uri.parse('$apiUrl/api/edge/flags').replace(queryParameters: {
        'userKey': userKey,
        'flagKeys': flagKey,
        ...attributes.map((k, v) => MapEntry(k, v.toString()))
      }),
      headers: {
        'Authorization': 'Bearer $apiKey',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final flags = data['flags'] as List;
      return flags.isNotEmpty ? flags[0]['value'] ?? false : false;
    }

    return false; // Default fallback
  }
}
```

## 🔧 Environment Configuration

### Development Setup

```bash
# .env.local (for Next.js)
NEXT_PUBLIC_FLAGSHIP_URL=http://localhost:3000
NEXT_PUBLIC_FLAGSHIP_API_KEY=ff_development_abc123...

# .env (for Node.js)
FLAGSHIP_URL=http://localhost:3000
FLAGSHIP_API_KEY=ff_development_abc123...
```

### Production Setup

```bash
# Production environment variables
FLAGSHIP_URL=https://flagship.yourcompany.com
FLAGSHIP_API_KEY=ff_production_xyz789...
```

## 🧪 Testing with Feature Flags

### Unit Testing

```typescript
// __tests__/checkout.test.ts
import { jest } from '@jest/globals';
import { featureFlags } from '@/lib/featureFlags';

// Mock the feature flag service
jest.mock('@/lib/featureFlags', () => ({
  featureFlags: {
    isFeatureEnabled: jest.fn()
  }
}));

describe('Checkout Flow', () => {
  it('should use new checkout when flag is enabled', async () => {
    // Mock feature flag to return true
    (featureFlags.isFeatureEnabled as jest.Mock).mockResolvedValue(true);

    const result = await processCheckout(mockUser);
    expect(result.flow).toBe('new');
  });

  it('should use legacy checkout when flag is disabled', async () => {
    // Mock feature flag to return false
    (featureFlags.isFeatureEnabled as jest.Mock).mockResolvedValue(false);

    const result = await processCheckout(mockUser);
    expect(result.flow).toBe('legacy');
  });
});
```

### E2E Testing

```typescript
// cypress/e2e/feature-flags.cy.ts
describe('Feature Flag Testing', () => {
  beforeEach(() => {
    // Set up test user with specific attributes
    cy.setUser({ id: 'test-user', country: 'US', plan: 'premium' });
  });

  it('should show new UI when feature is enabled', () => {
    // Mock API response to enable feature
    cy.intercept('GET', '/api/edge/flags*', {
      flags: [{ flagKey: 'new-ui', value: true, variant: 'treatment' }]
    });

    cy.visit('/dashboard');
    cy.get('[data-testid="new-ui-component"]').should('be.visible');
  });
});
```

## 📊 Error Handling & Fallbacks

### Graceful Degradation

```typescript
// Always provide fallbacks
const useNewFeature = await client.isEnabled('new-feature').catch(() => false);

// Use try-catch for critical features
try {
  const result = await client.getVariant('payment-processor');
  return processPayment(result);
} catch (error) {
  console.error('Feature flag error:', error);
  // Fall back to default payment processor
  return processPayment('stripe');
}
```

### Circuit Breaker Pattern

```typescript
class FeatureFlagCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private threshold = 5;
  private timeout = 60000; // 1 minute

  async getFlag(flagKey: string): Promise<boolean> {
    if (this.isCircuitOpen()) {
      return false; // Default fallback
    }

    try {
      const result = await this.client.isEnabled(flagKey);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return false; // Default fallback
    }
  }

  private isCircuitOpen(): boolean {
    return this.failures >= this.threshold && 
           Date.now() - this.lastFailureTime < this.timeout;
  }
}
```

## 🔍 Monitoring & Analytics

### Custom Analytics Integration

```typescript
// Track feature flag exposures
client.onExposure((flagKey, variant, userKey) => {
  // Send to your analytics service
  analytics.track('Feature Flag Exposure', {
    flagKey,
    variant,
    userKey,
    timestamp: new Date().toISOString()
  });
});

// Track feature flag performance
const startTime = Date.now();
const isEnabled = await client.isEnabled('new-feature');
const latency = Date.now() - startTime;

metrics.histogram('feature_flag_latency', latency, {
  flag_key: 'new-feature'
});
```

## 🎯 Best Practices

### 1. Flag Naming Conventions
- Use descriptive, lowercase names with hyphens
- Include context: `checkout-new-flow`, `payment-processor-v2`
- Avoid abbreviations: `new-user-interface` not `new-ui`

### 2. User Attribute Strategy
```typescript
const standardAttributes = {
  userId: user.id,
  country: user.country,
  deviceType: detectDeviceType(),
  userAgent: navigator.userAgent,
  customProperties: {
    plan: user.subscription.plan,
    signupDate: user.createdAt,
    isEmployee: user.email.endsWith('@yourcompany.com')
  }
};
```

### 3. Gradual Rollout Strategy
```
1. Start: 0% (disabled)
2. Internal: 5% (employees only)
3. Beta: 10% (beta users)
4. Limited: 25% (random sampling)
5. Majority: 75% (confident rollout)
6. Full: 100% (complete rollout)
```

### 4. Kill Switch Preparation
```typescript
// Always monitor for kill switch
setInterval(async () => {
  const isKilled = await client.isEnabled('kill-all-features');
  if (isKilled) {
    // Disable all experimental features
    disableAllExperimentalFeatures();
  }
}, 5000); // Check every 5 seconds
```

## 🚀 Advanced Use Cases

### A/B Testing with Conversion Tracking

```typescript
// Track conversions for A/B tests
const variant = await client.getVariant('checkout-button-color');

// Show appropriate UI
if (variant === 'green') {
  showGreenButton();
} else {
  showBlueButton();
}

// Track conversion when user completes purchase
await client.logExposure('checkout-button-color', variant, {
  event: 'purchase_completed',
  value: purchaseAmount
});
```

### Multi-Variate Testing

```typescript
const config = await client.getVariant('homepage-layout');
// Returns: { layout: 'grid', colorScheme: 'dark', ctaText: 'Get Started' }

renderHomepage({
  layout: config.layout,
  theme: config.colorScheme,
  buttonText: config.ctaText
});
```

### Feature Flag Dependencies

```typescript
// Check multiple flags for complex features
const [hasNewDashboard, hasAdvancedAnalytics] = await Promise.all([
  client.isEnabled('new-dashboard'),
  client.isEnabled('advanced-analytics')
]);

if (hasNewDashboard && hasAdvancedAnalytics) {
  // Show new dashboard with advanced analytics
} else if (hasNewDashboard) {
  // Show new dashboard with basic analytics
} else {
  // Show legacy dashboard
}
```

---

## 📞 Support

- **Documentation**: [https://flagship-docs.com](https://flagship-docs.com)
- **API Reference**: [https://flagship-api.com](https://flagship-api.com)  
- **Support**: [support@flagship.dev](mailto:support@flagship.dev)
- **Community**: [https://github.com/flagship/community](https://github.com/flagship/community)

## 🎉 What's Next?

1. **Create your first flag** in the [admin dashboard](/dashboard)
2. **Set up A/B testing** for data-driven decisions
3. **Monitor performance** with built-in analytics
4. **Scale safely** with gradual rollouts and kill switches

Happy feature flagging! 🚀