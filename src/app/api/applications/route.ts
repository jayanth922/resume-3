import { NextRequest } from 'next/server';
import { ApplicationManager } from '@/lib/applications';
import { z } from 'zod';

const createApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  ownerEmail: z.string().email(),
  environment: z.enum(['development', 'staging', 'production']).default('production')
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  environment: z.string(),
  permissions: z.array(z.string()).default(['read_flags', 'log_exposures']),
  expiresInDays: z.number().positive().optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');

    if (!ownerEmail) {
      return Response.json({ error: 'ownerEmail parameter required' }, { status: 400 });
    }

    const applications = await ApplicationManager.getApplicationsByOwner(ownerEmail);
    return Response.json({ applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return Response.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createApplicationSchema.parse(body);

    const result = await ApplicationManager.createApplication(validatedData);

    return Response.json({
      application: result.application,
      apiKey: result.apiKey,
      message: 'Application created successfully'
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error creating application:', error);
    return Response.json({ error: 'Failed to create application' }, { status: 500 });
  }
}