import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { redis, CACHE_KEYS } from '@/lib/redis';
import { Flag } from '@/types';

export async function GET() {
  try {
    const flags = await prisma.flag.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Cache all flags in Redis for edge reads
    await redis.set(CACHE_KEYS.allFlags(), flags, { ex: 300 }); // 5 min cache

    // Cache individual flags
    for (const flag of flags) {
      await redis.set(CACHE_KEYS.flag(flag.key), flag, { ex: 300 });
    }

    return Response.json({ flags });
  } catch (error) {
    console.error('Error fetching flags:', error);
    return Response.json({ error: 'Failed to fetch flags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      key,
      name,
      description,
      type = 'BOOLEAN',
      variants,
      rules = {},
      rolloutPct = 0
    } = body;

    if (!key || !name || !variants || !Array.isArray(variants) || variants.length === 0) {
      return Response.json({
        error: 'Missing required fields: key, name, variants'
      }, { status: 400 });
    }

    // Check if flag key already exists
    const existingFlag = await prisma.flag.findUnique({
      where: { key }
    });

    if (existingFlag) {
      return Response.json({
        error: 'Flag with this key already exists'
      }, { status: 400 });
    }

    const flag = await prisma.flag.create({
      data: {
        key,
        name,
        description,
        type,
        variants,
        rules,
        rolloutPct: Math.max(0, Math.min(100, rolloutPct))
      }
    });

    // Update cache
    await updateFlagCache();

    return Response.json({ flag }, { status: 201 });
  } catch (error) {
    console.error('Error creating flag:', error);
    return Response.json({ error: 'Failed to create flag' }, { status: 500 });
  }
}

async function updateFlagCache() {
  try {
    const flags = await prisma.flag.findMany({
      where: { isActive: true }
    });

    // Update all flags cache
    await redis.set(CACHE_KEYS.allFlags(), flags, { ex: 300 });

    // Update individual flag caches
    for (const flag of flags) {
      await redis.set(CACHE_KEYS.flag(flag.key), flag, { ex: 300 });
    }
  } catch (error) {
    console.error('Error updating flag cache:', error);
  }
}