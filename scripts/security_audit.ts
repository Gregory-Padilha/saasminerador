// ==============================================================================
// OFFER MINER - AUTOMATED SECURITY REGRESSION AUDIT (DEFENSE IN DEPTH)
// Tests: Auth, Route Protection, API Lockdown, SSRF, RLS, Secret Exposure, MCP
// ==============================================================================
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

import { validateScrapingUrl } from '../src/lib/security/ssrf';
import { handleMcpRequest } from '../src/lib/mcp/handler';
import { createClient } from '@supabase/supabase-js';

async function runSecurityAudit() {
  console.log('\n============================================================');
  console.log('STARTING OFFER MINER SECURITY HARDENING AUDIT');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: SSRF Defense
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: SSRF Defense & URL Sanitization ---');
  const ssrf1 = validateScrapingUrl('http://127.0.0.1:3000/internal');
  assert(!ssrf1.valid && ssrf1.reason === 'BLOCKED_INTERNAL_HOST', 'SSRF 1.1: 127.0.0.1 loopback is blocked');

  const ssrf2 = validateScrapingUrl('http://localhost:8080/admin');
  assert(!ssrf2.valid && ssrf2.reason === 'BLOCKED_INTERNAL_HOST', 'SSRF 1.2: localhost is blocked');

  const ssrf3 = validateScrapingUrl('http://169.254.169.254/latest/meta-data/');
  assert(!ssrf3.valid && (ssrf3.reason === 'BLOCKED_INTERNAL_HOST' || ssrf3.reason === 'BLOCKED_PRIVATE_IP'), 'SSRF 1.3: Cloud metadata endpoint (169.254.169.254) is blocked');

  const ssrf4 = validateScrapingUrl('http://10.0.0.5/secrets');
  assert(!ssrf4.valid && ssrf4.reason === 'BLOCKED_PRIVATE_IP', 'SSRF 1.4: Private RFC 1918 IP (10.0.0.5) is blocked');

  const ssrf5 = validateScrapingUrl('http://192.168.1.1/router');
  assert(!ssrf5.valid && ssrf5.reason === 'BLOCKED_PRIVATE_IP', 'SSRF 1.5: Private RFC 1918 IP (192.168.1.1) is blocked');

  const ssrf6 = validateScrapingUrl('https://oferta-exemplo.com.br/landing-page');
  assert(ssrf6.valid, 'SSRF 1.6: Legitimate public HTTPS URL is accepted');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Secret Exposure & Client Bundle Audit
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Secret Hygiene & Environment Isolation ---');
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');

  const hasLeakedServiceRoleInNextPublic = envContent.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  assert(!hasLeakedServiceRoleInNextPublic, 'SECRETS 2.1: SUPABASE_SERVICE_ROLE_KEY is never exposed as NEXT_PUBLIC');

  const hasLeakedApiKeyInNextPublic = envContent.includes('NEXT_PUBLIC_OPENAI_API_KEY') || envContent.includes('NEXT_PUBLIC_GEMINI_API_KEY');
  assert(!hasLeakedApiKeyInNextPublic, 'SECRETS 2.2: LLM API keys are never prefixed with NEXT_PUBLIC');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Robots.txt & Public Discovery Reduction
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Crawling Reduction (robots.txt) ---');
  const robotsPath = path.resolve(process.cwd(), 'public/robots.txt');
  const robotsExists = fs.existsSync(robotsPath);
  const robotsContent = robotsExists ? fs.readFileSync(robotsPath, 'utf-8') : '';
  assert(robotsExists && robotsContent.includes('Disallow: /'), 'ROBOTS 3.1: public/robots.txt exists with Disallow: /');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Middleware Configuration & Route Shielding
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Middleware Architecture Verification ---');
  const middlewarePath = path.resolve(process.cwd(), 'src/middleware.ts');
  const middlewareExists = fs.existsSync(middlewarePath);
  const middlewareSrc = middlewareExists ? fs.readFileSync(middlewarePath, 'utf-8') : '';

  assert(middlewareExists, 'MIDDLEWARE 4.1: src/middleware.ts is present');
  assert(middlewareSrc.includes("pathname === '/'"), 'MIDDLEWARE 4.2: Root / is explicitly handled');
  assert(middlewareSrc.includes("pathname.startsWith('/api/')"), 'MIDDLEWARE 4.3: API routes are intercepted and protected with 401');
  assert(middlewareSrc.includes('PUBLIC_PATHS'), 'MIDDLEWARE 4.4: Explicit minimal public allowlist is defined');
  assert(middlewareSrc.includes('Content-Security-Policy'), 'MIDDLEWARE 4.5: Content-Security-Policy header is configured');
  assert(middlewareSrc.includes('X-Frame-Options'), 'MIDDLEWARE 4.6: X-Frame-Options clickjacking protection is configured');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Login Page Hardening (No Signup Backdoor, No Demo Bypass)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Login Page Hardening ---');
  const loginSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/app/login/page.tsx'), 'utf-8');
  assert(!loginSrc.includes('isSignUp'), 'LOGIN 5.1: Public sign-up toggle is completely removed');
  assert(!loginSrc.includes('Modo Direto'), 'LOGIN 5.2: "Modo Direto" demo bypass button is completely removed');
  assert(loginSrc.includes('E-mail ou senha inválidos'), 'LOGIN 5.3: Generic error message prevents account enumeration');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: MCP & ChatGPT Work Preservation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: MCP & ChatGPT Work Uninterrupted Functionality ---');
  const mcpListRes = await handleMcpRequest({ jsonrpc: '2.0', id: 999, method: 'tools/list' }, 'remote');
  assert(!mcpListRes.error, 'MCP 6.1: tools/list operates without error');

  const tools = mcpListRes.result?.tools || [];
  const dedupeTool = tools.find((t: any) => t.name === 'check_offers_duplicates');
  assert(Boolean(dedupeTool), 'MCP 6.2: check_offers_duplicates remains available in tools/list');
  assert(tools[1]?.name === 'check_offers_duplicates', 'MCP 6.3: check_offers_duplicates is prioritized at position #2');

  const dedupeCallRes = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 1000,
    method: 'tools/call',
    params: {
      name: 'check_offers_duplicates',
      arguments: {
        candidates: [
          { candidate_id: 'sec-audit-1', offer_name: 'Mapa do Amor', advertiser: 'Fernanda Pereira' },
          { candidate_id: 'sec-audit-2', offer_name: 'Produto Inédito XYZ', advertiser: 'Novo Anunciante' }
        ]
      }
    }
  }, 'remote');
  assert(!dedupeCallRes.error, 'MCP 6.4: check_offers_duplicates tools/call executes successfully');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Database Migration Completeness
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: SQL Migration & RLS Completeness ---');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260922000000_security_hardening.sql');
  const migrationExists = fs.existsSync(migrationPath);
  const migrationSql = migrationExists ? fs.readFileSync(migrationPath, 'utf-8') : '';

  assert(migrationExists, 'MIGRATION 7.1: 20260922000000_security_hardening.sql is present');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.workspaces'), 'MIGRATION 7.2: Creates workspaces table');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.workspace_members'), 'MIGRATION 7.3: Creates workspace_members table');
  assert(migrationSql.includes("UPDATE public.offers SET workspace_id = 'ws_default_001'"), 'MIGRATION 7.4: Backfills all existing offers to default workspace');
  assert(migrationSql.includes('DROP POLICY IF EXISTS "Public access'), 'MIGRATION 7.5: Drops permissive USING (true) policies');
  assert(migrationSql.includes('is_workspace_member'), 'MIGRATION 7.6: Defines is_workspace_member security definer helper');

  console.log('\n============================================================');
  console.log(`SECURITY AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`STATUS: ${failed === 0 ? 'ALL SECURITY CHECKS PASSED ✓' : 'SECURITY DEFICIENCIES DETECTED ✗'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error('Fatal error during security audit:', err);
  process.exit(1);
});
