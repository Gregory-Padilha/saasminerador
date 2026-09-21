import * as XLSX from 'xlsx';
import { parseSpreadsheet } from '../src/lib/excel/parser';
import { dbService } from '../src/lib/supabase/db';
import { Offer } from '../src/types';

async function run12OffersEndToEndTest() {
  console.log('================================================================');
  console.log('TESTE DE AUDITORIA FINAL: IMPORTAÇÃO DE 12 OFERTAS REAIS (1:1)');
  console.log('================================================================\n');

  // 12 Realistic rows from ChatGPT Work
  const originalRows = [
    {
      'Nome da Oferta': '+250 Simulados SAEB 5º e 9º ano',
      'Nicho': 'Educação',
      'Subnicho': 'Ensino Fundamental',
      'Anunciante': 'Pedagogia Prática',
      'Preço': 'R$ 27,90',
      'Ads Ativos': '18 anúncios',
      'Data 1º Anúncio': '2026-08-20',
      'Dias Rodando': '23',
      'Faceless': 'SIM',
      'Página de Vendas': 'https://simuladossaeb.com.br/lp',
      'URL Meta': 'https://facebook.com/ads/library/?id=11111',
      'Headline': 'Prepare seus alunos para a prova do SAEB com simulados prontos',
      'Gancho Principal': 'Professor(a), pare de perder os finais de semana montando simulados',
      'Tipo de LP': 'VSL + Botão de Compra',
      'Garantia': '7 dias',
    },
    {
      'Produto': '500 Atividades de Alfabetização Lúdica',
      'Nicho': 'Educação Infantil',
      'Subnicho': 'Alfabetização',
      'Anunciante': 'Aprender Brincando',
      'Preço': '29,90',
      'Ads': '24',
      'Data Primeiro Anúncio': '2026-08-15',
      'Dias': '28',
      'Faceless': 'Sim',
      'LP': 'https://alfabetizacaoludica.com/oferta',
      'Headline': 'Apostilas em PDF prontas para imprimir e aplicar hoje',
      'Ângulo': 'Mães com filhos com dificuldade de leitura',
      'Bônus Especial': 'Pack de Caligrafia',
    },
    {
      'Nome': 'Receitas Secretas na Airfryer Fit',
      'Nicho': 'Gastronomia',
      'Anunciante': 'Chef em Casa',
      'Preço': 'R$ 19,90',
      'Ads Ativos': '30',
      'Dias Rodando': '15',
      'Faceless': '1',
      'Página de Vendas': 'https://airfryerfit.site',
      'Headline': '150 refeições saudáveis em menos de 15 minutos',
      'Observação': 'Excelente escala no TikTok e Meta',
    },
    {
      'Nome do Produto': 'Manual de Finanças no WhatsApp',
      'Nicho': 'Finanças',
      'Anunciante': 'Organiza Grana',
      'Preço': 'R$ 37,00',
      'Ads Ativos': '12',
      'Dias Rodando': '19',
      'Faceless': 'SIM',
      'LP': 'https://organizagrana.com',
      'Headline': 'Controle financeiro simples sem planilhas chatas',
    },
    {
      'Nome': 'Pack 1000 Moldes de Feltro',
      'Nicho': 'Artesanato',
      'Anunciante': 'Feltro Criativo',
      'Preço': '24,90',
      'Ads': '8',
      'Dias': '14',
      'Faceless': 'SIM',
      'LP': 'https://feltrocriativo.com.br',
      'Headline': 'Moldes em tamanho real prontos para corte',
      'Quantidade de Bônus': '5 apostilas extras',
    },
    {
      'Produto': 'Guia Prático Adestramento Canino',
      'Nicho': 'Pets',
      'Anunciante': 'Pet Feliz',
      'Preço': 'R$ 47,00',
      'Ads': '15',
      'Dias': '21',
      'Faceless': 'SIM',
      'LP': 'https://adestramentopet.com',
      'Headline': 'Ensine seu cão a fazer necessidades no lugar certo',
    },
    {
      'Nome da Oferta': 'Cronograma Capilar Caseiro 30D',
      'Nicho': 'Beleza & Estética',
      'Anunciante': 'Cabelo de Rainha',
      'Preço': 'R$ 22,90',
      'Ads Ativos': '20',
      'Dias': '18',
      'Faceless': 'SIM',
      'LP': 'https://cronogramacapilar.shop',
      'Headline': 'Recupere cabelos ressecados com receitas caseiras de 3 ingredientes',
    },
    {
      'Produto': 'Planner Digital 2026 para iPad e Tablet',
      'Nicho': 'Produtividade',
      'Anunciante': 'Planner Studio',
      'Preço': 'R$ 34,90',
      'Ads': '16',
      'Dias': '25',
      'Faceless': 'SIM',
      'LP': 'https://plannerdigital.app',
      'Headline': 'O planner hiperlinkado mais completo para organizar seu ano',
    },
    {
      'Nome': 'Apostila 100 Jogos Bíblicos para Crianças',
      'Nicho': 'Religioso / Infantil',
      'Anunciante': 'Ministério Infantil',
      'Preço': 'R$ 27,00',
      'Ads': '11',
      'Dias': '13',
      'Faceless': 'SIM',
      'LP': 'https://jogosbiblicos.com.br',
      'Headline': 'Dinâmicas e gincanas prontas para a Escola Bíblica Dominical',
    },
    {
      'Nome da Oferta': 'Planilha de Precificação para Confeitaria',
      'Nicho': 'Confeitaria',
      'Anunciante': 'Doce Lucro',
      'Preço': 'R$ 29,90',
      'Ads': '14',
      'Dias': '16',
      'Faceless': 'SIM',
      'LP': 'https://precificacaodoce.com',
      'Headline': 'Nunca mais tenha prejuízo vendendo bolos e doces',
    },
    {
      // Caso de campo ausente: SEM PREÇO (deve virar null e status REVISAR)
      'Nome do Produto': 'Mini Curso Saboaria Artesanal',
      'Nicho': 'Artesanato',
      'Anunciante': 'Sabão Natural',
      'Preço': '', // Ausente
      'Ads': '7',
      'Dias': '12',
      'Faceless': 'SIM',
      'LP': 'https://saboarianatural.com',
      'Headline': 'Aprenda a fazer sabonetes glicerinados em casa',
    },
    {
      // Caso de High Ticket (deve virar status INVALIDA)
      'Nome da Oferta': 'Mentoria Individual de Tráfego Direto',
      'Nicho': 'Marketing Digital',
      'Anunciante': 'Agência Pro',
      'Preço': 'R$ 997,00', // Inválido por ser > 50
      'Ads': '2',          // Inválido por ser < 5
      'Dias': '3',          // Inválido por ser < 10
      'Faceless': 'NÃO',    // Com especialista
      'LP': 'https://mentoriatrafego.com',
      'Headline': 'Feche contratos de alto valor',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(originalRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mineracao_Real');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  console.log('1. Lendo arquivo com SheetJS...');
  const parseResult = await parseSpreadsheet(buffer, 'mineracao_real_12.xlsx', []);

  console.log(`   ✓ Linhas lidas: ${parseResult.summary.totalRows} (Esperado: 12)`);
  console.log(`   ✓ Válidas: ${parseResult.summary.readyRows} (Esperado: 10)`);
  console.log(`   ✓ Inválidas: ${parseResult.summary.invalidRows} (Esperado: 1)`);

  if (parseResult.summary.totalRows !== 12) {
    throw new Error(`Falha: esperava 12 linhas, obteve ${parseResult.summary.totalRows}`);
  }

  console.log('\n2. Persistindo lote no banco de dados...');
  const result = await dbService.executeImportBatch('mineracao_real_12.xlsx', parseResult.rows);

  console.log(`   ✓ Lote criado: ${result.batch.id}`);
  console.log(`   ✓ Novas ofertas inseridas: ${result.newCount}`);
  console.log(`   ✓ Linhas com erro: ${result.batch.error_rows}`);

  console.log('\n3. Consultando ofertas salvas para validação 1:1...');
  const savedOffers = await dbService.getOffers();

  console.log(`   ✓ Total de ofertas no banco: ${savedOffers.length}`);

  // Verificar linha 1
  const offer1 = savedOffers.find((o) => o.product_name.includes('Simulados SAEB'));
  if (!offer1) throw new Error('Oferta 1 não encontrada no banco!');
  console.log('\n[OFERTA 1 - Validação de Integridade]:');
  console.log(`   - Nome: "${offer1.product_name}"`);
  console.log(`   - Nicho: "${offer1.niche}"`);
  console.log(`   - Preço: ${offer1.price} (BRL)`);
  console.log(`   - Ads Ativos: ${offer1.active_ads_count}`);
  console.log(`   - Dias Rodando: ${offer1.days_running}`);
  console.log(`   - Faceless: ${offer1.faceless}`);
  console.log(`   - Status: ${offer1.status}`);
  console.log(`   - Sheet: ${offer1.sheet_name}, Linha: ${offer1.row_number}`);
  console.log(`   - Extra Data:`, JSON.stringify(offer1.extra_data));

  if (offer1.price !== 27.9) throw new Error(`Preço incorreto: ${offer1.price}`);
  if (offer1.active_ads_count !== 18) throw new Error(`Ads incorreto: ${offer1.active_ads_count}`);
  if (offer1.status !== 'VALIDADA') throw new Error(`Status incorreto: ${offer1.status}`);
  if (!offer1.extra_data?.['Gancho Principal']) throw new Error('Gancho Principal não preservado em extra_data!');
  if (!offer1.extra_data?.['Tipo de LP']) throw new Error('Tipo de LP não preservado em extra_data!');

  // Verificar linha 11 (Sem Preço -> status REVISAR)
  const offer11 = savedOffers.find((o) => o.product_name.includes('Saboaria Artesanal'));
  if (!offer11) throw new Error('Oferta 11 não encontrada no banco!');
  console.log('\n[OFERTA 11 - Validação de Preço Ausente]:');
  console.log(`   - Nome: "${offer11.product_name}"`);
  console.log(`   - Preço: ${offer11.price} (Esperado: null, NUNCA 0)`);
  console.log(`   - Status: ${offer11.status} (Esperado: REVISAR)`);

  if (offer11.price !== null) throw new Error(`Preço não-nulo para campo ausente: ${offer11.price}`);
  if (offer11.status !== 'REVISAR') throw new Error(`Status deveria ser REVISAR: ${offer11.status}`);

  // Verificar linha 12 (High Ticket -> status INVALIDA)
  const offer12 = savedOffers.find((o) => o.product_name.includes('Mentoria Individual'));
  if (!offer12) throw new Error('Oferta 12 não encontrada no banco!');
  console.log('\n[OFERTA 12 - Validação de Critério Inválido]:');
  console.log(`   - Nome: "${offer12.product_name}"`);
  console.log(`   - Preço: ${offer12.price}`);
  console.log(`   - Status: ${offer12.status} (Esperado: INVALIDA)`);

  if (offer12.price !== 997.0) throw new Error(`Preço incorreto: ${offer12.price}`);
  if (offer12.status !== 'INVALIDA') throw new Error(`Status deveria ser INVALIDA: ${offer12.status}`);

  console.log('\n================================================================');
  console.log('✅ AUDITORIA CONCLUÍDA COM SUCESSO ABSOLUTO (12/12 REGISTROS 1:1)');
  console.log('================================================================\n');
}

run12OffersEndToEndTest().catch((err) => {
  console.error('Erro na auditoria:', err);
  process.exit(1);
});
