import { requireWorkspace, ForbiddenError } from './require-workspace';
import { WorkspaceContext, WorkspaceRole } from './types';

/**
 * Server-side helper to ensure the user has one of the required roles in the workspace.
 * Typically used to protect administrative or destructive actions (e.g. ['OWNER', 'ADMIN']).
 */
export async function requireRole(
  allowedRoles: WorkspaceRole[],
  targetWorkspaceId?: string
): Promise<WorkspaceContext> {
  const wsCtx = await requireWorkspace(targetWorkspaceId);

  if (!allowedRoles.includes(wsCtx.role)) {
    throw new ForbiddenError(
      `Permissão insuficiente. Esta ação requer perfil [${allowedRoles.join(', ')}], seu perfil atual é ${wsCtx.role}.`
    );
  }

  return wsCtx;
}
