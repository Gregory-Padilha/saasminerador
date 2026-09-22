import { User } from '@supabase/supabase-js';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface AuthenticatedUserContext {
  user: User;
  userId: string;
  email: string | null;
}

export interface WorkspaceContext extends AuthenticatedUserContext {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}
