'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  Bot,
  ShieldCheck,
  Zap,
  Sliders,
  BookOpen,
  Layers,
  Terminal,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Target,
  Flame,
  DollarSign,
  Filter,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface MissionsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_NICHES = [
  'Educação Infantil & BNCC',
  'Concursos Públicos & OAB',
  'Saúde, Emagrecimento & Receitas',
  'Renda Extra, PLR & Ferramentas',
  'Finanças Pessoais & Investimentos',
  'Espiritualidade & Oração',
  'Artesanato, Costura & Crochê',
  'Relacionamentos & Desenvolvimento',
  'Idiomas & Aprendizado Acelerado',
  'Pets & Adestramento',
  'Outro (Digitar personalização)...',
];

const CURATED_MISSIONS = [
  {
    id: 'meta-lowticket-geral',
    title: 'Meta Ads — Varredura Geral de Produtos Digitais até R$ 47',
    category: 'Meta Ads',
    difficulty: 'Iniciante',
    timeEst: '3 a 5 min',
    summary: 'Busca anúncios ativos na Biblioteca da Meta vendendo e-books, packs e kits com foco em baixo ticket.',
    prompt: `# MISSÃO: VARREDURA GERAL DE BAIXO TICKET (META ADS LIBRARY)

OBJETIVO:
Encontrar e minerar 5 ofertas digitais ATIVAS e INÉDITAS no Brasil com preço de até R$ 47,00.

PONTO DE PARTIDA:
Acesse exatamente a URL:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=livro%20digital%20ou%20pack%20ou%20caderno%20ou%20guia&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

REGRAS DE EXECUÇÃO OBRIGATÓRIAS:
1. Feche popups de cookies/privacidade da Meta clicando em "Recusar cookies opcionais" ou fechando o diálogo.
2. Para cada anúncio com status "Ativo":
   a) ANTES de abrir a página, consulte: check_duplicate_in_offer_miner(url="<link_do_anuncio>", product_name="<titulo>")
   b) Se retornar duplicata, ignore imediatamente e passe para o próximo anúncio.
3. Clique em "Saiba mais" para abrir a Landing Page da oferta.
4. Na Landing Page:
   - Identifique o Nome Limpo do produto e o Anunciante.
   - Encontre o preço em R$ (se estiver visível na página ou no botão).
   - Se o preço não estiver visível na LP, clique no botão de compra (CTA) para acessar a página do checkout (Kiwify, Hotmart, Eduzz, Kirvano, etc.) e extraia o valor real do front-end.
   - Extraia a promessa central (o que o cliente ganha ao comprar).
5. Salve a oferta chamando:
   save_offer_to_miner_database(
     product_name="<nome_do_produto>",
     advertiser="<nome_do_anunciante>",
     landing_page_url="<url_da_lp>",
     checkout_url="<url_do_checkout_se_encontrada>",
     price=<valor_em_float_ex_27.00>,
     niche="Baixo Ticket Geral",
     promise="<promessa_central>",
     active_ads_count=<numero_de_anuncios_ativos_se_visivel>
   )
6. Repita até salvar 5 ofertas inéditas aprovadas. Encerre com resumo em formato JSON das ofertas mineradas.`,
  },
  {
    id: 'bncc-educacao',
    title: 'Nicho Educação Infantil, Jogos Pedagógicos & BNCC',
    category: 'Educação',
    difficulty: 'Intermediário',
    timeEst: '4 a 6 min',
    summary: 'Minera atividades para professores e pais (lapbooks, alfabetização, cartilhas e materiais lúdicos).',
    prompt: `# MISSÃO: MINERAÇÃO NICHO EDUCAÇÃO & MATERIAIS BNCC

OBJETIVO:
Localizar 4 ofertas escaladas de infoprodutos pedagógicos (alfabetização, jogos pedagógicos, lapbooks, autismo/TDAH ou BNCC) com preço entre R$ 10,00 e R$ 47,00.

PONTO DE PARTIDA:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=atividades%20alfabetizacao%20ou%20lapbook%20ou%20jogos%20pedagogicos%20ou%20bncc&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

DIRETRIZES TÉCNICAS:
1. Contorne janelas de cookies ou avisos da Meta.
2. Identifique anunciantes com mais de 3 anúncios ativos (indício de validação).
3. Verifique duplicidade no sistema: check_duplicate_in_offer_miner(product_name="<nome>")
4. Acesse a Landing Page:
   - Extraia o que está incluído (ex: "Pack 300 atividades em PDF prontas para imprimir").
   - Localize o botão de compra e capture a URL do checkout.
   - Confirme o valor real em R$ (desconsidere o valor "de R$ 97 por R$ 27", capture o valor final real de venda).
5. Dispare:
   save_offer_to_miner_database(
     product_name="<nome>",
     advertiser="<anunciante>",
     landing_page_url="<lp>",
     checkout_url="<checkout>",
     price=<preco>,
     niche="Educação Infantil",
     subniche="Recursos Pedagógicos",
     promise="<promessa>",
     active_ads_count=<contagem_de_anuncios>
   )
6. Pare assim que registrar 4 ofertas inéditas e retorne a lista final em JSON.`,
  },
  {
    id: 'concursos-oab',
    title: 'Concursos Públicos, OAB & Exames Nacionais',
    category: 'Concursos',
    difficulty: 'Intermediário',
    timeEst: '4 min',
    summary: 'Minera mapas mentais, cronogramas de estudo, resumos esquematizados e questões comentadas.',
    prompt: `# MISSÃO: MINERAÇÃO DE INFOPRODUTOS PARA CONCURSOS & OAB

OBJETIVO:
Minerar 3 ofertas ativas no nicho de preparação para concursos, ENEM ou OAB (cronogramas, flashcards, mapas mentais ou cadernos de questões).

PONTO DE PARTIDA:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=mapas%20mentais%20ou%20cronograma%20concurso%20ou%20vademecum%20esquematizado&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

REGRAS:
1. Filtre por anúncios com criativo claro (foto de PDF, encadernado ou mockup no tablet).
2. Verifique duplicatas no Offer Miner: check_duplicate_in_offer_miner(...)
3. Acesse a página do produto e extraia:
   - Título exato (ex: "Cronograma OAB 90 Dias com Questões").
   - Preço oficial de venda (geralmente entre R$ 29,90 e R$ 67,00).
   - Checkout de destino (Kiwify, Hotmart, Eduzz, etc.).
4. Use save_offer_to_miner_database para enviar a oferta para a Caixa de Aprovação do SaaS.
5. Finalize ao atingir 3 ofertas salvas com sucesso.`,
  },
  {
    id: 'saude-emagrecimento',
    title: 'Saúde, Emagrecimento, Chás & Protocolos Fit',
    category: 'Saúde & Bem-Estar',
    difficulty: 'Avançado',
    timeEst: '5 min',
    summary: 'Varre receitas anti-inflamatórias, cardápios funcionais e e-books de shots/chás naturais.',
    prompt: `# MISSÃO: MINERAÇÃO EMAGRECIMENTO & PROTOCOLOS NATURAIS

OBJETIVO:
Encontrar 4 ofertas de baixo ticket (R$ 19 a R$ 47) no nicho de emagrecimento, receitas para secar, shots matinais ou cardápios funcionais.

PONTO DE PARTIDA:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=protocolo%20cha%20ou%20receitas%20secar%20ou%20shot%20matinal%20ou%20desafio%2021%20dias&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

PASSOS:
1. Remova popups de cookie da Meta.
2. Inspecione anúncios com mais de 5 dias ativos.
3. Valide duplicidade: check_duplicate_in_offer_miner(url="<link>", product_name="<nome>")
4. Navegue até a página de vendas:
   - Se for uma VSL (Vídeo de Vendas) sem preço inicial, aguarde ou role a página até encontrar o botão de checkout que surge abaixo do vídeo.
   - Extraia a headline de transformação principal.
   - Obtenha a URL do checkout e o preço em reais.
5. Registre com save_offer_to_miner_database (niche="Saúde & Emagrecimento").
6. Conclua ao registrar 4 ofertas inéditas e forneça o JSON final.`,
  },
  {
    id: 'renda-extra-plr',
    title: 'Renda Extra, PLRs & Ferramentas Digitais Prontas',
    category: 'Renda Extra',
    difficulty: 'Intermediário',
    timeEst: '4 min',
    summary: 'Varre packs de canva, prompts de IA, templates prontas e produtos digitais com direito de revenda.',
    prompt: `# MISSÃO: MINERAÇÃO DE PLRS, TEMPLATES & PACOTES CANVA

OBJETIVO:
Localizar 4 ofertas de packs digitais prontos (templates Canva, prompts ChatGPT, pacotes de artes ou produtos com direito de revenda PLR) com ticket de R$ 10 a R$ 37.

PONTO DE PARTIDA:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=pack%20canva%20ou%20templates%20prontos%20ou%20plr%20ou%20prompts%20ia&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

EXECUÇÃO:
1. Verifique se o produto é 100% digital e entregue via link ou área de membros.
2. Execute check_duplicate_in_offer_miner para garantir novidade no banco.
3. Abra a Landing Page e capture:
   - Nome do produto, promessa e quantidade de templates/itens oferecidos.
   - Preço com desconto aplicado na página de checkout.
4. Persista com save_offer_to_miner_database.
5. Pare ao atingir 4 ofertas e gere o JSON de relatório.`,
  },
  {
    id: 'espionagem-anunciante',
    title: 'Espionagem Reversa de Anunciante (Multi-Ofertas)',
    category: 'Engenharia Reversa',
    difficulty: 'Avançado',
    timeEst: '5 a 8 min',
    summary: 'Analisa uma página inteira de um produtor para mapear todas as ofertas diferentes que ele roda em paralelo.',
    prompt: `# MISSÃO: VARREDURA PROFUNDA DE ANUNCIANTE ESPECÍFICO

OBJETIVO:
Entrar na página do anunciante fornecido, mapear todos os criativos ativos e separar os PRODUTOS DISTINTOS que ele vende (evitando misturar criativos de ofertas diferentes).

INSTRUÇÃO:
Substitua [NOME_DA_PAGINA_OU_ID] pela página desejada e inicie na URL:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=[NOME_DA_PAGINA_OU_ID]

PASSO A PASSO:
1. Conte o número total de anúncios ativos exibidos no cabeçalho da página.
2. Agrupe os anúncios pelo domínio da Landing Page ou pelo nome do produto anunciado.
3. Para cada produto único identificado:
   a) Consulte check_duplicate_in_offer_miner(...)
   b) Se for novo, visite a Landing Page e o checkout correspondente.
   c) Salve no banco via save_offer_to_miner_database preenchendo todos os campos.
4. Retorne um relatório estruturado em JSON com:
   - Nome do Anunciante
   - Total de anúncios ativos na conta
   - Lista de cada produto minerado com seu respectivo preço e LP.`,
  },
  {
    id: 'tiktok-creative-center',
    title: 'TikTok Creative Center — Produtos Digitais Virais no Brasil',
    category: 'TikTok Ads',
    difficulty: 'Intermediário',
    timeEst: '5 min',
    summary: 'Explora os anúncios mais curtidos e compartilhados no TikTok com campanhas ativas no Brasil.',
    prompt: `# MISSÃO: DESCOBERTA VIRAL NO TIKTOK CREATIVE CENTER

OBJETIVO:
Localizar 3 produtos digitais ou infoprodutos em alta tração no TikTok Brasil através da biblioteca de inspiração de anúncios.

PONTO DE PARTIDA:
https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en?countryCode=BR&period=30

DIRETRIZES:
1. Filtre pela região "Brazil" e período dos últimos 30 dias.
2. Busque por termos relacionados a infoprodutos: "curso", "e-book", "guia", "método", "desafio" ou "planilha".
3. Identifique campanhas com alta taxa de engajamento (CTR alto ou muitas curtidas).
4. Localize a Landing Page de destino vinculada à campanha.
5. Verifique duplicidade no Offer Miner: check_duplicate_in_offer_miner(...)
6. Visite a LP, extraia o preço em R$, promessa e link de checkout.
7. Dispare save_offer_to_miner_database com nicho e dados mapeados.
8. Encerre com o JSON de ofertas aprovadas.`,
  },
  {
    id: 'checkout-hunter',
    title: 'Caçador de Checkouts Ocultos (Kiwify, Hotmart & Kirvano)',
    category: 'Investigação Profunda',
    difficulty: 'Especialista',
    timeEst: '6 min',
    summary: 'Para páginas que usam VSL ou que escondem o preço na LP, clica no botão de compra para revelar valor e order bumps.',
    prompt: `# MISSÃO: CAÇADOR DE CHECKOUT & PREÇO REAL DE VENDA

OBJETIVO:
Localizar 3 ofertas digitais ativas na Meta Ads Library onde a página de vendas é longa ou esconde o preço, exigindo navegar até o checkout final para validar o valor real.

PONTO DE PARTIDA:
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=metodo%20ou%20protocolo%20ou%20formula&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped

REGRAS DE EXECUÇÃO:
1. Ao abrir cada Landing Page, role suavemente para baixo até encontrar o botão principal de compra (geralmente com textos: "Quero Garantir Minha Vaga", "Sim! Quero Começar Agora", "Comprar Agora").
2. Clique no botão ou copie a URL de redirecionamento.
3. Na página de checkout aberta (identifique se é Kiwify, Hotmart, PerfectPay, Kirvano, AppMax ou Eduzz):
   - Extraia o valor exato do produto principal em reais (ignorar centavos parcelados, capture o valor à vista).
   - Verifique se existem ofertas adicionais na página (Order Bumps visíveis).
   - Copie a URL do checkout limpa (sem parâmetros desnecessários de UTM).
4. Verifique duplicatas e registre usando save_offer_to_miner_database.
5. Conclua ao salvar 3 ofertas com checkout 100% validado.`,
  },
];

export function MissionsHubModal({ isOpen, onClose }: MissionsHubModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'builder' | 'library' | 'rules'>('builder');

  // Custom Builder State
  const [selectedNiche, setSelectedNiche] = useState<string>('Educação Infantil & BNCC');
  const [customNicheInput, setCustomNicheInput] = useState<string>('');
  const [platform, setPlatform] = useState<'meta_ads' | 'tiktok' | 'advertiser_audit'>('meta_ads');
  const [targetCount, setTargetCount] = useState<number>(5);
  const [maxPrice, setMaxPrice] = useState<number>(47);
  const [depthMode, setDepthMode] = useState<'standard' | 'deep_checkout'>('deep_checkout');
  const [minDaysActive, setMinDaysActive] = useState<number>(3);
  const [advertiserUrl, setAdvertiserUrl] = useState<string>('');

  // Search & Copy states
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveNiche = selectedNiche.startsWith('Outro')
    ? (customNicheInput.trim() || 'Produtos Digitais')
    : selectedNiche;

  // Build the dynamic prompt based on user builder selections
  const generateCustomPrompt = () => {
    let startUrl = '';
    if (platform === 'meta_ads') {
      const searchTerms = encodeURIComponent(
        effectiveNiche.toLowerCase().includes('educ')
          ? 'atividades alfabetizacao ou lapbook ou jogos pedagogicos'
          : effectiveNiche.toLowerCase().includes('concurs')
          ? 'mapas mentais ou cronograma concurso ou oab'
          : effectiveNiche.toLowerCase().includes('saud') || effectiveNiche.toLowerCase().includes('emagrec')
          ? 'receitas secar ou shot matinal ou protocolo cha'
          : effectiveNiche.toLowerCase().includes('renda') || effectiveNiche.toLowerCase().includes('plr')
          ? 'pack canva ou templates prontos ou plr'
          : `${effectiveNiche.toLowerCase()} livro digital ou pack ou guia`
      );
      startUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${searchTerms}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`;
    } else if (platform === 'tiktok') {
      startUrl = `https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en?countryCode=BR&period=30`;
    } else {
      startUrl = advertiserUrl.trim() || 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR';
    }

    const priceCondition =
      maxPrice > 0
        ? `Preço máximo de até R$ ${maxPrice.toFixed(2).replace('.', ',')}`
        : 'Qualquer preço de baixo ticket (geralmente até R$ 97,00)';

    const checkoutInstructions =
      depthMode === 'deep_checkout'
        ? `- Se o preço não estiver claro na Landing Page, OBRIGATORIAMENTE clique no botão de compra para abrir o Checkout oficial (Kiwify, Hotmart, Eduzz, Kirvano, etc.).
- Extraia o valor real do checkout e verifique se há order bumps visíveis.`
        : `- Extraia o preço visível na Landing Page ou no botão de chamada para ação.`;

    return `# MISSÃO DE MINERAÇÃO PERSONALIZADA: ${effectiveNiche.toUpperCase()}

OBJETIVO DA TAREFA:
Localizar e minerar exatamente ${targetCount} ofertas digitais ATIVAS e INÉDITAS no nicho "${effectiveNiche}".
Condição de Preço: ${priceCondition}.

PONTO DE PARTIDA (NAVEGUE PARA ESTA URL):
${startUrl}

PASSO A PASSO RIGOROSO:
1. CONTORNO DE BLOQUEIOS & COOKIES:
   - Se abrir banner de cookies ou políticas da plataforma, clique imediatamente em "Recusar cookies opcionais" ou feche a caixa de diálogo.
   - Certifique-se de que os anúncios inspecionados possuem status "Ativo"${minDaysActive > 0 ? ` e estão rodando há pelo menos ${minDaysActive} dias` : ''}.

2. VERIFICAÇÃO ANTI-DUPLICAÇÃO (OBRIGATÓRIO ANTES DE NAVEGAR):
   - Para cada anúncio encontrado, execute antes de tudo:
     check_duplicate_in_offer_miner(url="<link_do_anuncio>", product_name="<nome_identificado>")
   - Se o retorno indicar "DUPLICATE DETECTED", PULE IMEDIATAMENTE este anúncio e prossiga para o próximo.

3. INSPEÇÃO DA LANDING PAGE:
   - Clique em "Saiba mais" ou copie e abra o link de destino.
   - Extraia o Nome do Produto, Anunciante e a Promessa Central (o que o material promete ensinar ou entregar).

4. IDENTIFICAÇÃO DO PREÇO & CHECKOUT:
   ${checkoutInstructions}
   - Valide que o produto é digital (e-book, curso, templates, PDF, área de membros).

5. PERSISTÊNCIA NO SISTEMA (GERAÇÃO DO CARD DE APROVAÇÃO):
   - Registre a oferta no sistema chamando:
     save_offer_to_miner_database(
       product_name="<nome_do_produto>",
       advertiser="<nome_do_anunciante>",
       landing_page_url="<url_da_lp>",
       checkout_url="<url_do_checkout_se_capturada>",
       price=<preco_em_numero_float>,
       niche="${effectiveNiche}",
       promise="<promessa_central>",
       active_ads_count=<total_de_anuncios_ativos_deste_anunciante>
     )
   - A oferta será salva na Caixa de Entrada de Aprovação no SaaS para conferência do usuário.

6. FINALIZAÇÃO DA TAREFA:
   - Repita o processo até acumular ${targetCount} ofertas salvas com sucesso.
   - Conclua a tarefa exibindo o resumo em JSON de todas as ofertas mineradas.`;
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Comando copiado com sucesso! Cole na aba "Run Agent".');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredMissions = CURATED_MISSIONS.filter(
    (m) =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.summary.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-500/20 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Central de Missões & Gerador de Prompts do Agente
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Comandos de Alta Precisão
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gere ou copie comandos formulados com regras estritas para o navegador autônomo minerar sem errar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Fechar Central de Missões"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'builder'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>⚡ Gerador Sob Medida</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'library'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📚 Biblioteca de Missões ({CURATED_MISSIONS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'rules'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>🛡️ Regras de Ouro & Execução</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: BUILDER (GERADOR SOB MEDIDA) */}
          {/* ========================================================================= */}
          {activeTab === 'builder' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Configuration Column */}
                <div className="lg:col-span-5 space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Parâmetros da Mineração
                    </h3>
                  </div>

                  {/* Nicho Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Nicho Alvo</label>
                    <select
                      value={selectedNiche}
                      onChange={(e) => setSelectedNiche(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      {PRESET_NICHES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    {selectedNiche.startsWith('Outro') && (
                      <input
                        type="text"
                        value={customNicheInput}
                        onChange={(e) => setCustomNicheInput(e.target.value)}
                        placeholder="Digite o nome do seu nicho (ex: Tarot, Barbeiros, etc.)"
                        className="w-full mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    )}
                  </div>

                  {/* Fonte / Plataforma */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Fonte de Mineração</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlatform('meta_ads')}
                        className={`p-2 rounded-xl text-xs font-semibold border text-center transition ${
                          platform === 'meta_ads'
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Meta Ads
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlatform('tiktok')}
                        className={`p-2 rounded-xl text-xs font-semibold border text-center transition ${
                          platform === 'tiktok'
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        TikTok Center
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlatform('advertiser_audit')}
                        className={`p-2 rounded-xl text-xs font-semibold border text-center transition ${
                          platform === 'advertiser_audit'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Anunciante
                      </button>
                    </div>

                    {platform === 'advertiser_audit' && (
                      <input
                        type="text"
                        value={advertiserUrl}
                        onChange={(e) => setAdvertiserUrl(e.target.value)}
                        placeholder="URL da página de anúncios do anunciante"
                        className="w-full mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    )}
                  </div>

                  {/* Preço Máximo & Quantidade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Teto de Preço</label>
                      <select
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value={19.9}>Até R$ 19,90</option>
                        <option value={27}>Até R$ 27,00</option>
                        <option value={37}>Até R$ 37,00</option>
                        <option value={47}>Até R$ 47,00 (Recomendado)</option>
                        <option value={97}>Até R$ 97,00</option>
                        <option value={0}>Sem Limite</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Meta de Ofertas</label>
                      <select
                        value={targetCount}
                        onChange={(e) => setTargetCount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value={1}>1 Oferta (Rápido)</option>
                        <option value={3}>3 Ofertas</option>
                        <option value={5}>5 Ofertas (Padrão)</option>
                        <option value={10}>10 Ofertas (Varredura Ampla)</option>
                      </select>
                    </div>
                  </div>

                  {/* Nível de Profundidade */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Estratégia de Checkout</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDepthMode('deep_checkout')}
                        className={`p-2.5 rounded-xl text-[11px] font-semibold border text-left transition ${
                          depthMode === 'deep_checkout'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Checkout Profundo
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Clica no CTA para extrair preço real no checkout
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDepthMode('standard')}
                        className={`p-2.5 rounded-xl text-[11px] font-semibold border text-left transition ${
                          depthMode === 'standard'
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                          Padrão LP
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Extrai preço visível direto na Landing Page
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Filtro de Dias Ativos */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Filtro de Escala Mínima</label>
                    <select
                      value={minDaysActive}
                      onChange={(e) => setMinDaysActive(Number(e.target.value))}
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value={0}>Qualquer anúncio ativo</option>
                      <option value={3}>Anúncios ativos há mais de 3 dias (Validados)</option>
                      <option value={7}>Anúncios ativos há mais de 7 dias (Em Escala)</option>
                    </select>
                  </div>
                </div>

                {/* Generated Prompt Output Column */}
                <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900/80 p-5 rounded-2xl border border-slate-800 relative">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                          Comando Formatado Pronto para Copiar
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        Total ~{generateCustomPrompt().length} chars
                      </span>
                    </div>

                    <div className="relative">
                      <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-[380px] leading-relaxed select-all">
                        {generateCustomPrompt()}
                      </pre>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800/80 mt-4">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Com anti-duplicação e auto-save ativados.</span>
                    </div>

                    <button
                      onClick={() => handleCopyText(generateCustomPrompt(), 'custom-builder')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 transition active:scale-95"
                    >
                      {copiedId === 'custom-builder' ? (
                        <>
                          <Check className="w-4 h-4 text-slate-950" />
                          <span>Comando Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-950" />
                          <span>Copiar Comando Gerado</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CURATED MISSIONS LIBRARY */}
          {/* ========================================================================= */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Pesquisar por nicho, plataforma ou tipo de missão..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Grid of Missions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMissions.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 group shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {item.category}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>Nível: {item.difficulty}</span>
                          <span>•</span>
                          <span>{item.timeEst}</span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                        {item.title}
                      </h4>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.summary}
                      </p>

                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[10px] text-slate-400 line-clamp-3">
                        {item.prompt}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => handleCopyText(item.prompt, item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copiar Missão</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: RULES & BEST PRACTICES */}
          {/* ========================================================================= */}
          {activeTab === 'rules' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Como o Agente Funciona Conectado ao Offer Miner</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O Browser-Use é um agente de navegação autônomo baseado em IA (LLM). Para garantir resultados precisos, criamos 3 ferramentas customizadas registradas diretamente no núcleo do navegador:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <span className="font-mono text-cyan-400 font-bold block">check_duplicate</span>
                    <span className="text-slate-400 text-[11px]">
                      Verifica se o anúncio, URL ou produto já existe no banco antes de minerar.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <span className="font-mono text-emerald-400 font-bold block">save_offer</span>
                    <span className="text-slate-400 text-[11px]">
                      Despacha a oferta para a Fila de Aprovação (Staging) do SaaS em tempo real.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <span className="font-mono text-purple-400 font-bold block">catalog_summary</span>
                    <span className="text-slate-400 text-[11px]">
                      Fornece visão geral dos nichos e domínios já catalogados para contextualizar o agente.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-amber-300">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Dicas Cruciais de Execução</span>
                </div>
                <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-300">
                  <li>
                    <strong>Popups de Cookies:</strong> Instrua sempre o agente a fechar banners de cookies da Meta para não perder cliques.
                  </li>
                  <li>
                    <strong>Páginas com VSL:</strong> Páginas com vídeo longo podem esconder o botão de compra. Se o agente não achar o botão, use o comando com foco em &ldquo;Checkout Hunter&rdquo; para rolar até o final da página.
                  </li>
                  <li>
                    <strong>Aprovação Humana:</strong> Toda oferta salva vai para os <strong>Cards de Aprovação</strong> no SaaS. Você mantém o controle total e decide o que entra no catálogo oficial.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
