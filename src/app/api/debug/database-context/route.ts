import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
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
        const { data, count, error } = await supabase
          .from('offers')
          .select('id', { count: 'exact', head: true });

        if (error) {
          supabaseError = error.message || error.code || 'Unknown Supabase error';
          supabaseReachable = true;
          tableExists = false;
        } else {
          supabaseReachable = true;
          tableExists = true;
          supabaseDirectCount = count ?? 0;
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
    const serverOffers = await dbService.getOffers();
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
      importsVisible: batches.length,
      mappingRecordsVisible: mappingBatches.length,
      envAudit: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        OFFER_MINER_MCP_TOKEN: Boolean(process.env.OFFER_MINER_MCP_TOKEN),
        MCP_PUBLIC_URL: Boolean(process.env.MCP_PUBLIC_URL),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
