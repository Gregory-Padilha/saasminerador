import { NextResponse } from 'next/server';
import { getMcpToken } from '@/lib/mcp/config';

export const runtime = 'nodejs';

/**
 * Action endpoint for explicitly revealing MCP token in Settings UI
 */
export async function POST() {
  const token = getMcpToken();
  if (!token) {
    return NextResponse.json({
      configured: false,
      token: null,
      message: 'Token não configurado no .env (OFFER_MINER_MCP_TOKEN)',
    });
  }

  return NextResponse.json({
    configured: true,
    token,
    maskedToken: `${token.substring(0, 4)}...${token.substring(token.length - 4)}`,
  });
}
