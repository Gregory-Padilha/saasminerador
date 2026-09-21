import { OFFICE_ROLES } from './roles/registry';
import { getOfficeModelForRole, OfficeProfileId } from './models';
import { OfficeCaseFile, buildAgentContextSlice, reduceDeliverableIntoCaseFile } from './case-file';
import { recordAgentRunInCostTracker, MissionCostSummary } from './cost-tracker';
import { officeDbService } from '@/lib/supabase/office-db';
import { getCoreDoctrine } from '../ai-brain/doctrine';
import { MissionContract, ModelingTransformationContract } from './contracts';
import { SourceOfferContextPack } from './source-pack';
import { SPECIALIZED_ROLE_PROMPTS } from './role-prompts';

export interface AgentExecutionResult {
  roleId: string;
  roleTitle: string;
  department: string;
  status: 'APPROVED' | 'REVISION_REQUESTED' | 'FAILED';
  findings: any;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export async function executeAgentRole(
  missionId: string,
  roleId: string,
  profileId: OfficeProfileId,
  caseFile: OfficeCaseFile,
  costTracker: MissionCostSummary,
  missionContract: MissionContract,
  transContract: ModelingTransformationContract | null,
  sourcePack: SourceOfferContextPack | null,
  customInstructions?: string
): Promise<{ result: AgentExecutionResult; updatedCostTracker: MissionCostSummary; updatedCaseFile: OfficeCaseFile }> {
  const startTime = Date.now();
  const roleDef = OFFICE_ROLES[roleId];
  if (!roleDef) {
    throw new Error(`Role não encontrada no repositório: ${roleId}`);
  }

  const isDeep = missionContract.depth === 'PROFUNDO';
  const maxOutputTokens = isDeep ? 8192 : 4096;

  const modelTarget = getOfficeModelForRole(profileId, roleDef.level, missionContract.depth, roleId);
  const contextSlice = buildAgentContextSlice(caseFile, roleId);
  const coreDoctrine = getCoreDoctrine();
  const specializedSpec = SPECIALIZED_ROLE_PROMPTS[roleId];

  // Assemble explicit Mission & Transformation Context
  const contractBlock = `
=== MISSION CONTRACT (AUTORIDADE DA MISSÃO - REGRA INVIOLÁVEL) ===
Modo de Missão: ${missionContract.missionType}
Objetivo: "${missionContract.objective}"
Mercado Alvo: ${missionContract.targetMarket} (Moeda: ${missionContract.targetCurrency})
Profundidade Requisitada: ${missionContract.depth}
Faceless: ${missionContract.facelessPreference}
Formatos Permitidos: ${missionContract.preferredFormats.join(', ') || 'Indiferente'}
Formatos Excluídos: ${missionContract.excludedFormats.join(', ') || 'Nenhum'}
Complexidade de Produção: ${missionContract.productionComplexity}
Ticket Option: ${missionContract.ticketOption}
Prioridades da Busca: ${missionContract.priorities.join(', ')}
Restrições Adicionais: ${missionContract.constraints || 'Nenhuma'}

${
  transContract
    ? `
=== MODELING TRANSFORMATION CONTRACT (CONTRATO DE MODELAGEM - MÁXIMO ${transContract.maximumChanges} MUDANÇAS ESTRATÉGICAS) ===
Oferta Base (Source): ${sourcePack?.productName || transContract.sourceOfferId}
Máximo de Transformações Estratégicas Permitidas: ${transContract.maximumChanges} no máximo.
Dimensões Permitidas para Mudança: ${transContract.allowedDimensions.join(', ')}
Dimensões Bloqueadas (MANTER DA OFERTA ORIGINAL): ${transContract.lockedDimensions.join(', ')}
⚠️ ATENÇÃO: NÃO transforme o produto ou nicho se a dimensão estiver BLOQUEADA. Mantenha a coerência exata com "${sourcePack?.productName || 'Oferta Base'}".
`
    : ''
}

${
  sourcePack && sourcePack.isAvailable
    ? `
=== DADOS REAIS DA OFERTA PRINCIPAL (SOURCE OFFER CONTEXT PACK) ===
ID da Oferta: ${sourcePack.offerId}
Nome da Oferta Original: "${sourcePack.productName}"
Anunciante: "${sourcePack.advertiser}"
Nicho: "${sourcePack.niche}" (Subniche: ${sourcePack.subniche || 'N/I'})
Anúncios Ativos: ${sourcePack.activeAdsCount} ads
Dias Rodando: ${sourcePack.daysRunning} dias
Preço da Oferta Original: ${sourcePack.priceFormatted}
Promessa / Headline Original: "${sourcePack.promiseSummary}"
Landing Page Original: ${sourcePack.landingPageUrl || 'Não mapeada'}
Checkout Original: ${sourcePack.checkoutUrl || 'Não mapeado'}
`
    : '=== OFERTA PRINCIPAL: Nenhuma oferta prévia fixada (Criação do Zero) ==='
}
`;

  const systemPrompt = `
=== OFFER MINER BRAIN - OFFICE ROLE: ${roleDef.title.toUpperCase()} ===
Você é o ${roleDef.name} (${roleDef.title}) no Escritório de Inteligência de Ofertas.

=== DOUTRINA BASE E REGRAS DA OPERAÇÃO ===
${coreDoctrine}

=== DESCRIÇÃO DO SEU CARGO ===
${roleDef.description}

${specializedSpec ? `=== SUAS INSTRUÇÕES ESPECÍFICAS DE CARGO ===\n${specializedSpec.specializedSystemInstruction}` : ''}

=== SUAS INSTRUÇÕES CRÍTICAS DE ATUAÇÃO ===
1. Responda ESTRITAMENTE em formato JSON com estrutura válida.
2. Doutrina Central: MODELAGEM != CLONAGEM. Preserve a essência comercial, mas crie nova tese sem plagiar.
3. RESPEITE O MISSION CONTRACT E O TRANSFORMATION CONTRACT:
   - Se o mercado alvo é "Estados Unidos", NUNCA retorne preços em R$ ou textos em Português como entregáveis finais.
   - Se a oferta original é "${sourcePack?.productName || 'Oferta Culinária'}" e o produto está bloqueado, NUNCA transforme receitas em cursos de canva, atividades infantis ou planners genéricos!
4. NUNCA USE PHRASES GENÉRICAS COMO:
   - "Pessoas com necessidade urgente de solução prática"
   - "Resolver o problema sem enrolação"
   - "Método das 3 etapas"
   - "Fichário digital interativo"
   Seja PROFUNDAMENTE ESPECÍFICO ao nicho e ao avatar real.
5. Adicione justificativa e evidências para cada conclusão.
`;

  const userPrompt = `
${contractBlock}

${contextSlice}

Instruções Específicas do Cargo para a Fase Atual:
${customInstructions || 'Execute suas análises de acordo com as responsabilidades do seu cargo e retorne suas conclusões.'}

${
  specializedSpec
    ? specializedSpec.expectedJsonSchemaPrompt
    : `
Retorne um objeto JSON válido no seguinte formato:
{
  "summary": "Resumo analítico profundo e específico ao contexto da oferta",
  "findings": [],
  "evidenceRefs": [],
  "hypotheses": [],
  "contradictions": [],
  "risks": [],
  "recommendations": []
}
`
}
`;

  let responseText = '';
  let inputTokens = 1500;
  let outputTokens = 1000;

  try {
    if (modelTarget.provider === 'openai' && process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelTarget.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: maxOutputTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content || '{}';
        inputTokens = data.usage?.prompt_tokens || inputTokens;
        outputTokens = data.usage?.completion_tokens || outputTokens;
      }
    } else if (modelTarget.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelTarget.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: maxOutputTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        responseText = data.content?.[0]?.text || '{}';
        inputTokens = data.usage?.input_tokens || inputTokens;
        outputTokens = data.usage?.output_tokens || outputTokens;
      }
    } else if (process.env.GEMINI_API_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelTarget.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        inputTokens = data.usageMetadata?.promptTokenCount || inputTokens;
        outputTokens = data.usageMetadata?.candidatesTokenCount || outputTokens;
      }
    }
  } catch (err) {
    console.error(`Error executing role ${roleId}:`, err);
  }

  // Parse structured findings JSON or construct error status
  let parsedFindings: any = {};
  let isValidOutput = true;

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedFindings = JSON.parse(jsonMatch[0]);
    } else if (responseText.trim().startsWith('{')) {
      parsedFindings = JSON.parse(responseText);
    } else {
      parsedFindings = { summary: responseText };
    }
  } catch {
    isValidOutput = false;
    parsedFindings = {
      summary: 'Não foi possível interpretar a entrega deste agente em formato JSON.',
      rawOutput: responseText.substring(0, 500),
    };

    await officeDbService.recordOfficeEvent({
      id: `ev_invalid_${Date.now()}`,
      missionId,
      type: 'AGENT_FAILED',
      agentRole: roleId,
      department: roleDef.department as any,
      message: `PROVIDER_ERROR: Saída do agente ${roleDef.title} fora do schema esperado.`,
      timestamp: new Date().toISOString(),
    });
  }

  const durationMs = Date.now() - startTime;
  const updatedCostTracker = recordAgentRunInCostTracker(costTracker, {
    agentRole: roleId,
    department: roleDef.department,
    provider: modelTarget.provider,
    model: modelTarget.model,
    inputTokens,
    outputTokens,
    cachedInputTokens: Math.floor(inputTokens * 0.4),
    toolCallsCount: 1,
    durationMs,
  });

  const runCost = updatedCostTracker.agentRunRecords[updatedCostTracker.agentRunRecords.length - 1]?.estimatedCostUsd || 0;
  const runStatus = isValidOutput ? 'APPROVED' : 'FAILED';

  // Reduce deliverable findings directly into Case File (Evidences & Decision Ledger)
  const updatedCaseFile = reduceDeliverableIntoCaseFile(caseFile, roleId, parsedFindings);

  const result: AgentExecutionResult = {
    roleId,
    roleTitle: roleDef.title,
    department: roleDef.department,
    status: runStatus,
    findings: parsedFindings,
    inputTokens,
    outputTokens,
    costUsd: runCost,
    durationMs,
  };

  // Record Agent Run in DB
  await officeDbService.recordAgentRun({
    id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    missionId,
    agentRole: roleId,
    agentTitle: roleDef.title,
    department: roleDef.department,
    status: runStatus,
    inputSummary: customInstructions || 'Análise de caso',
    outputFindings: parsedFindings,
    durationMs,
    inputTokens,
    outputTokens,
    costUsd: runCost,
    createdAt: new Date().toISOString(),
  });

  // Emit Office Event for Live & Replay Office
  await officeDbService.recordOfficeEvent({
    id: `ev_sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    missionId,
    type: 'DELIVERABLE_SUBMITTED',
    agentRole: roleId,
    department: roleDef.department as any,
    message: `${roleDef.title} concluiu a análise e submeteu os entregáveis do departamento.`,
    timestamp: new Date().toISOString(),
  });

  return { result, updatedCostTracker, updatedCaseFile };
}
