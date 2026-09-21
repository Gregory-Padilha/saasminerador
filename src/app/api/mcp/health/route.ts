import { NextResponse } from 'next/server';
import { getMcpHealth } from '@/lib/mcp/config';

export const runtime = 'nodejs';

/**
 * Health Check Endpoint for MCP
 */
export async function GET() {
  const health = getMcpHealth();
  return NextResponse.json(health, {
    status: health.status === 'disabled' ? 503 : 200,
  });
}
