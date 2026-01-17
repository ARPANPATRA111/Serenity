

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  
  try {
    const db = getAdminFirestore();
    
    await db.collection('_warmup').limit(1).get();
    
    const elapsed = Date.now() - start;
    
    return NextResponse.json({
      success: true,
      message: 'Warmup complete',
      elapsed: `${elapsed}ms`,
    });
  } catch (error) {
    const elapsed = Date.now() - start;
    
    return NextResponse.json({
      success: true,
      message: 'Warmup complete (with connection)',
      elapsed: `${elapsed}ms`,
    });
  }
}
