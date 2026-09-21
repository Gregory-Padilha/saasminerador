export type AiToolErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'LIMIT_EXCEEDED'
  | 'DATA_NOT_MAPPED'
  | 'INTERNAL_ERROR';

export class AiToolError extends Error {
  code: AiToolErrorCode;
  constructor(code: AiToolErrorCode, message: string) {
    super(message);
    this.name = 'AiToolError';
    this.code = code;
  }
}

export interface AiToolContract {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>) => Promise<any>;
}

export type McpAuthMode = 'token' | 'oauth' | 'hybrid';

export interface AiGatewayAuthResult {
  valid: boolean;
  reason?: string;
  authMode: McpAuthMode;
  authMethod?: 'static_token' | 'oauth_token' | 'none';
  userId?: string | null;
  email?: string | null;
  wwwAuthenticateHeader?: string;
}

export interface AiGatewayConfig {
  version: string;
  enabled: boolean;
  authMode: McpAuthMode;
  tokenConfigured: boolean;
  localUrl: string;
  publicUrl: string | null;
  remoteValid: boolean;
  toolsCount: number;
}
