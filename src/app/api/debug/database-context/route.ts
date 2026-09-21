import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { auditServerSecrets } from '@/lib/env/server';
import { publicEnv } from '@/lib/env/public';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rawUrl = publicEnv.SUPABASE_URL;
    let projectRef: string | null = null;
    if (rawUrl) {
      try {
        const u = new URL(rawUrl);
        projectRef = u.hostname.replace('.supabase.co', '');
      } catch {
        projectRef = 'invalid-url';
      }
    }

    // Direct Supabase query check
    let supabaseReachable = false;
    let tableExists = false;
    let supabaseDirectCount: number | null = null;
    let supabaseError: string | null = null;

    if (isSupabaseConfigured() && supabase) {
      try {
        // Query real select id limit 1 para evitar falso positivo do HEAD no PostgREST
        const { data, error } = await supabase
          .from('offers')
          .select('id')
          .limit(1);

        if (error) {
          supabaseError = `${error.code || 'ERROR'}: ${error.message}`;
          supabaseReachable = true;
          tableExists = false;
        } else {
          supabaseReachable = true;
          tableExists = true;
          const { count } = await supabase.from('offers').select('*', { count: 'exact', head: true });
          supabaseDirectCount = count ?? (data ? data.length : 0);
        }
      } catch (err: any) {
        supabaseError = err.message;
        supabaseReachable = false;
        tableExists = false;
      }
    }

    // Check Auth user if available
    let authenticated = false;
    let authUserId: string | null = null;
    if (supabase) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          authenticated = true;
          authUserId = userData.user.id;
        }
      } catch {
        // ignore
      }
    }

    // Counts via dbService
    let serverOffers: any[] = [];
    let serverOffersError: string | null = null;
    try {
      serverOffers = await dbService.getOffers();
    } catch (err: any) {
      serverOffersError = err.message;
    }
    const batches = await dbService.getBatches();
    const mappingBatches = await dbService.getMappingBatches();

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'development',
      context: process.env.CONTEXT || 'local',
      supabaseConfigured: isSupabaseConfigured(),
      supabaseProjectRef: projectRef,
      supabaseConnection: {
        reachable: supabaseReachable,
        tableExists,
        error: supabaseError,
        directOffersCount: supabaseDirectCount,
      },
      authenticated,
      authUserId,
      workspaceId: 'default_workspace',
      organizationId: null,
      offersVisibleToCurrentSession: serverOffers.length,
      offersTotalServerSide: serverOffers.length,
      serverOffersError,
      importsVisible: batches.length,
      mappingRecordsVisible: mappingBatches.length,
      envAudit: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(publicEnv.SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(publicEnv.SUPABASE_ANON_KEY),
        MCP_PUBLIC_URL: Boolean(publicEnv.MCP_PUBLIC_URL),
        ...auditServerSecrets(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
