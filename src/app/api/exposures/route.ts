import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userKey,
      flagKey,
      variant,
      attributes
    } = body;

    if (!userKey || !flagKey || !variant) {
      return Response.json({
        error: 'Missing required fields: userKey, flagKey, variant'
      }, { status: 400 });
    }

    const exposure = await prisma.exposure.create({
      data: {
        userKey,
        flagKey,
        variant,
        attributesJson: attributes || {}
      }
    });

    return Response.json({ exposure }, { status: 201 });
  } catch (error) {
    console.error('Error logging exposure:', error);
    return Response.json({ error: 'Failed to log exposure' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flagKey = searchParams.get('flagKey');
    const userKey = searchParams.get('userKey');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (flagKey) where.flagKey = flagKey;
    if (userKey) where.userKey = userKey;

    const exposures = await prisma.exposure.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.exposure.count({ where });

    return Response.json({
      exposures,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching exposures:', error);
    return Response.json({ error: 'Failed to fetch exposures' }, { status: 500 });
  }
}