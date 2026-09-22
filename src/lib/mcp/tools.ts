import { AI_TOOLS_LIST, executeAiTool, getAiToolByName } from '@/lib/ai-tools/registry';

export const MCP_TOOLS_DEFINITIONS = AI_TOOLS_LIST.map((tool) => ({
  name: tool.name,
  title: tool.title || tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  outputSchema: tool.outputSchema,
  annotations: tool.annotations,
  _meta: tool._meta,
}));

export const MCP_TOOLS = MCP_TOOLS_DEFINITIONS;

/**
 * Executes an MCP tool by delegating directly to the shared AI Tool Layer
 */
export async function executeMcpTool(name: string, rawArgs: Record<string, any>): Promise<any> {
  return await executeAiTool(name, rawArgs);
}
