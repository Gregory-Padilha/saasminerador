import * as XLSX from 'xlsx';
import { parseSpreadsheet } from '../src/lib/excel/parser';
import { normalizePrice, normalizeAdsCount, normalizeDaysRunning, normalizeFaceless, normalizeText } from '../src/lib/normalization';
import { validateOffer } from '../src/lib/validation';

async function runTests() {
  console.log('=== INICIANDO TESTES DO PIPELINE STRICT OFFER MINER ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASSOU: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FALHOU: ${message}`);
      failed++;
    }
  }

  // TESTE 1: Normalização de Preço estrita (Null vs 0)
  console.log('[TESTE 1] Normalização de Preço');
  assert(normalizePrice('R$ 27,90').value === 27.9, 'R$ 27,90 -> 27.90');
  assert(normalizePrice('27,90').value === 27.9, '27,90 -> 27.90');
  assert(normalizePrice('27.90').value === 27.9, '27.90 -> 27.90');
  assert(normalizePrice('R$27').value === 27, 'R$27 -> 27');
  assert(normalizePrice(27.9).value === 27.9, 'Number 27.9 -> 27.9');
  assert(normalizePrice('').value === null, 'String vazia -> null (NÃO 0)');
  assert(normalizePrice(null).value === null, 'null -> null (NÃO 0)');
  assert(normalizePrice(undefined).value === null, 'undefined -> null (NÃO 0)');
  assert(normalizePrice('-').value === null, 'Traço "-" -> null');

  // TESTE 2: Normalização de Ads & Dias (Null vs 0 & Rejeição de faixas ambíguas)
  console.log('\n[TESTE 2] Normalização de Anúncios Ativos e Dias');
  assert(normalizeAdsCount('18').value === 18, 'String "18" -> 18');
  assert(normalizeAdsCount('18 anúncios').value === 18, '"18 anúncios" -> 18');
  assert(normalizeAdsCount('~18').value === 18, '"~18" -> 18');
  assert(normalizeAdsCount('aprox. 18').value === 18, '"aprox. 18" -> 18');
  assert(normalizeAdsCount(18).value === 18, 'Number 18 -> 18');
  assert(normalizeAdsCount('').value === null, 'Vazio -> null (NÃO 0)');
  assert(normalizeAdsCount(null).value === null, 'null -> null (NÃO 0)');
  assert(normalizeAdsCount(0).value === 0, '0 explícito -> 0');
  assert(normalizeDaysRunning('17').value === 17, '"17" -> 17');
  assert(normalizeDaysRunning('17 dias').value === 17, '"17 dias" -> 17');
  assert(normalizeDaysRunning('10–15 dias').value === null, '"10–15 dias" -> null (com warning, não inventa número)');
  assert(normalizeDaysRunning('10 a 20 dias').value === null, '"10 a 20 dias" -> null');

  // TESTE 3: Normalização de Booleano / Faceless (3 Estados: true, false, null)
  console.log('\n[TESTE 3] Normalização de Faceless (3 Estados)');
  assert(normalizeFaceless('SIM') === true, '"SIM" -> true');
  assert(normalizeFaceless('Sim') === true, '"Sim" -> true');
  assert(normalizeFaceless('sim') === true, '"sim" -> true');
  assert(normalizeFaceless('YES') === true, '"YES" -> true');
  assert(normalizeFaceless(true) === true, 'true -> true');
  assert(normalizeFaceless(1) === true, '1 -> true');
  assert(normalizeFaceless('NÃO') === false, '"NÃO" -> false');
  assert(normalizeFaceless('Não') === false, '"Não" -> false');
  assert(normalizeFaceless('nao') === false, '"nao" -> false');
  assert(normalizeFaceless('NO') === false, '"NO" -> false');
  assert(normalizeFaceless(false) === false, 'false -> false');
  assert(normalizeFaceless(0) === false, '0 -> false');
  assert(normalizeFaceless('especialista') === false, '"especialista" -> false');
  assert(normalizeFaceless('') === null, 'Vazio -> null (NUNCA false por padrão)');
  assert(normalizeFaceless(null) === null, 'null -> null (NUNCA false por padrão)');
  assert(normalizeFaceless(undefined) === null, 'undefined -> null (NUNCA false por padrão)');

  // TESTE 4: Detecção de Header em Matriz e Normalização (Critérios 44 a 48)
  console.log('\n[TESTE 4] Critérios 44-48: Header Detector e Aliases');
  const { detectHeaderRow } = await import('../src/lib/excel/headerDetector');
  const { normalizeHeader, matchColumnWithConfidence } = await import('../src/lib/excel/aliases');

  // Critério 44: Banner de título antes do header
  const matrixWithBanner = [
    ['RELATÓRIO DE OFERTAS'],
    [],
    ['Produto', 'Nicho', 'Preço', 'Ads'],
    ['Produto A', 'Receitas', 'R$27,90', 18],
  ];
  assert(detectHeaderRow(matrixWithBanner).headerRowIndex === 2, 'Critério 44: Header detectado na linha 3 (índice 2) após banner');

  // Critério 45: Header na primeira linha
  const matrixFirstRow = [
    ['Produto', 'Nicho', 'Preço'],
    ['A', 'Receitas', '27,90'],
  ];
  assert(detectHeaderRow(matrixFirstRow).headerRowIndex === 0, 'Critério 45: Header detectado na linha 1 (índice 0)');

  // Critério 46: Linhas vazias antes do header
  const matrixEmptyLines = [
    [],
    [],
    ['Produto', 'Nicho'],
    ['A', 'B'],
  ];
  assert(detectHeaderRow(matrixEmptyLines).headerRowIndex === 2, 'Critério 46: Header detectado na linha 3 (índice 2) após vazios');

  // Critério 47: Normalização de Header
  assert(
    normalizeHeader('Quantidade de Anúncios Ativos') === 'quantidade de anuncios ativos',
    'Critério 47: "Quantidade de Anúncios Ativos" -> "quantidade de anuncios ativos"'
  );
  assert(
    normalizeHeader('  PREÇO FRONT-END  ') === 'preco front end',
    'Normalização remove acentos, espaços e traços: " PREÇO FRONT-END " -> "preco front end"'
  );
  assert(
    normalizeHeader('URL da Página de Vendas (LP)') === 'url da pagina de vendas lp',
    'Normalização: "URL da Página de Vendas (LP)" -> "url da pagina de vendas lp"'
  );

  // Critério 48: Alias Matching com Confidence
  const matchResult = matchColumnWithConfidence('Quantidade de anúncios ativos da oferta');
  assert(matchResult.key === 'active_ads_count', 'Critério 48: "Quantidade de anúncios ativos da oferta" casa com active_ads_count');
  assert(matchResult.confidence >= 80, `Critério 48: Confiança do matching = ${matchResult.confidence}% (>= 80%)`);

  // TESTE 4: Validação de Oferta (Regra 27)
  console.log('\n[TESTE 4] Regra 27 - Critérios de Validação');
  const validOffer = validateOffer({
    product_name: '500 Atividades de Alfabetização',
    niche: 'Educação Infantil',
    advertiser: 'Aprender em Casa',
    price: 27.9,
    active_ads_count: 18,
    days_running: 17,
    faceless: true,
    landing_page_url: 'https://example.com/atividades',
    headline: '500 atividades prontas para imprimir',
  });
  assert(validOffer.status === 'VALIDADA', 'Oferta com todos os critérios preenchidos -> VALIDADA');

  const missingPriceOffer = validateOffer({
    product_name: 'Oferta Sem Preço',
    niche: 'Educação',
    price: null,
    active_ads_count: 15,
    days_running: 20,
    faceless: true,
    landing_page_url: 'https://example.com/lp',
  });
  assert(missingPriceOffer.status === 'REVISAR', 'Oferta com preço ausente -> REVISAR (NÃO INVALIDA nem VALIDADA)');

  const outOfRangePriceOffer = validateOffer({
    product_name: 'High Ticket',
    price: 497.0,
    active_ads_count: 15,
    days_running: 20,
    faceless: true,
    landing_page_url: 'https://example.com/lp',
  });
  assert(outOfRangePriceOffer.status === 'INVALIDA', 'Preço R$497 fora de R$10-50 -> INVALIDA');

  // TESTE 5: Criação e Leitura de Workbook Real Multi-Sheet com Colunas Desconhecidas
  console.log('\n[TESTE 5] Parser de Excel com Múltiplas Sheets e Colunas Extras');
  
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ofertas Brasil
  const sheet1Data = [
    {
      'Nome do Produto': '500 Atividades de Alfabetização',
      'Nicho': 'Educação Infantil',
      'Anunciante': 'Aprender em Casa',
      'Preço': 'R$ 27,90',
      'Ads Ativos': '18',
      'Dias Rodando': '17',
      'Faceless': 'SIM',
      'Página de Vendas': 'https://example.com/atividades',
      'Headline': '500 atividades prontas para imprimir',
      'Gancho do Criativo': 'Você ainda perde horas procurando atividades?',
      'Tipo de LP': 'VSL com Headline Forte',
    },
    {
      'Produto': 'Pack 1000 Templates Canva',
      'Nicho': 'Design & Produtividade',
      'Preço': 'R$ 19,90',
      'Anúncios Ativos': '25',
      'Dias no ar': '12',
      'Sem Rosto': 'SIM',
      'URL LP': 'https://canvapack.com/oferta',
      'Bônus Especial': 'Pack de Fontes Premium',
    },
  ];

  // Sheet 2: Ofertas Educação
  const sheet2Data = [
    {
      'Nome da Oferta': '+250 Simulados SAEB',
      'Nicho': 'Educação',
      'Preço': 'R$ 27,90',
      'Ads': '12',
      'Dias': '15',
      'Faceless': 'Sim',
      'LP': 'https://simulados.com/saeb',
      'Observação Work': 'Excelente ângulo para professores',
    },
    {
      'Nome': 'Planner do Professor 2026',
      'Categoria': 'Educação',
      'Preço': '', // Preço vazio proposital
      'Ads': '6',
      'Dias': '22',
      'Faceless': '1',
      'Página': 'https://plannerprof.com',
      'Ângulo de Copy': 'Organização sem estresse',
    },
  ];

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

  XLSX.utils.book_append_sheet(wb, ws1, 'Ofertas Brasil');
  XLSX.utils.book_append_sheet(wb, ws2, 'Ofertas Educação');

  const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const parseResult = await parseSpreadsheet(excelBuffer, 'mineracao_teste.xlsx', []);

  assert(parseResult.summary.totalSheets === 2, 'Total de sheets lidas: 2');
  assert(parseResult.summary.totalRows === 4, 'Total de linhas lidas de todas as sheets: 4');
  assert(parseResult.rows.length === 4, '4 rows geradas no preview');

  // Log parsed row1 for verification
  const row1 = parseResult.rows[0];
  console.log('\nLinha 1 parseada:', JSON.stringify({
    sheet: row1.sheetName,
    rowIndex: row1.rowIndex,
    normalized: row1.normalized,
    extraData: row1.extraData,
    raw: row1.raw,
  }, null, 2));

  assert(row1.sheetName === 'Ofertas Brasil', 'Row 1 sheetName = "Ofertas Brasil"');
  assert(row1.rowIndex === 2, 'Row 1 rowIndex = 2');
  assert(row1.normalized.product_name === '500 Atividades de Alfabetização', 'Row 1 product_name preservado');
  assert(row1.normalized.niche === 'Educação Infantil', 'Row 1 niche preservado');
  assert(row1.normalized.advertiser === 'Aprender em Casa', 'Row 1 advertiser preservado');
  assert(row1.normalized.price === 27.9, 'Row 1 price = 27.9');
  assert(row1.normalized.active_ads_count === 18, 'Row 1 active_ads_count = 18');
  assert(row1.normalized.days_running === 17, 'Row 1 days_running = 17');
  assert(row1.normalized.faceless === true, 'Row 1 faceless = true');
  assert(row1.normalized.landing_page_url === 'https://example.com/atividades', 'Row 1 landing_page_url preservado');
  assert(row1.validation.status === 'VALIDADA', 'Row 1 status = VALIDADA');
  assert(row1.extraData?.['Gancho do Criativo'] === 'Você ainda perde horas procurando atividades?', 'Row 1 extra_data preserva "Gancho do Criativo"');
  assert(row1.extraData?.['Tipo de LP'] === 'VSL com Headline Forte', 'Row 1 extra_data preserva "Tipo de LP"');
  assert(row1.raw['Nome do Produto'] === '500 Atividades de Alfabetização', 'Row 1 raw preserva célula original');

  // Verificar linha 4 (preço vazio)
  const row4 = parseResult.rows[3];
  assert(row4.sheetName === 'Ofertas Educação', 'Row 4 sheetName = "Ofertas Educação"');
  assert(row4.normalized.product_name === 'Planner do Professor 2026', 'Row 4 product_name = "Planner do Professor 2026"');
  assert(row4.normalized.price === null, 'Row 4 com preço vazio -> price = null (NÃO 0)');
  assert(row4.validation.status === 'REVISAR', 'Row 4 com preço ausente -> status = REVISAR');
  assert(row4.extraData?.['Ângulo de Copy'] === 'Organização sem estresse', 'Row 4 extra_data preserva "Ângulo de Copy"');

  console.log(`\n========================================`);
  console.log(`RESULTADO DOS TESTES: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
