import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Root Route Handler:
 * Authenticated users -> /dashboard
 * Unauthenticated users -> /login
 */
export default async function RootPage() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect('/dashboard');
    }
  } catch (err: any) {
    // If Next.js redirect thrown, rethrow
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }

  redirect('/login');
}
