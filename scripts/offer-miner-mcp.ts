#!/usr/bin/env tsx

/**
 * Offer Miner MCP STDIO Bridge
 * Enables local stdin/stdout JSON-RPC 2.0 communication for Cursor, Claude Desktop, Gemini CLI and local IDEs.
 */

import readline from 'readline';
import { handleMcpRequest } from '../src/lib/mcp/handler';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const jsonReq = JSON.parse(trimmed);
    const response = await handleMcpRequest(jsonReq, 'local');
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (err: any) {
    const errResponse = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error / invalid JSON: ${err.message}` },
    };
    process.stdout.write(JSON.stringify(errResponse) + '\n');
  }
});
