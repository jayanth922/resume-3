import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { computeBayesianABTest, ExperimentData } from '@/lib/bayesian';

export async function POST() {
  try {
    const activeExperiments = await prisma.experiment.findMany({
      where: {
        isActive: true,
        stopTs: null
      }
    });

    const results = [];

    for (const experiment of activeExperiments) {
      try {
        const summary = await computeExperimentSummary(experiment.flagKey, experiment.metric);
        
        if (summary) {
          // Check for auto-stop conditions
          const shouldStop = summary.isSignificant && (
            summary.winProbability >= 0.95 || 
            summary.winProbability <= 0.05
          );

          const updatedExperiment = await prisma.experiment.update({
            where: { id: experiment.id },
            data: {
              summaryJson: summary as any,
              ...(shouldStop && { stopTs: new Date(), isActive: false })
            }
          });

          results.push({
            experiment: updatedExperiment,
            summary,
            autoStopped: shouldStop
          });
        }
      } catch (error) {
        console.error(`Error computing experiment ${experiment.id}:`, error);
        results.push({
          experiment,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return Response.json({
      processedExperiments: results.length,
      results
    });
  } catch (error) {
    console.error('Error computing experiments:', error);
    return Response.json({ error: 'Failed to compute experiments' }, { status: 500 });
  }
}

async function computeExperimentSummary(flagKey: string, metric: string) {
  // Get all exposures for this flag
  const exposures = await prisma.exposure.findMany({
    where: { flagKey },
    orderBy: { timestamp: 'desc' }
  });

  if (exposures.length === 0) {
    return null;
  }

  // Group by variant
  const variantGroups = exposures.reduce((acc: Record<string, typeof exposures>, exposure: any) => {
    if (!acc[exposure.variant]) {
      acc[exposure.variant] = [];
    }
    acc[exposure.variant].push(exposure);
    return acc;
  }, {} as Record<string, typeof exposures>);

  // Find control and treatment groups
  const controlVariant = Object.keys(variantGroups).find(v => 
    v.toLowerCase().includes('control') || v === 'false' || v === '0'
  ) || Object.keys(variantGroups)[0];

  const treatmentVariant = Object.keys(variantGroups).find(v => 
    v !== controlVariant && (v.toLowerCase().includes('treatment') || v === 'true' || v === '1')
  ) || Object.keys(variantGroups)[1];

  if (!controlVariant || !treatmentVariant) {
    return null;
  }

  const controlExposures = variantGroups[controlVariant] || [];
  const treatmentExposures = variantGroups[treatmentVariant] || [];

  // Count unique users
  const controlUsers = new Set(controlExposures.map((e: any) => e.userKey)).size;
  const treatmentUsers = new Set(treatmentExposures.map((e: any) => e.userKey)).size;

  if (controlUsers === 0 || treatmentUsers === 0) {
    return null;
  }

  // For now, simulate conversions (in a real app, you'd track actual conversion events)
  // This is a simplified version - you'd want to track actual conversion events
  const controlConversions = Math.floor(controlUsers * (0.1 + Math.random() * 0.1)); // 10-20% conversion
  const treatmentConversions = Math.floor(treatmentUsers * (0.12 + Math.random() * 0.1)); // 12-22% conversion

  const experimentData: ExperimentData = {
    control: {
      users: controlUsers,
      conversions: controlConversions
    },
    treatment: {
      users: treatmentUsers,
      conversions: treatmentConversions
    }
  };

  return computeBayesianABTest(experimentData);
}