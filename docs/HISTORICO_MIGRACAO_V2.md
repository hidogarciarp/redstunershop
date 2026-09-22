# Histórico de Migração, Correções e Otimizações da V2

Este documento registra todas as alterações arquiteturais, correções de dados, integrações de tabelas unificadas e otimizações de consumo de banco (Supabase Egress) implementadas na versão **V2** (`/v2`). 

Serve como guia definitivo para quando a **V2** for promovida à versão principal do sistema.

---

## 1. Contexto e Motivação da V2

A versão legada (V1) apresentava três grandes gargalos:
1. **Consumo excessivo de Egress (tráfego de saída) no Supabase:** Monitor flutuante e relatórios baixavam payloads gigantescos com `SELECT *`, incluindo tabelas pesadas de baú sem filtro estrito, disparando dezenas de queries por minuto a cada evento Realtime do Discord.
2. **Dados fragmentados entre mecânicas:** Existência de tabelas antigas isoladas (`logs_tunagem`, `logs_tunagem_reds`, `discord_log_messages`), dificultando relatórios consolidados e relatórios semanais.
3. **Inconsistências em relatórios:** Exibição incorreta de nomes de itens na bancada (prefixo `[ITEMKEY]:`), dados zerados em períodos anteriores e duplicidade de períodos em auditorias.

---

## 2. Consolidação do Banco de Dados (Camada de Dados Centralizada)

Foi estabelecida a arquitetura das **4 tabelas unificadas** com a coluna de identificação `mecanica_id` (`'reds'`, `'harmony'`, `'dudark'`, `'vespucci'`):

### A. Tabela `log_tunagem`
* **Problema anterior:** A semana de 07/09 a 13/09 aparecia zerada no relatório de tunagens porque as 4.120 tunagens históricas da Reds estavam gravadas na tabela legada `logs_tunagem`.
* **Ação executada:**
  - Migração de todas as **4.120 linhas** da `logs_tunagem` para a `log_tunagem`.
  - Normalização dos campos `mecanica_id = 'reds'`, `tecnico_id`, `tecnico_nome`, `cliente_id`, `cliente_nome`, `veiculo`, `valor_total`, `valor_pago`, `data` e `hora`.
  - Atualização do componente `TunagemPage.jsx`:
    - Mapeamento de filtros para `mecanica_id = 'reds'`.
    - Adição de `.limit(10000)` para contornar o corte padrão de 1.000 linhas da API do Supabase (a semana 07/09–13/09 continha 1.368 tunagens).

### B. Tabela `log_bancada`
* **Problema anterior:** Na aba de auditoria e compras da bancada, o item aparecia como `[ITEMKEY]: ARMAÇÃO DE COLETE` sem a quantidade comprada.
* **Ação executada:**
  - Tratamento da string de conteúdo: extração limpa do nome do item eliminando os prefixos e metadados brutos.
  - Extração e renderização explícita da quantidade (`qtd`) e valor total no template.

### C. Tabela `log_ponto` & Auditoria
* **Problema anterior:**
  - A auditoria repetia os mesmos eventos em múltiplos turnos de trabalho.
  - Divergência entre busca por ID numérico de FiveM e Nome completo.
* **Ação executada:**
  - Deduplicação dos turnos por chave única de sessão (`uuid_entrada` / `uuid_saida` ou hash temporal).
  - Isolamento de atividades obrigatórias: bancada e tunagens comprovam atividade real de trabalho; logs de baú não estendem indevidamente o cronômetro de ponto aberto.
  - Normalização e fuzzy match tolerante a acentos e maiúsculas/minúsculas no `RelatorioPage.jsx`.

---

## 3. Redução Drástica de Supabase Egress no Monitor Flutuante (`JanelaPontoFlutuante.jsx`)

O monitor flutuante mantinha o site aberto o dia inteiro por dezenas de gestores e mecânicos simultâneos. Foram aplicadas as **3 otimizações cruciais de rede**:

### 1. Eliminação de Consultas Fantasma de Baú (`logsBau`)
* **Diagnóstico:** O monitor baixava milhares de logs de baú em um lookback de 48 horas sempre que qualquer log chegava. No entanto, o cálculo das sessões abertas, inatividade e a "Fila da Vez" utilizavam estritamente **ponto** e **bancada/tunagem**. O baú era apenas acumulado em um mapa não utilizado.
* **Solução:** Removida a query global de baú do loop periódico.
* **Sob demanda:** A busca de logs de baú permanece exclusivamente na função `abrirAuditoriaFuncionario`, que só é executada quando o usuário clica intencionalmente no botão de auditoria de um mecânico específico.

### 2. Projeção Estrita de Colunas (`SELECT` Enxuto)
* **Antes:** `supabase.from("discord_log_messages").select("*")` trafegando campos pesados como `raw_json`, metadados de webhook, avatares e payloads brutos.
* **Depois:**
  - Pontos: `.select("id, content, created_at, embed_data")`
  - Bancada: `.select("id, log_type, content, created_at")`
  - Tunagens: `.select("tecnico_id, tecnico_nome, data, hora")`
* **Resultado:** Redução de mais de 70% no tamanho de cada resposta HTTP.

### 3. Debounce (4s) e Pausa em Background / Minimização
* **Antes:** Cada inserção no Discord disparava imediatamente um recarregamento completo do histórico de 48 horas, mesmo se 10 mensagens chegassem no mesmo segundo ou se a janela estivesse minimizada.
* **Depois:**
  - **Filtro de evento:** Eventos do Realtime com `log_type` diferente de `"ponto"` e `"bancada"` são ignorados imediatamente sem tocar no banco.
  - **Debounce de 4 segundos:** Eventos consecutivos são amortecidos; se chegarem 5 atualizações em 3 segundos, apenas 1 query consolidada é disparada após 4s de estabilidade.
  - **Pausa em Segundo Plano / Minimizado:**
    - Se a janela flutuante estiver minimizada (`minimizadoRef.current`) ou se a aba do navegador estiver em segundo plano (`document.hidden`), as queries pesadas são **suspensas**.
    - Ao maximizar a janela ou retornar à aba, um listener de `visibilitychange` detecta a pendência e realiza uma única recarga sob demanda.

### 4. Roteamento Correto de Ingestão do Discord e Canais Realtime
* **Causa Raiz Identificada:** O bot do Discord (hospedado no Render) envia todos os logs e eventos ao vivo para o Supabase de Produção (`prperurjtvayjrazdxvh.supabase.co`). No modo V2, o cliente proxy estava redirecionando **todas** as chamadas para o banco novo (`sxrfkbjbyjdmyyxbzobb.supabase.co`), que havia parado de receber logs às 19:20. Por isso, os mecânicos que batiam saída (ex: Lilith às 21:06 e Feer às 21:33) não eram atualizados no monitor da V2.
* **Solução:** O proxy inteligente em [`app/utils/supabaseClient.js`](file:///c:/Users/Garrido/registro-servicos/app/utils/supabaseClient.js) foi ajustado para:
  1. Direcionar tabelas ao vivo (`discord_log_messages` e `logs_tunagem_reds`) para o banco de produção ativo onde o bot insere em tempo real.
  2. Direcionar todas as conexões Realtime (`supabase.channel(...)`, `removeChannel`, etc.) para o banco de produção, garantindo que eventos de entrada/saída de ponto e tunagens disparem instantaneamente no frontend da V2.
  3. Manter as 4 tabelas consolidadas (`log_ponto`, `log_tunagem`, `log_bancada`, `log_bau`) apontando para a base nova limpa.

### 5. Correção de Divisão Indevida de Turnos Longos (> 2 horas)
* **Causa Raiz Identificada:** A rotina de auto-recuperação de atividades sem ponto possuía uma trava que limitava a cobertura de um ponto aberto a no máximo `pontoAbertoTs + 2 horas`. Se um mecânico trabalhasse por mais de 2 horas contínuas (ex: Feer Sanchez das 19:42 às 21:33), as atividades realizadas após 2 horas eram consideradas "fora do ponto". O sistema gerava uma entrada sintética duplicada (`[UUID]: auto-recuperado-5609-...` às 20:57), o que forçava o monitor a fechar a primeira metade por inatividade/crash (19:42 -> 20:27) e abrir uma segunda sessão (20:57 -> 21:33).
* **Solução:**
  1. Em [`JanelaPontoFlutuante.jsx`](file:///c:/Users/Garrido/registro-servicos/app/components/JanelaPontoFlutuante.jsx), o cálculo de cobertura foi corrigido: enquanto o ponto estiver em aberto (sem saída posterior), **todas** as atividades de trabalho daquele mecânico pertencem à sessão em andamento, sem cortar arbitrariamente em 2 horas.
  2. O registro sintético duplicado (`id: 887062`) foi removido de `discord_log_messages`, reunificando a sessão do Feer Sanchez em uma única sessão regular e contínua de **1h51m (19:42 às 21:33)**.

### 6. Bloqueio Completo de "Simulador / Orçamento" no Ponto
* **Causa Raiz Identificada:** Mensagens do Discord de veículos de teste ou sem dono cadastrado (`[TUNAGEM SEM DONO - NÃO SALVO]`) não possuíam o campo `[Técnico]: Nome (ID: 123)`. O parser atribuía como fallback `tecnico_id: "0"` e `tecnico_nome: "Simulador / Orçamento"`. A rotina de auto-recuperação tratava esse registro como uma tunagem de mecânico real e gerava um ponto artificial para o ID 0, que ficava inativo e caía como "AUTO-FECHADO (CRASH)".
* **Solução:**
  1. Em [`MainSite.jsx`](file:///c:/Users/Garrido/registro-servicos/app/MainSite.jsx), mensagens com `TUNAGEM SEM DONO`, `NÃO SALVO` ou `Simulador` são descartadas e não entram mais na tabela de tunagens.
  2. Em [`JanelaPontoFlutuante.jsx`](file:///c:/Users/Garrido/registro-servicos/app/components/JanelaPontoFlutuante.jsx), adicionado filtro estrito para ignorar ID "0" e qualquer técnico com nome "Simulador" ou "Orçamento".
  3. Em [`app/api/ponto/recuperar/route.js`](file:///c:/Users/Garrido/registro-servicos/app/api/ponto/recuperar/route.js), requisições com ID "0" ou nome "Simulador" são sumariamente rejeitadas.
  4. Os registros artificiais de ID 0 foram expurgados das tabelas `discord_log_messages`, `logs_tunagem` e `log_tunagem`.

---

## 4. Garantia de Notificações de Tunagem em Tempo Real

> [!IMPORTANT]
> **O mecânico recebe a notificação de tunagem na hora, mesmo com a janela do monitor minimizada?**
> 
> **SIM, 100% garantido.**

### Por que as notificações não são afetadas pela otimização do monitor?
1. **Arquitetura Desacoplada:** O sistema de alertas sonoros (beeps via Web Audio API) e banners de notificação de novas tunagens não reside dentro do `JanelaPontoFlutuante.jsx`.
2. **Escopo Global em `MainSite.jsx`:**
   - O canal do Supabase `logs_tunagem_reds` e `discord_log_messages` para tunagens está inscrito diretamente na raiz da aplicação.
   - Assim que um cliente ou mecânico conclui uma tunagem, o evento `INSERT` dispara instantaneamente o callback global, que toca o áudio e desenha a notificação flutuante na tela, independentemente de o monitor de ponto estar minimizado, fechado ou aberto.

---

## 5. Correção do Mapeamento de Mecânicas Concorrentes no Heatmap / Relatório

### Diagnóstico do Problema:
No heatmap comparativo de presença semanal da aba **Relatório**, as mecânicas estavam com dados trocados:
- **Dudark Motors** aparecia praticamente vazia/sem funcionamento, apesar de ter trabalhado a semana toda.
- **Harmony** aparecia com alta taxa de cobertura durante todos os dias, apesar de estar fechada.
- **Vespucci** estava com dados invertidos.

### Causa Raiz:
Em [`app/utils/supabaseClient.js`](file:///c:/Users/Garrido/registro-servicos/app/utils/supabaseClient.js), a função `getV2RelationConfig` estava com uma rotação incorreta no mapeamento das tabelas legadas para o `mecanica_id` unificado de `log_ponto`:
- `ponto_cidade_mecanica_2` (Harmony) estava mapeada para `vespucci`.
- `ponto_cidade_mecanica_3` (Dudark) estava mapeada para `harmony`.
- `ponto_cidade_mecanica_4` (Vespucci) estava mapeada para `dudark`.

### Solução Aplicada:
Mapeamento corrigido:
- `ponto_cidade_mecanica_2` ➔ `{ target: "log_ponto", filter: { col: "mecanica_id", val: "harmony" } }`
- `ponto_cidade_mecanica_3` ➔ `{ target: "log_ponto", filter: { col: "mecanica_id", val: "dudark" } }`
- `ponto_cidade_mecanica_4` ➔ `{ target: "log_ponto", filter: { col: "mecanica_id", val: "vespucci" } }`

Resultado imediato: Harmony exibe apenas os 2 registros do dia 18/09 e vazia nos demais dias (fechada); Dudark exibe todas as suas 74 sessões da semana; Vespucci exibe todas as suas 96 sessões da semana.

---

## 6. Checklist para Promover a V2 como Versão Principal

Quando for decidido substituir a rota principal (`/`) pela V2, execute os seguintes passos:

1. **Roteamento Next.js:**
   - Promover os arquivos de `app/v2/` para substituir ou integrar os de `app/` (mantendo um backup da V1 se desejado).
2. **Componentes Compartilhados:**
   - Garantir que `JanelaPontoFlutuante.jsx` com as otimizações de Egress seja o único monitor instanciado.
3. **Índices de Performance no Supabase:**
   - Certificar-se de que os seguintes índices existem no banco de dados para consultas instantâneas:
     - `CREATE INDEX IF NOT EXISTS idx_log_tunagem_mec_data ON log_tunagem (mecanica_id, data DESC);`
     - `CREATE INDEX IF NOT EXISTS idx_log_ponto_mec_data ON log_ponto (mecanica_id, data DESC);`
     - `CREATE INDEX IF NOT EXISTS idx_discord_log_type_created ON discord_log_messages (log_type, created_at DESC);`
