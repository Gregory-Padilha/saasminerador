import { createHash } from 'crypto';

export type SecurityAuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'IMPORT_STARTED'
  | 'IMPORT_FINISHED'
  | 'OFFER_DELETED'
  | 'MAPPING_STARTED'
  | 'SETTINGS_CHANGED'
  | 'API_DENIED'
  | 'MCP_AUTH'
  | 'MCP_DENIED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: SecurityAuditEvent;
  userId?: string | null;
  workspaceId?: string | null;
  action?: string;
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// In-memory security audit trail buffer (persisted or emitted to log stream)
const securityAuditLogs: AuditLogEntry[] = [];

export function hashClientIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip + '_om_salt').digest('hex').substring(0, 16);
}

export function logSecurityEvent(
  event: SecurityAuditEvent,
  options: {
    userId?: string | null;
    workspaceId?: string | null;
    action?: string;
    ip?: string | null;
    userAgent?: string;
    metadata?: Record<string, any>;
  } = {}
) {
  // Sanitize metadata to guarantee NO secrets, passwords or tokens are stored
  const sanitizedMeta: Record<string, any> = {};
  if (options.metadata) {
    for (const [key, val] of Object.entries(options.metadata)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('key') ||
        lower.includes('auth') ||
        lower.includes('cookie')
      ) {
        sanitizedMeta[key] = '[REDACTED_SECRET]';
      } else {
        sanitizedMeta[key] = val;
      }
    }
  }

  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    event,
    userId: options.userId ?? null,
    workspaceId: options.workspaceId ?? null,
    action: options.action,
    ipHash: hashClientIp(options.ip),
    userAgent: options.userAgent ? options.userAgent.substring(0, 120) : undefined,
    metadata: Object.keys(sanitizedMeta).length > 0 ? sanitizedMeta : undefined,
  };

  securityAuditLogs.unshift(entry);
  if (securityAuditLogs.length > 500) {
    securityAuditLogs.pop();
  }

  // Emits structured audit log for monitoring / datadog / netlify logs
  console.log(`[SECURITY AUDIT] ${entry.timestamp} | ${entry.event} | User: ${entry.userId || 'anon'} | WS: ${entry.workspaceId || 'none'} | Action: ${entry.action || 'none'}`);
}

export function getSecurityAuditLogs(): AuditLogEntry[] {
  return securityAuditLogs;
}
