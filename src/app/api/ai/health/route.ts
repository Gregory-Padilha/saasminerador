import { NextResponse } from 'next/server';
import { getMcpHealth } from '@/lib/mcp/config';
import { AI_TOOLS_LIST } from '@/lib/ai-tools/registry';

export const runtime = 'nodejs';

export async function GET() {
  const mcpHealth = getMcpHealth(AI_TOOLS_LIST.length);

  return NextResponse.json({
    gateway: 'Offer Miner AI Gateway v1',
    status: mcpHealth.status,
    mode: 'read-only',
    authMode: 'token',
    transports: ['mcp-http', 'mcp-stdio', 'rest-openapi'],
    toolsCount: AI_TOOLS_LIST.length,
    remoteConfigured: mcpHealth.remoteConfigured,
    remoteUrl: mcpHealth.remoteUrl,
    uptimeSeconds: mcpHealth.uptimeSeconds,
  });
}
