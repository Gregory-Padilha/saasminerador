import { MiningPromptConfig } from './mining-prompt-types';

export const MINING_PROMPT_MODEL = process.env.MINING_PROMPT_MODEL || 'claude-sonnet-5';

export interface PromptArchitectResult {
  configured: boolean;
  finalPrompt: string;
  warnings: string[];
  changesSummary: string[];
  model: string;
  stats?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

export async function refineMiningPromptWithClaude(
  config: MiningPromptConfig,
  compiledBasePrompt: string
): Promise<PromptArchitectResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      finalPrompt: compiledBasePrompt,
      warnings: ['Refinamento Claude indisponível: Chave ANTHROPIC_API_KEY não configurada no ambiente.'],
      changesSummary: ['Mantido o prompt compilado deterministicamente (Camada 1).'],
      model: MINING_PROMPT_MODEL,
    };
  }

  const systemPrompt = `Você é um Arquiteto de Prompts especialista em design de instruções para agentes de IA operacionais, fluxos de mineração de ofertas Meta Ads, coleta de dados estruturados e eficiência de tokens.

SUA MISSÃO:
Receber a configuração de mineração do usuário e o PROMPT BASE COMPILADO, e realizar UMA REVISÃO ESTRUTURAL DE ALTA QUALIDADE.

REGRAS RÍGIDAS DE AUDITORIA:
1. NÃO altere o objetivo do usuário ou o número alvo de ofertas.
2. NÃO altere os valores numéricos dos filtros rígidos (ex: min/max anúncios, min/max dias, preços).
3. NÃO invente restrições que o usuário não solicitou, nem remova proibições do usuário.
4. REFORCE o conceito de OFFER UNIT vs. ADVERTISER (um anunciante com 3 produtos = 3 ofertas separadas, nunca somar anúncios de produtos diferentes).
5. REFORCE a regra de URLs reais (Meta Ads URL com context ID da página; Landing Page vinda do CTA real; nunca inventar URLs).
6. REFORCE o STOP CONDITION imediato ao atingir a quantidade alvo.
7. Torne os passos executáveis inequívocos e elimine redundâncias narrativas para economizar tokens.

SUA RESPOSTA DEVE SER ESTRITAMENTE UM JSON COM AS SEGUINTES CHAVES:
{
  "finalPrompt": "texto completo em Markdown do prompt otimizado",
  "warnings": ["lista de alertas ou contradições detectadas se houver"],
  "changesSummary": ["lista de 2 a 5 melhorias estruturais realizadas"]
}`;

  const userContent = `CONFIGURAÇÃO DA MINERAÇÃO:
${JSON.stringify(config, null, 2)}

PROMPT BASE COMPILADO (CAMADA 1):
${compiledBasePrompt}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MINING_PROMPT_MODEL === 'claude-sonnet-5' ? 'claude-3-5-sonnet-20241022' : MINING_PROMPT_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API prompt refine error:', errText);
      return {
        configured: true,
        finalPrompt: compiledBasePrompt,
        warnings: [`Erro na API da Anthropic (${response.status}): utilizando prompt base.`],
        changesSummary: ['Fallback para prompt compilado deterministicamente.'],
        model: MINING_PROMPT_MODEL,
      };
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse JSON output from Claude
    let jsonStart = rawText.indexOf('{');
    let jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      // Sonnet 3.5 pricing: $3 / 1M input, $15 / 1M output
      const costUsd = (inputTokens * 3 + outputTokens * 15) / 1000000;

      return {
        configured: true,
        finalPrompt: parsed.finalPrompt || compiledBasePrompt,
        warnings: parsed.warnings || [],
        changesSummary: parsed.changesSummary || ['Prompt revisado e otimizado pelo Claude Sonnet 5.'],
        model: MINING_PROMPT_MODEL,
        stats: {
          inputTokens,
          outputTokens,
          costUsd,
        },
      };
    }

    return {
      configured: true,
      finalPrompt: rawText || compiledBasePrompt,
      warnings: ['Resposta do Claude não foi formatada em JSON estrito.'],
      changesSummary: ['Prompt atualizado via Claude.'],
      model: MINING_PROMPT_MODEL,
    };
  } catch (err: any) {
    console.error('Error refining prompt with Claude:', err);
    return {
      configured: false,
      finalPrompt: compiledBasePrompt,
      warnings: [`Erro ao conectar com Claude: ${err.message}`],
      changesSummary: ['Mantido prompt compilado base.'],
      model: MINING_PROMPT_MODEL,
    };
  }
}
