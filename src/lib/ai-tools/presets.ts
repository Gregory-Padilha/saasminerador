export type ClientPresetId = 'gemini' | 'antigravity' | 'cursor' | 'claude' | 'generic' | 'rest';
export type TransportType = 'http' | 'stdio' | 'rest';
export type EnvironmentMode = 'local' | 'remote';

export interface ClientPresetMeta {
  id: ClientPresetId;
  name: string;
  badge: string;
  description: string;
  supportsHttp: boolean;
  supportsStdio: boolean;
  supportsRest: boolean;
  iconName: string;
}

export const CLIENT_PRESETS: ClientPresetMeta[] = [
  {
    id: 'gemini',
    name: 'Gemini & Gemini CLI',
    badge: 'Google AI',
    description: 'Conecte o Gemini CLI ou extensões do Gemini ao Offer Miner via MCP HTTP, stdio ou OpenAPI.',
    supportsHttp: true,
    supportsStdio: true,
    supportsRest: true,
    iconName: 'Sparkles',
  },
  {
    id: 'antigravity',
    name: 'Antigravity Agent',
    badge: 'Antigravity 2.0',
    description: 'Configuração MCP Streamable HTTP com identificador offer_miner para o agente Antigravity.',
    supportsHttp: true,
    supportsStdio: false,
    supportsRest: false,
    iconName: 'Bot',
  },
  {
    id: 'cursor',
    name: 'Cursor IDE',
    badge: 'Cursor Editor',
    description: 'Insira no arquivo mcp.json do Cursor para ativar as 15 ferramentas nativas no editor.',
    supportsHttp: true,
    supportsStdio: true,
    supportsRest: false,
    iconName: 'Terminal',
  },
  {
    id: 'claude',
    name: 'Claude Desktop & Code',
    badge: 'Anthropic',
    description: 'Configuração para claude_desktop_config.json ou Claude Code CLI.',
    supportsHttp: true,
    supportsStdio: true,
    supportsRest: false,
    iconName: 'Cpu',
  },
  {
    id: 'generic',
    name: 'MCP Genérico (JSON-RPC)',
    badge: 'Universal MCP',
    description: 'Configuração JSON-RPC 2.0 padrão para qualquer cliente ou IDE compatível com MCP.',
    supportsHttp: true,
    supportsStdio: true,
    supportsRest: false,
    iconName: 'Server',
  },
  {
    id: 'rest',
    name: 'REST API & OpenAPI 3.0',
    badge: 'Non-MCP Agents',
    description: 'Para agentes de IA que utilizam chamadas HTTP Function Calling ou Swagger/OpenAPI.',
    supportsHttp: false,
    supportsStdio: false,
    supportsRest: true,
    iconName: 'Globe',
  },
];

export function generateClientSnippet(
  clientId: ClientPresetId,
  mode: EnvironmentMode,
  transport: TransportType,
  localUrl: string,
  publicUrl: string | null,
  token: string
): { snippet: string; instructions: string } {
  const targetUrl = mode === 'remote' && publicUrl ? publicUrl : localUrl;
  const tokenPlaceholder = token || 'SEU_OFFER_MINER_MCP_TOKEN';

  if (clientId === 'antigravity') {
    return {
      snippet: JSON.stringify(
        {
          mcp_servers: {
            offer_miner: {
              type: 'mcp_server',
              url: targetUrl,
              headers: {
                Authorization: `Bearer ${tokenPlaceholder}`,
              },
            },
          },
        },
        null,
        2
      ),
      instructions:
        'Adicione no arquivo de configuração do Antigravity (~/.antigravity/mcp_servers.json ou mcp_config.json).',
    };
  }

  if (clientId === 'gemini') {
    if (transport === 'stdio') {
      return {
        snippet: JSON.stringify(
          {
            mcpServers: {
              'offer-miner': {
                command: 'npm',
                args: ['run', 'mcp:stdio'],
                env: {
                  OFFER_MINER_MCP_TOKEN: tokenPlaceholder,
                },
              },
            },
          },
          null,
          2
        ),
        instructions: 'Configuração para Gemini CLI via stdio local. Execute dentro da pasta do Offer Miner.',
      };
    }
    return {
      snippet: JSON.stringify(
        {
          mcpServers: {
            'offer-miner': {
              url: targetUrl,
              headers: {
                Authorization: `Bearer ${tokenPlaceholder}`,
              },
            },
          },
        },
        null,
        2
      ),
      instructions: 'Configuração para Gemini CLI ou extensões HTTP.',
    };
  }

  if (clientId === 'cursor') {
    if (transport === 'stdio') {
      return {
        snippet: JSON.stringify(
          {
            mcpServers: {
              'offer-miner': {
                command: 'npm',
                args: ['run', 'mcp:stdio'],
                env: {
                  OFFER_MINER_MCP_TOKEN: tokenPlaceholder,
                },
              },
            },
          },
          null,
          2
        ),
        instructions: 'Cole em .cursor/mcp.json ou nas Configurações de MCP do Cursor.',
      };
    }
    return {
      snippet: JSON.stringify(
        {
          mcpServers: {
            'offer-miner': {
              url: targetUrl,
              headers: {
                Authorization: `Bearer ${tokenPlaceholder}`,
              },
            },
          },
        },
        null,
        2
      ),
      instructions: 'Cole nas configurações MCP do Cursor em Features > MCP Servers.',
    };
  }

  if (clientId === 'claude') {
    if (transport === 'stdio') {
      return {
        snippet: JSON.stringify(
          {
            mcpServers: {
              'offer-miner': {
                command: 'npm',
                args: ['run', 'mcp:stdio'],
                env: {
                  OFFER_MINER_MCP_TOKEN: tokenPlaceholder,
                },
              },
            },
          },
          null,
          2
        ),
        instructions: 'Cole no arquivo claude_desktop_config.json.',
      };
    }
    return {
      snippet: JSON.stringify(
        {
          mcpServers: {
            'offer-miner': {
              url: targetUrl,
              headers: {
                Authorization: `Bearer ${tokenPlaceholder}`,
              },
            },
          },
        },
        null,
        2
      ),
      instructions: 'Cole na configuração do Claude Desktop ou Claude Code.',
    };
  }

  if (clientId === 'rest') {
    const baseUrl = targetUrl.replace(/\/api\/mcp\/?$/, '');
    return {
      snippet: `# Especificação OpenAPI 3.0:
${baseUrl}/api/ai/openapi.json

# Exemplo cURL GET (Buscar Ofertas):
curl -X GET "${baseUrl}/api/ai/offers?niche=Culinaria&limit=5" \\
  -H "Authorization: Bearer ${tokenPlaceholder}"`,
      instructions:
        'Forneça a URL do openapi.json ou os endpoints REST sob /api/ai/* para seu agente que utiliza Function Calling HTTP.',
    };
  }

  // Generic MCP
  return {
    snippet: JSON.stringify(
      {
        mcpServers: {
          'offer-miner': {
            url: targetUrl,
            headers: {
              Authorization: `Bearer ${tokenPlaceholder}`,
            },
          },
        },
      },
      null,
      2
    ),
    instructions: 'Configuração MCP JSON-RPC 2.0 genérica.',
  };
}
