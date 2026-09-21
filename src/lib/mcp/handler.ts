import { MCP_TOOLS, executeMcpTool } from './tools';
import { logMcpRequest, SERVER_INFO } from './config';

export interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Handle standard JSON-RPC 2.0 requests for MCP
 */
export async function handleMcpRequest(
  reqBody: JsonRpcRequest,
  origin: 'local' | 'remote' = 'local'
): Promise<JsonRpcResponse> {
  const startTime = Date.now();
  const id = reqBody.id ?? null;
  const method = reqBody.method;

  if (reqBody.jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
    };
  }

  try {
    switch (method) {
      case 'initialize': {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: SERVER_INFO,
          instructions:
            'Offer Miner Canonical AI Tool Layer for Market Intelligence, Creative Disassembly, and Real-Time Offer Deduplication.',
        };
        logMcpRequest('initialize', Date.now() - startTime, true, undefined, origin);
        return { jsonrpc: '2.0', id, result };
      }

      case 'notifications/initialized': {
        // Notification, no result required
        return { jsonrpc: '2.0', id, result: {} };
      }

      case 'ping': {
        return { jsonrpc: '2.0', id, result: {} };
      }

      case 'tools/list': {
        const toolsList = MCP_TOOLS.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          securitySchemes: [
            {
              type: 'oauth2',
              scopes: ['openid', 'email', 'profile'],
            },
          ],
          security: [
            {
              oauth2: ['openid', 'email', 'profile'],
            },
          ],
        }));
        logMcpRequest('tools/list', Date.now() - startTime, true, undefined, origin);
        return { jsonrpc: '2.0', id, result: { tools: toolsList } };
      }

      case 'tools/call': {
        const { name, arguments: toolArgs } = reqBody.params || {};
        if (!name || typeof name !== 'string') {
          logMcpRequest('tools/call:missing_name', Date.now() - startTime, false, 'Missing tool name', origin);
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: tool name is required' },
          };
        }

        try {
          const toolResult = await executeMcpTool(name, toolArgs || {});
          logMcpRequest(name, Date.now() - startTime, true, undefined, origin);

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2),
                },
              ],
              isError: false,
            },
          };
        } catch (toolError: any) {
          logMcpRequest(name, Date.now() - startTime, false, toolError.message, origin);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: toolError.message, code: toolError.code || 'TOOL_ERROR' }),
                },
              ],
              isError: true,
            },
          };
        }
      }

      default: {
        logMcpRequest(method, Date.now() - startTime, false, 'Method not found', origin);
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
    }
  } catch (err: any) {
    logMcpRequest(method || 'unknown', Date.now() - startTime, false, err.message, origin);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: `Internal error: ${err.message}` },
    };
  }
}
