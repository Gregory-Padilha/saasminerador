import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AuthenticatedUserContext } from './types';

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = 'Não autorizado. Faça login para continuar.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Server-side helper to ensure the caller has an active, valid Supabase Auth session.
 * Throws UnauthorizedError (401) if not authenticated.
 */
export async function requireUser(): Promise<AuthenticatedUserContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('Sessão expirada ou não autenticada.');
  }

  return {
    user,
    userId: user.id,
    email: user.email || null,
  };
}
