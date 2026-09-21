# Documentação do Motor de Scoring e Inteligência — Offer Miner

## 1. Visão Geral e Princípios Fundamentais

O **Offer Miner** opera sob um princípio inegociável: **dados incompletos não podem ser transformados em certezas matemáticas ou garantias de ROI**.

O sistema distingue com precisão quatro camadas de dados:
1. **Dado Coletado**: Informações brutas extraídas da planilha minerada (preço, volume de ads, criativos, datas, URLs).
2. **Dado Calculado**: Métricas derivadas por fórmulas transparentes e determinísticas (Discovery Score, dias rodando, completude).
3. **Dado Histórico**: Sequência temporal de capturas reais (`offer_snapshots`).
4. **Interpretação**: Classificações de prioridade e tendências de mercado.

Nenhuma nota ou métrica é gerada por dados fictícios ou mocks. Se um dado não estiver presente, a pontuação atribuída é `0` ou `null`.

---

## 2. Validação Técnica (`validation_status`)

A validação técnica responde exclusivamente à pergunta: **"A oferta atende aos critérios objetivos de um infoproduto Low-Ticket viável?"**

> [!IMPORTANT]
> Uma oferta `VALIDADA` **não** significa garantia de alta conversão, lucro ou ROI. Significa apenas conformidade com as regras operacionais da estratégia.

### Critérios de Validação:
- **Tipo de Produto**: Produto Digital / Infoproduto (Ebook, Curso, Template, Planilha, etc.)
- **Faixa de Preço**: Entre **R$ 10,00** e **R$ 50,00**
- **Volume de Ads Ativos**: Entre **5** e **50** anúncios ativos
- **Longevidade**: Entre **10** e **30** dias rodando
- **Operação Faceless**: `faceless = true` (sem influenciador / especialista pessoal)
- **Página de Vendas**: URL de Landing Page presente e válida

### Status Possíveis:
- `VALIDADA`: Todos os critérios obrigatórios foram preenchidos e estão dentro das faixas estabelecidas.
- `REVISAR`: Um ou mais dados obrigatórios estão ausentes ou nulos (ex: preço nulo, dias rodando ausente). O sistema não reprova automaticamente.
- `FORA_DOS_CRITERIOS` (ou `INVALIDA`): Todos os dados existem, mas um ou mais parâmetros falharam (ex: preço R$ 97,00, 3 ads ativos ou 60 dias rodando).

---

## 3. Discovery Score (0 a 100 pontos)

Utilizado no momento da **primeira captura** de uma oferta minerada. Representa o quão atraente a oferta aparenta ser com base exclusivamente nos sinais observáveis no momento da descoberta.

### Composição e Pesos:

| Componente | Peso Máximo | Descrição |
| :--- | :---: | :--- |
| **Volume de Ads Ativos** | **35 pts** | Avalia o esforço de tráfego dentro da janela de escala low-ticket. |
| **Tempo Rodando (Longevidade)** | **25 pts** | Avalia a validação de esteira pelo tempo que a oferta sobreviveu ativa. |
| **Criativos Únicos Estimados** | **15 pts** | Quantidade de abordagens/variações criativas distintas. |
| **Completude dos Dados** | **10 pts** | Proporção de campos obrigatórios/essenciais preenchidos na mineração. |
| **Nota do Minerador (Work Score)** | **15 pts** | Avaliação qualitativa inicial atribuída pelo minerador (0–10 normalizada para 0–15). |
| **TOTAL** | **100 pts** | Pontuação composta determinística. |

---

### Detalhamento das Fórmulas:

#### A. Volume de Anúncios Ativos (35 pts)
Alvo ideal: 5 a 50 anúncios ativos.
- **31 a 40 ads**: `35 pts` (faixa ótima de escala para low-ticket)
- **21 a 30 ads**: `32 pts`
- **41 a 50 ads**: `32 pts`
- **13 a 20 ads**: `26 pts`
- **8 a 12 ads**: `18 pts`
- **5 a 7 ads**: `10 pts`
- **Menos de 5 ou mais de 50 ads**: `0 pts` (fora da tese de escala saudável ou saturação extrema)
- **Ausente / Null**: `0 pts`

#### B. Tempo Rodando (25 pts)
Alvo ideal: 10 a 30 dias de sobrevivência contínua.
- **18 a 24 dias**: `25 pts` (ponto ideal de maturação: validada no tráfego sem saturação)
- **25 a 30 dias**: `22 pts`
- **13 a 17 dias**: `18 pts`
- **10 a 12 dias**: `12 pts`
- **0 a 9 dias** ou **31+ dias**: `0 pts`
- **Ausente / Null**: `0 pts`

#### C. Quantidade de Criativos Diferentes (15 pts)
- **11+ criativos**: `15 pts`
- **7 a 10 criativos**: `11 pts`
- **4 a 6 criativos**: `7 pts`
- **1 a 3 criativos**: `3 pts`
- **Ausente / Null**: `0 pts` (não inferido a partir de `active_ads_count`)

#### D. Completude dos Dados (10 pts)
Avalia 15 campos cruciais:
1. `product_name`
2. `advertiser`
3. `niche`
4. `subniche`
5. `product_type`
6. `price`
7. `active_ads_count`
8. `oldest_ad_date`
9. `days_running`
10. `faceless`
11. `meta_ads_url`
12. `landing_page_url`
13. `headline`
14. `ad_format`
15. `estimated_unique_creatives`

$$\text{Completeness Score} = \left( \frac{\text{campos preenchidos}}{15} \right) \times 10$$

#### E. Nota do Minerador / Work Score (15 pts)
Normalização da nota do agente minerador (escala 0 a 10):
$$\text{Work Score Pts} = \left( \frac{\text{work\_score}}{10} \right) \times 15$$
Se ausente: `0 pts`.

---

### Classificação de Prioridade do Discovery Score:
- **90 a 100**: `EXCEPCIONAL`
- **80 a 89**: `FORTE`
- **70 a 79**: `INTERESSANTE`
- **60 a 69**: `OBSERVAR`
- **Abaixo de 60**: `BAIXA PRIORIDADE`

---

## 4. Momentum Score (0 a 100 pontos)

> [!WARNING]
> O Momentum Score **NUNCA** é calculado para ofertas com apenas 1 snapshot temporal.

Para existir Momentum real, a oferta precisa ter **no mínimo 2 snapshots capturados em datas diferentes**.

### Fórmulas de Momentum:
Sejam $\text{Ads}_{\text{atual}}$ o volume do snapshot mais recente e $\text{Ads}_{\text{anterior}}$ o volume do snapshot imediatamente anterior.

$$\Delta_{\text{ads}} = \text{Ads}_{\text{atual}} - \text{Ads}_{\text{anterior}}$$
$$\text{Growth \%} = \left( \frac{\Delta_{\text{ads}}}{\text{Ads}_{\text{anterior}}} \right) \times 100$$

### Classificação Visual:
- **+50% ou mais**: `CRESCENDO FORTE`
- **+15% a +49%**: `CRESCENDO`
- **-14% a +14%**: `ESTÁVEL`
- **-15% ou menos**: `CAINDO`
- **Apenas 1 captura**: `SEM HISTÓRICO` (`Aguardando nova captura`)

### Pontuação Numérica do Momentum:
- $\ge +100\%$: `100 pts`
- $+50\%$ a $+99\%$: `85 pts`
- $+25\%$ a $+49\%$: `70 pts`
- $+10\%$ a $+24\%$: `60 pts`
- $-9\%$ a $+9\%$: `50 pts`
- $-10\%$ a $-24\%$: `35 pts`
- $\le -25\%$: `15 pts`

---

## 5. Opportunity Score (0 a 100 pontos)

O **Opportunity Score** é o indicador unificado final que pondera os fundamentos iniciais da oferta com sua tração real ao longo do tempo.

### Regra de Ouro:
Se a oferta não possui histórico temporal ($\text{Snapshots} < 2$), o `opportunity_score` é **estritamente `null`**, e a plataforma exibe o `Discovery Score` com o status `"Aguardando histórico"`.

### Fórmula:
Quando $\text{Momentum}$ está disponível:
$$\text{Opportunity Score} = \text{round}\Big( (\text{Discovery Score} \times 0.70) + (\text{Momentum Score} \times 0.30) \Big)$$

#### Exemplo de Ciclo Completo:
1. **Primeira Captura (12/09)**:
   - 26 Ads (32 pts), 21 Dias (25 pts), 12 Criativos (15 pts), 90% Completude (9 pts), Work Score 8 (12 pts).
   - $\text{Discovery Score} = 93 / 100$.
   - $\text{Momentum} = \text{null}$ ("Aguardando nova captura").
   - $\text{Opportunity} = \text{null}$.

2. **Segunda Captura (17/09)**:
   - Volume de Ads subiu de 26 para 35 (+34.6%).
   - $\text{Momentum Visual} = \text{CRESCENDO}$.
   - $\text{Momentum Score} = 70 / 100$.
   - $\text{Opportunity Score} = (93 \times 0.70) + (70 \times 0.30) = 65.1 + 21.0 = 86.1 \rightarrow \mathbf{86 / 100}$.

---

## 6. Persistência de Snapshots (`offer_snapshots`)

A cada importação de lote ou atualização via planilha:
1. Os dados mestres em `offers` são atualizados.
2. Um novo registro imutável é inserido em `offer_snapshots` com os campos:
   - `id`
   - `offer_id`
   - `active_ads_count`
   - `estimated_unique_creatives`
   - `price`
   - `days_running`
   - `oldest_ad_date`
   - `captured_at`
   - `import_batch_id`
3. O histórico nunca é apagado.
4. Os scores de Momentum e Opportunity são recalculados com base no histórico real.
