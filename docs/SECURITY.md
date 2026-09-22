# Offer Miner — Security Policy & Hardening Specification

**Status:** P0 Security Hardening Enforced  
**Classification:** Private SaaS System  
**Last Updated:** September 2026

---

## 1. Executive Summary

Offer Miner is an enterprise-grade private SaaS platform. The system operates on a **Defense-in-Depth** model:
`Public Internet → Login → Supabase Auth → Session → Authorized User → Workspace / Role Check → Offer Miner → RLS → Supabase Cloud`.

Frontend visibility controls are treated strictly as presentation layers; true security boundaries are validated at edge middleware, server-side route handlers, and database Row Level Security (RLS).

---

## 2. Route Matrix

### 2.1 Public Routes (Strict Allowlist)
Only the following routes are accessible without an active authenticated session:
- `/login`: Hardened authentication entrance (public signup disabled; generic error responses).
- `/auth/callback`: Supabase Auth PKCE code exchange endpoint.
- `/unauthorized`: Error state for authenticated identities lacking workspace membership.
- `/.well-known/oauth-protected-resource`: OAuth 2.1 discovery endpoint for MCP clients.
- `/oauth/*`: OAuth consent and token authorization flows.
- `/api/mcp` and `/api/mcp/*`: Machine-to-machine MCP server endpoints protected by OAuth 2.1 Bearer tokens (with fallback to legacy internal secret token).

### 2.2 Protected SaaS Routes (Require Auth & Workspace Membership)
All other routes require an active session and workspace membership. Unauthenticated requests are immediately redirected to `/login?next=...` (pages) or rejected with `401 Unauthorized` (APIs):
- `/` (Server redirect: authenticated → `/dashboard`, unauthenticated → `/login`)
- `/dashboard`
- `/offers` & `/offers/*`
- `/mapping`
- `/imports`
- `/radar`
- `/intelligence` & `/intelligence/*`
- `/office` & `/office/*`
- `/knowledge` & `/knowledge/*`
- `/deep-dives` & `/deep-dives/*`
- `/favorites`
- `/compare`
- `/tracking`
- `/settings` (Restricted to `OWNER` / `ADMIN`)
- `/api/*` (Except public OAuth/MCP endpoints)

---

## 3. Identity, Roles & Workspaces

### 3.1 Tenancy Architecture
Every private entity in the system is scoped to a `workspace_id`.
- Initial Canonical Workspace: `ws_default_001` ("Offer Miner Principal").
- All existing records (offers, ads, creatives, landing pages, checkouts, mapping batches, deep dives, knowledge) are backfilled to this workspace.

### 3.2 Hierarchical Roles
1. **OWNER**: Full administrative control, destruction privileges, member management, token exposure.
2. **ADMIN**: Read, write, and pipeline management; cannot transfer workspace ownership.
3. **MEMBER**: Standard operational access (offers analysis, mapping, deep dives).
4. **VIEWER**: Strictly read-only access.

### 3.3 Authorization Helpers
All server routes and actions rely on centralized helpers:
- `requireUser()`: Asserts valid Supabase Auth session (`401` on failure).
- `requireWorkspace()`: Validates workspace membership (`403` on failure). Never trusts client-supplied `workspace_id`.
- `requireRole(['OWNER', 'ADMIN'])`: Enforces privilege level (`403` on failure).

---

## 4. Row Level Security (RLS) Strategy

- **Default State**: Enabled on all private database tables.
- **Forbidden**: `USING (true)` or `WITH CHECK (true)` on private domain data.
- **Tenant Isolation Policy**:
  ```sql
  CREATE POLICY "workspace_isolation_select" ON public.offers
    FOR SELECT
    USING (
      public.is_workspace_member(workspace_id)
    );
  ```
- **Privilege Separation**: Mutations (INSERT/UPDATE/DELETE) require valid membership and appropriate role permissions checked via `public.get_user_workspace_role(workspace_id)`.
- **Direct Database Bypass Defense**: Even if an attacker obtains the `anon` public key, RLS drops unauthenticated rows down to 0 rows.

---

## 5. Model Context Protocol (MCP) & ChatGPT Work Integration

- **Channel Separation**: Human SaaS sessions and machine MCP sessions operate independently.
- **Protocol**: Model Context Protocol over SSE / JSON-RPC, secured by OAuth 2.1 PKCE.
- **Protected Resource Discovery**: Unauthenticated calls to `/api/mcp` receive `401 Unauthorized` with `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="..."`.
- **Tool Integrity**: Critical read-only discovery tools (`search_offers`, `check_offers_duplicates`) remain exposed and functional for verified OAuth tokens. ChatGPT Work client is unaffected by browser login requirements.

---

## 6. Secret Management Policy

- **Client Bundle Isolation**:
  - Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be prefixed with `NEXT_PUBLIC_`.
  - `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only. It must **never** be referenced in client code, sent in props, or serialized into client JSON.
  - LLM Provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) and MCP authorization tokens are strictly server-only.
- **Audit Requirement**: Automated scanning (`npm run security:audit`) halts builds if any private secret pattern is detected with a client prefix.

---

## 7. Storage Security Policy

- **Bucket Access**: Storage buckets containing offer assets (creatives, raw video, screenshots, landing page archives, intelligence PDFs) are private.
- **Public URL Prohibition**: Raw permanent public URLs are prohibited for private assets.
- **Secure Access Pattern**: Assets are accessed exclusively via short-lived signed URLs generated on the server after verifying the user's workspace membership.

---

## 8. SSRF (Server-Side Request Forgery) Defense

The application provides URL scraping, landing page resolution, and creative ingestion. All outbound HTTP requests must pass through `validateSafeOutboundUrl()`:
- **Disallowed Schemes**: Any scheme other than `http:` or `https:`.
- **Blocked IP Targets**:
  - Loopback (`127.0.0.1`, `localhost`, `::1`).
  - RFC 1918 Private Ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Cloud Metadata Services (`169.254.169.254`).
  - Link-Local and Carrier-Grade NAT (`100.64.0.0/10`).
- **Redirects**: Downstream redirect destinations must be validated against the same policy before following.

---

## 9. Security Headers & Browser Hardening

Configured at edge middleware:
- **Content-Security-Policy (CSP)**: Restricts script execution, fonts, connections, and frame sources.
- **X-Frame-Options / frame-ancestors**: Set to `DENY` to prevent clickjacking attacks by external domains embedding the SaaS. (Does not affect internal sandbox iframe previews).
- **X-Content-Type-Options**: `nosniff`.
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Permissions-Policy**: Restricts camera, microphone, and geolocation APIs.
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains; preload`.

---

## 10. Audit Logging

High-risk events trigger security audit entries via `logSecurityAudit()`:
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- `MFA_ENABLED`, `MFA_DISABLED`
- `OFFER_DELETED`, `OFFER_BULK_DELETE`
- `IMPORT_STARTED`, `IMPORT_FINISHED`
- `MAPPING_STARTED`, `SETTINGS_CHANGED`
- `API_DENIED`, `MCP_AUTH`, `MCP_DENIED`

Audit logs record `user_id`, `workspace_id`, `ip_hash`, `timestamp`, and sanitized action context. Passwords, JWTs, and keys are strictly excluded.
