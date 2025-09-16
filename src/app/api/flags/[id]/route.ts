import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { redis, CACHE_KEYS } from '@/lib/redis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  try {
    const flag = await prisma.flag.findUnique({
      where: { id }
    });

    if (!flag) {
      return Response.json({ error: 'Flag not found' }, { status: 404 });
    }

    return Response.json({ flag });
  } catch (error) {
    console.error('Error fetching flag:', error);
    return Response.json({ error: 'Failed to fetch flag' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      variants,
      rules,
      rolloutPct,
      isActive
    } = body;

    const flag = await prisma.flag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(variants && { variants }),
        ...(rules !== undefined && { rules }),
        ...(rolloutPct !== undefined && { rolloutPct: Math.max(0, Math.min(100, rolloutPct)) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    // Update cache
    await updateFlagCache();

    return Response.json({ flag });
  } catch (error) {
    console.error('Error updating flag:', error);
    return Response.json({ error: 'Failed to update flag' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  try {
    await prisma.flag.delete({
      where: { id }
    });

    // Update cache
    await updateFlagCache();

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting flag:', error);
    return Response.json({ error: 'Failed to delete flag' }, { status: 500 });
  }
}

// Kill switch endpoint
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'kill') {
      const flag = await prisma.flag.update({
        where: { id },
        data: { isActive: false }
      });

      // Immediately update cache for fast propagation
      await redis.set(CACHE_KEYS.flag(flag.key), flag, { ex: 300 });
      await updateFlagCache();

      return Response.json({ 
        flag,
        message: 'Flag killed successfully' 
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in kill switch:', error);
    return Response.json({ error: 'Failed to execute kill switch' }, { status: 500 });
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