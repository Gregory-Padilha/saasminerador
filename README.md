# saasminerador

> **Plataforma Completa de Mineração, Inteligência de Mercado e Dossiê Operacional para Ofertas Low-Ticket.**

O **saasminerador** (Offer Miner SaaS) é uma central avançada desenvolvida para monitorar, raspar, decodificar e analisar operações de vendas de alta performance na internet. A plataforma combina visão computacional, raspadores inteligentes, agentes autônomos de navegação e integração com IA para fornecer dossiês detalhados de produtos, criativos e esteiras de vendas.

---

## 🚀 Principais Módulos e Recursos

### 1. 🤖 Agente Minerador Autônomo (Browser-Use)
- **Navegação Real:** Emprega agentes autônomos baseados em Chromium para explorar redes sociais, bibliotecas de anúncios e funis ao vivo.
- **Mission Builder Integrado:** Guia de missões e formulário paramétrico para geração automática de prompts de mineração por nicho, plataforma e tipo de produto.
- **Pipeline Direto para o SaaS:** Ofertas mineradas pelo agente são importadas automaticamente para o sistema no estado `pending_review`, permitindo aprovação visual pelo operador com 1 clique.
- **Status em Tempo Real:** Loader dinâmico com telemetria visual das etapas de pesquisa.

### 2. 🔍 Raspagem e Mapeamento de Funil
- **Landing Pages:** Extração de cópia, estrutura visual de blocos, botões CTA e capturas de tela automatizadas.
- **Checkouts Reais:** Identificação automática de gateways (Hotmart, Kiwify, PerfectPay, Eduzz, CartPanda, etc.), preços reais, order bumps e upsells.
- **Criativos & Mídia:** Extração e catalogação de anúncios ativos, cópias de anúncio, formatos de mídia e datas de veiculação.

### 3. 🧠 Inteligência & Dossiê da Oferta
- **Dossiê Completo:** Ficha técnica com ângulo de vendas, avatar principal, promessa central, mecanismo único e esteira comercial.
- **Radar de Tendências:** Monitoramento contínuo de novas ofertas escalando em múltiplos nichos.
- **Comparador Lado a Lado:** Análise comparativa profunda entre duas ou mais ofertas para engenharia reversa de ofertas vencedoras.
- **Exportação Estruturada:** Geração de relatórios operacionais em PDF, JSON e Markdown.

### 4. 🏢 Escritório Virtual 2D (AI Office)
- Visualização isométrica interativa dos agentes de IA operando em tempo real através de sprites animados e máquina de estados.

---

## 🛠️ Stack Tecnológica

- **Frontend / Fullstack:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, React 19)
- **Linguagem:** TypeScript / Node.js
- **Estilização:** Vanilla CSS moderno com Tailwind CSS & Lucide Icons
- **Banco de Dados & Storage:** [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security)
- **Agente de Navegação:** Python 3.11+, [Browser-Use](https://github.com/browser-use/browser-use), Playwright, Gradio WebUI
- **Modelos de IA:** Suporte a OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet) e Google Gemini

---

## 📦 Instalação e Execução

### Pré-requisitos
- Node.js 18+ (recomendado Node.js 20+)
- Python 3.11+
- Playwright instalado (`playwright install chromium`)

### 1. Aplicação Next.js (SaaS Principal)

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Rodar servidor de desenvolvimento
npm run dev
```
Acesse em: [http://localhost:3000](http://localhost:3000)

### 2. Agente Minerador Autônomo (Python WebUI)

```bash
cd web-ui
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install

# Iniciar servidor do agente
python webui.py --ip 127.0.0.1 --port 7788
```
Acesse a interface isolada em: [http://localhost:7788](http://localhost:7788) (ou use a aba nativa **Minerador Agente** dentro do SaaS).

---

## 🔒 Segurança

- Arquivos `.env`, chaves de API (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) e credenciais do banco **não são versionados** no repositório.
- A pasta de uploads locais e downloads multimídia (`/public/uploads/`) é mantida fora do versionamento por padrão.

---

## 📄 Licença

Uso proprietário e confidencial.
