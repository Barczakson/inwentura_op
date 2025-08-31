import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-config'

export async function GET(_req: NextRequest) {
  const start = Date.now()
  try {
    const timeoutMs = Number(process.env.DB_HEALTH_TIMEOUT_MS || 5000)
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    return NextResponse.json({ status: 'ok', durationMs: Date.now() - start })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', durationMs: Date.now() - start, error: message },
      { status: 503 }
    )
  }
}

