export interface UserAttributes {
  userId: string;
  country?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  userAgent?: string;
  customProperties?: Record<string, any>;
}

export interface FlagVariant {
  key: string;
  value: any;
  weight?: number; // For multivariate flags
}

export interface TargetingRules {
  country?: string[];
  deviceType?: string[];
  userAgent?: string[];
  customProperties?: Record<string, any>;
}

export interface Flag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: 'BOOLEAN' | 'MULTIVARIATE';
  variants: FlagVariant[];
  rules: TargetingRules;
  rolloutPct: number;
  salt: string;
  isActive: boolean;
  applicationId?: string; // Optional: restrict flag to specific application
  environment?: string;   // development, staging, production
  createdAt: Date;
  updatedAt: Date;
}

export interface Exposure {
  id: string;
  userKey: string;
  flagKey: string;
  variant: string;
  timestamp: Date;
  attributesJson?: UserAttributes;
}

export interface ExperimentSummary {
  control: {
    users: number;
    conversions: number;
    conversionRate: number;
  };
  treatment: {
    users: number;
    conversions: number;
    conversionRate: number;
  };
  winProbability: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  isSignificant: boolean;
}

export interface Experiment {
  id: string;
  flagKey: string;
  name: string;
  metric: 'conversion_rate' | 'click_through_rate';
  startTs: Date;
  stopTs?: Date;
  summaryJson?: ExperimentSummary;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagEvaluationResult {
  flagKey: string;
  variant: string;
  value: any;
  isActive: boolean;
  reason: string;
}