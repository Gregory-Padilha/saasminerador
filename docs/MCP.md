# Offer Miner MCP Server (v1.0 Read-Only & ChatGPT Ready)

O **Offer Miner MCP Server** implementa o protocolo **Model Context Protocol (MCP)** via Streamable HTTP / JSON-RPC 2.0, permitindo que o **ChatGPT**, **Cursor**, **Claude Desktop** e aplicações externas de IA se conectem ao Offer Miner e consultem **diretamente** os dados minerados e mapeados no SaaS.

---

## 🔒 Princípios de Segurança & Arquitetura

1. **READ-ONLY v1**: O servidor aceita **apenas consultas (queries)**. Nenhuma ferramenta de escrita, edição, exclusão ou inicialização de scraping é exposta nesta versão.
2. **Sem Acesso Direto ao Banco**: O MCP **NÃO** possui acesso ao código-fonte, **NÃO** expõe chaves do Supabase (`SUPABASE_SERVICE_ROLE_KEY`) e **NÃO** aceita comandos SQL arbitrários (`execute_sql`).
3. **Tools Controladas**: Toda consulta passa pela camada oficial de repositórios/serviços do SaaS (`dbService`, `dossier`, `checkout-intelligence`, etc.), garantindo que os dados retornados sigam a mesma **Fonte de Verdade** da interface gráfica.
4. **Execução no Servidor**: O MCP executa estritamente no ambiente Node server-side (`export const runtime = 'nodejs';`).
5. **Autenticação Obrigatória**: Requer cabeçalho `Authorization: Bearer <token>` com o token definido na variável `OFFER_MINER_MCP_TOKEN`.
6. **Proteção contra Rate Limit**: Limite simples de **120 requisições/minuto** por token.

---

## 🛠️ Configuração e Variáveis de Ambiente

No seu arquivo `.env` (ou `.env.local`), configure as seguintes variáveis:

```env
# Ativar Servidor MCP (padrão: true se token presente)
MCP_ENABLED=true

# Token de Autenticação para Clientes MCP (32+ caracteres recomendados)
OFFER_MINER_MCP_TOKEN=seu_token_secreto_mcp_aqui_12345

# URL pública HTTPS para ChatGPT e agentes em nuvem (Exige HTTPS)
MCP_PUBLIC_URL=https://mcp.meudominio.com/api/mcp
```

---

## 🌐 Endpoints

- **Endpoint Local**: `http://localhost:3000/api/mcp`
- **Endpoint Remoto / ChatGPT**: `https://sua-url-publica.com/api/mcp` (`MCP_PUBLIC_URL`)
- **Health Check**: `GET /api/mcp/health`
- **Self-Test Interno**: `POST /api/mcp/test` (com payload `{"target": "local"}` ou `{"target": "chatgpt"}`)

---

## 🤖 CONECTANDO AO CHATGPT

Para conectar o Offer Miner ao ChatGPT como um aplicativo customizado MCP / Custom Action:

### Requisitos Técnicos do ChatGPT:
1. **Endpoint Público HTTPS**: O ChatGPT exige estritamente protocolo `https://`. Endpoints HTTP em `localhost` não são acessíveis pela nuvem da OpenAI.
2. **Autenticação Bearer**: Deve incluir `Authorization: Bearer <OFFER_MINER_MCP_TOKEN>`.
3. **Transporte**: `Streamable HTTP / JSON-RPC 2.0`.
4. **15 Tools Read-Only**: O ChatGPT executará `initialize` e `tools/list` para descobrir os schemas.

### Como Testar o Endpoint Remoto antes de cadastrar no ChatGPT:

```bash
# 1. Health Check Remoto
curl -i https://sua-url-publica.com/api/mcp/health \
  -H "Authorization: Bearer SEU_OFFER_MINER_MCP_TOKEN"

# 2. Inicialização MCP via JSON-RPC 2.0
curl -X POST https://sua-url-publica.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_OFFER_MINER_MCP_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'

# 3. Listar as 15 Ferramentas
curl -X POST https://sua-url-publica.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_OFFER_MINER_MCP_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# 4. Executar busca de ofertas em escala
curl -X POST https://sua-url-publica.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_OFFER_MINER_MCP_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_offers",
      "arguments": {
        "scaleTier": ["FULL_SCALE"],
        "limit": 5
      }
    }
  }'
```

---

## 🧰 Ferramentas Disponíveis (15 Read-Only Tools)

| Nome da Tool | Descrição Resumida |
| :--- | :--- |
| `search_offers` | Busca ofertas com filtros factuais (nicho, ads ativos, preço, scale tier, LP/checkout mapeados, etc). Retorna resumos para economizar tokens. |
| `get_offer` | Consulta detalhes completos e estruturados de uma oferta específica pelo `offerId`. |
| `get_offer_context` | Retorna o contexto de inteligência normalizado de uma oferta em 3 níveis (`summary`, `standard`, `deep`). Ideal para análises estratégicas por IAs. |
| `list_creatives` | Lista os criativos de uma oferta (vídeos/imagens) com URLs de mídia, headlines e datas. Sem binários/base64. |
| `get_creative` | Obtém detalhes completos de um criativo pelo `creativeId`. |
| `get_landing_page_analysis` | Consulta a análise estruturada da Landing Page (headline, promessa, seções, preços na LP, garantias, FAQ, links). Sem HTML bruto. |
| `get_checkout_analysis` | Consulta a inteligência do Checkout (provider, preço base, parcelas, status mapeado e lista de order bumps). |
| `compare_offers` | Compara factualmente até **3 ofertas** simultaneamente (escala, preços, criativos, LP, checkout, copy). |
| `get_dashboard_stats` | Retorna estatísticas agregadas do catálogo (total de ofertas, ofertas por tier de escala, por nicho, médias de ads/preços, % mapeado). |
| `get_mapping_status` | Verifica o status do mapeamento automático de LP e checkout de uma oferta. |
| `search_deep_dives` | Busca dossiês e investigações salvas na Oficina de Inteligência de Ofertas. |
| `get_deep_dive` | Retorna os detalhes de um Deep Dive específico (hipóteses, notas, padrões, aprendizados). |
| `search_insights` | Consulta a biblioteca de insights cadastrados (preços, copy, mecânicas comerciais) por categoria, tags ou nicho. |
| `search_patterns` | Busca padrões recorrentes identificados na Oficina de Inteligência. |
| `get_offer_history` | Consulta o histórico de capturas (snapshots) de anúncios ativos, variação de criativos e estado de funil. |

---

## 💻 Exemplo de Conexão em Clientes Locais (Cursor / Claude Desktop)

```json
{
  "mcpServers": {
    "offer-miner": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer SEU_OFFER_MINER_MCP_TOKEN"
      }
    }
  }
}
```
