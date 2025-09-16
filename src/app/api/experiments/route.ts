import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const experiments = await prisma.experiment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        flag: {
          select: {
            key: true,
            name: true
          }
        }
      }
    });

    return Response.json({ experiments });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return Response.json({ error: 'Failed to fetch experiments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      flagKey,
      name,
      metric,
      startTs
    } = body;

    if (!flagKey || !name || !metric) {
      return Response.json({
        error: 'Missing required fields: flagKey, name, metric'
      }, { status: 400 });
    }

    // Validate metric
    if (!['conversion_rate', 'click_through_rate'].includes(metric)) {
      return Response.json({
        error: 'Invalid metric. Must be conversion_rate or click_through_rate'
      }, { status: 400 });
    }

    // Check if flag exists
    const flag = await prisma.flag.findUnique({
      where: { key: flagKey }
    });

    if (!flag) {
      return Response.json({
        error: 'Flag not found'
      }, { status: 404 });
    }

    const experiment = await prisma.experiment.create({
      data: {
        flagKey,
        name,
        metric,
        startTs: startTs ? new Date(startTs) : new Date()
      }
    });

    return Response.json({ experiment }, { status: 201 });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return Response.json({ error: 'Failed to create experiment' }, { status: 500 });
  }
}