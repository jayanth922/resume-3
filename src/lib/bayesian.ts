export interface ExperimentData {
  control: {
    users: number;
    conversions: number;
  };
  treatment: {
    users: number;
    conversions: number;
  };
}

export interface BayesianResult {
  control: {
    users: number;
    conversions: number;
    conversionRate: number;
    alpha: number; // Beta distribution parameter
    beta: number;  // Beta distribution parameter
  };
  treatment: {
    users: number;
    conversions: number;
    conversionRate: number;
    alpha: number;
    beta: number;
  };
  winProbability: number; // P(treatment > control)
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  isSignificant: boolean;
  expectedLift: number;
  relativeLift: number;
}

// Global state for normal random generation
let hasSpare = false;
let spare: number = 0;

/**
 * Compute Bayesian A/B test results using Beta-Binomial model
 */
export function computeBayesianABTest(data: ExperimentData): BayesianResult {
  // Beta(1,1) prior (uniform)
  const priorAlpha = 1;
  const priorBeta = 1;

  // Posterior parameters for control
  const controlAlpha = priorAlpha + data.control.conversions;
  const controlBeta = priorBeta + data.control.users - data.control.conversions;
  
  // Posterior parameters for treatment
  const treatmentAlpha = priorAlpha + data.treatment.conversions;
  const treatmentBeta = priorBeta + data.treatment.users - data.treatment.conversions;

  // Conversion rates
  const controlRate = data.control.conversions / Math.max(data.control.users, 1);
  const treatmentRate = data.treatment.conversions / Math.max(data.treatment.users, 1);

  // Calculate P(treatment > control) using Monte Carlo simulation
  const winProbability = calculateWinProbability(
    treatmentAlpha, treatmentBeta,
    controlAlpha, controlBeta
  );

  // Calculate confidence interval for the difference
  const { lower, upper } = calculateConfidenceInterval(
    treatmentAlpha, treatmentBeta,
    controlAlpha, controlBeta
  );

  // Expected lift and relative lift
  const expectedTreatmentRate = treatmentAlpha / (treatmentAlpha + treatmentBeta);
  const expectedControlRate = controlAlpha / (controlAlpha + controlBeta);
  const expectedLift = expectedTreatmentRate - expectedControlRate;
  const relativeLift = expectedControlRate > 0 ? (expectedLift / expectedControlRate) * 100 : 0;

  return {
    control: {
      users: data.control.users,
      conversions: data.control.conversions,
      conversionRate: controlRate,
      alpha: controlAlpha,
      beta: controlBeta
    },
    treatment: {
      users: data.treatment.users,
      conversions: data.treatment.conversions,
      conversionRate: treatmentRate,
      alpha: treatmentAlpha,
      beta: treatmentBeta
    },
    winProbability,
    confidenceInterval: { lower, upper },
    isSignificant: winProbability >= 0.95 || winProbability <= 0.05,
    expectedLift,
    relativeLift
  };
}

/**
 * Calculate P(treatment > control) using analytical approximation
 */
function calculateWinProbability(
  treatmentAlpha: number,
  treatmentBeta: number,
  controlAlpha: number,
  controlBeta: number
): number {
  // For Beta distributions, we can use the fact that if X ~ Beta(a1, b1) and Y ~ Beta(a2, b2),
  // then P(X > Y) can be computed analytically in some cases, but we'll use simulation for accuracy
  
  const numSamples = 10000;
  let treatmentWins = 0;

  for (let i = 0; i < numSamples; i++) {
    const treatmentSample = betaRandom(treatmentAlpha, treatmentBeta);
    const controlSample = betaRandom(controlAlpha, controlBeta);
    
    if (treatmentSample > controlSample) {
      treatmentWins++;
    }
  }

  return treatmentWins / numSamples;
}

/**
 * Calculate 95% confidence interval for the difference in conversion rates
 */
function calculateConfidenceInterval(
  treatmentAlpha: number,
  treatmentBeta: number,
  controlAlpha: number,
  controlBeta: number
): { lower: number; upper: number } {
  const numSamples = 10000;
  const differences: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const treatmentSample = betaRandom(treatmentAlpha, treatmentBeta);
    const controlSample = betaRandom(controlAlpha, controlBeta);
    differences.push(treatmentSample - controlSample);
  }

  differences.sort((a, b) => a - b);
  
  const lowerIndex = Math.floor(0.025 * numSamples);
  const upperIndex = Math.floor(0.975 * numSamples);

  return {
    lower: differences[lowerIndex] || 0,
    upper: differences[upperIndex] || 0
  };
}

/**
 * Generate a random sample from Beta distribution using rejection sampling
 */
function betaRandom(alpha: number, beta: number): number {
  // Use the fact that if X ~ Gamma(alpha, 1) and Y ~ Gamma(beta, 1),
  // then X/(X+Y) ~ Beta(alpha, beta)
  
  const x = gammaRandom(alpha);
  const y = gammaRandom(beta);
  
  return x / (x + y);
}

/**
 * Generate a random sample from Gamma distribution using Marsaglia and Tsang method
 */
function gammaRandom(shape: number, scale: number = 1): number {
  if (shape < 1) {
    // Use the relation Gamma(a) = Gamma(a+1) * U^(1/a)
    return gammaRandom(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1/3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;

    do {
      x = normalRandom();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();
    
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Generate a random sample from standard normal distribution using Box-Muller transform
 */
function normalRandom(): number {
  if (hasSpare) {
    hasSpare = false;
    return spare;
  }

  hasSpare = true;
  
  const u = Math.random();
  const v = Math.random();
  
  const mag = Math.sqrt(-2.0 * Math.log(u));
  spare = mag * Math.cos(2.0 * Math.PI * v);
  
  return mag * Math.sin(2.0 * Math.PI * v);
}