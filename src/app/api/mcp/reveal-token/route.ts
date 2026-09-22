import { NextResponse } from 'next/server';
import { getMcpToken } from '@/lib/mcp/config';
import { requireRole } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

/**
 * Action endpoint for explicitly revealing MCP token in Settings UI.
 * Restricted strictly to authenticated OWNER or ADMIN users.
 */
export async function POST() {
  try {
    await requireRole(['OWNER', 'ADMIN']);
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || 'Acesso negado. Requer permissão OWNER ou ADMIN.', code: 'FORBIDDEN' },
      { status: authErr.statusCode || 403 }
    );
  }

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
