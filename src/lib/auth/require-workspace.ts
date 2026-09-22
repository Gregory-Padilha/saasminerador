import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireUser } from './require-user';
import { WorkspaceContext, WorkspaceRole } from './types';

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'Acesso não autorizado a este workspace.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Server-side helper to ensure the user is an authorized member of a valid workspace.
 * Throws UnauthorizedError (401) if not logged in, or ForbiddenError (403) if not a member.
 */
export async function requireWorkspace(targetWorkspaceId?: string): Promise<WorkspaceContext> {
  const userCtx = await requireUser();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name)')
    .eq('user_id', userCtx.userId);

  if (targetWorkspaceId) {
    query = query.eq('workspace_id', targetWorkspaceId);
  }

  const { data: members, error } = await query.limit(1);

  if (error || !members || members.length === 0) {
    throw new ForbiddenError('Acesso não autorizado. Sua conta não possui vínculo com nenhum workspace.');
  }

  const membership = members[0];
  const wsData = (membership as any).workspaces;
  const workspaceName = wsData?.name || 'Workspace';

  return {
    ...userCtx,
    workspaceId: membership.workspace_id,
    workspaceName,
    role: membership.role as WorkspaceRole,
  };
}
