# Offer Miner AI Gateway — Universal AI Integration Layer

O **Offer Miner AI Gateway** é a camada universal de integração que expõe a inteligência do Offer Miner para qualquer cliente ou agente de Inteligência Artificial (**Gemini Spark, Gemini CLI, Antigravity, Cursor, Claude, Claude Code, Claude Desktop, IDEs compatíveis com MCP, agentes proprietários e aplicações REST/OpenAPI**).

---

## 🏗️ Arquitetura de Transporte Universal

```
                             OFFER MINER SAAS
                                    │
                                    ▼
                         SERVICES & REPOSITORIES
                                    │
                                    ▼
                          SHARED AI TOOL LAYER
                 (src/lib/ai-tools/ - 15 Read-Only Tools)
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    MCP STREAMABLE HTTP         MCP STDIO              REST READ-ONLY
      (/api/mcp route)        BRIDGE (Node)             (/api/ai/*)
            │                       │                       │
            ▼                       ▼                       ▼
  - Gemini Spark (OAuth)    - Cursor (Local stdio)    - Agentes sem MCP
  - Antigravity (Remote)    - Gemini CLI (Local)      - OpenAPI / Functions
  - Claude Remote           - Claude Code (Local)     - Custom Pipelines
  - Cursor Remote           - Claude Desktop (Local)  - REST clients
```

---

## 🔑 Autenticação Híbrida (OAuth 2.1 + Static Bearer Token)

O gateway implementa a estratégia de **Autenticação Híbrida**:

1. **OAuth 2.1 (RFC 9728 / Supabase Auth)**:
   - Exigido pelo **Gemini Spark** e clientes MCP de produção.
   - O Supabase Auth atua como **Authorization Server** (OpenID Discovery em `https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration`).
   - O Offer Miner MCP atua como **Resource Server**, descobrível via `/.well-known/oauth-protected-resource` (RFC 9728).
   - Respostas unauthenticated `401` incluem o cabeçalho:
     `WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_URL>/.well-known/oauth-protected-resource"`
   - A página de consentimento e aprovação do usuário está disponível em `/oauth/consent`.
2. **Static Bearer Token (`OFFER_MINER_MCP_TOKEN`)**:
   - Mantido para compatibilidade total com Cursor, Antigravity, scripts CLI locais e testes.

---

## ⚙️ Passos Manuais de Configuração no Supabase Dashboard

Para habilitar a descoberta de autorização OAuth 2.1 pelo Gemini Spark:

1. Acesse o **Supabase Dashboard** do seu projeto: `https://supabase.com/dashboard`
2. Vá em **Authentication** -> **OAuth Server** (ou **Settings > Auth**).
3. Ative a chave: **Enable OAuth 2.1 Server**.
4. Defina a **Authorization Path** para: `/oauth/consent`
5. Ative a opção: **Dynamic Client Registration (DCR) Enabled**.
6. Salve as alterações.

---

## 🧰 As 15 Ferramentas de IA Compartilhadas

1. `search_offers`: Busca ofertas no catálogo com filtros factuais.
2. `get_offer`: Retorna os detalhes normalizados de uma oferta específica por ID.
3. `get_offer_context`: Retorna o contexto de inteligência normalizado da oferta em 3 níveis (`summary`, `standard`, `deep`).
4. `list_creatives`: Lista os criativos (vídeos/imagens) com URLs de mídia, headlines e datas.
5. `get_creative`: Consulta detalhes completos de um criativo pelo ID.
6. `get_landing_page_analysis`: Consulta a análise estruturada da LP.
7. `get_checkout_analysis`: Consulta a inteligência do Checkout e order bumps.
8. `compare_offers`: Compara factualmente **no máximo 3 ofertas** lado a lado.
9. `get_dashboard_stats`: Consulta estatísticas agregadas do catálogo.
10. `get_mapping_status`: Verifica o status do mapeamento automático.
11. `search_deep_dives`: Busca dossiês salvos na Oficina de Inteligência.
12. `get_deep_dive`: Retorna o dossiê completo.
13. `search_insights`: Consulta a biblioteca de insights cadastrados.
14. `search_patterns`: Busca padrões comerciais e de copy.
15. `get_offer_history`: Retorna o histórico de capturas (snapshots).

---

## 🌐 Transportes Suportados

### 1. MCP Streamable HTTP (Remoto & Local)
- **Endpoint Local**: `http://localhost:3000/api/mcp`
- **Endpoint Remoto HTTPS**: `https://sua-url-publica.com/api/mcp` (`MCP_PUBLIC_URL`)
- **Discovery Metadata**: `/.well-known/oauth-protected-resource`

### 2. MCP STDIO Bridge (Local sem HTTP público)
- **Comando npm**: `npm run mcp:stdio`

### 3. REST API Read-Only & Especificação OpenAPI 3.0
- **Especificação OpenAPI 3.0**: `GET /api/ai/openapi.json`
- **Endpoints REST**: `/api/ai/*`

---

## 🧪 Diagnóstico e Validação do OAuth 2.1

- **Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource`
- **OAuth Challenge 401 Check**: `POST /api/mcp` (sem token, verifica cabeçalho `WWW-Authenticate`)
- **Self-Test OAuth Completo**: `POST /api/mcp/test` (corpo `{"target": "oauth"}`)
