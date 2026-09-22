# Arquitetura das 4 Tabelas Centralizadas da Cidade (Data Lakehouse)

Este documento descreve a nova camada centralizada de dados da cidade, projetada para alimentar tanto o **site exclusivo da RED'S** quanto o **site da Administração da Cidade** em paralelo, sem quebrar nenhuma funcionalidade em produção.

---

## 1. Visão Geral das 4 Tabelas Centralizadas

| Tabela | Função / Conteúdo | Total Registros | Mecânicas Atendidas |
| :--- | :--- | :---: | :--- |
| **`log_ponto`** | Sessões inteligentes de ponto auditadas | **1.647** | Reds (897), Vespucci (293), Harmony (280), Dudark (177) |
| **`log_tunagem`** | Modificações de veículos com valores pagos | **3.022** | Reds, Harmony, Dudark, Vespucci |
| **`log_bancada`** | Fabricação de peças e crafts | **7.841** | Reds, Dudark, Vespucci |
| **`log_bau`** | Movimentações de armazém (guardou/retirou) | **51.470** | Todas as oficinas da cidade |

---

## 2. Padrão de Identificação de Mecânica (`mecanica_id`)

Todas as tabelas usam a coluna padronizada `mecanica_id`:
* `'reds'` ➔ RED'S Tunershop
* `'harmony'` ➔ Harmony Custom
* `'dudark'` ➔ Dudark Motors
* `'vespucci'` ➔ Vespucci / Beach Tunershop

---

## 3. Como Consultar nos Frontends

### A. No Site Exclusivo da RED'S:
Basta adicionar o filtro `.eq('mecanica_id', 'reds')`:
```javascript
// Buscar sessões de ponto da Reds
const { data } = await supabase
  .from('log_ponto')
  .select('*')
  .eq('mecanica_id', 'reds')
  .order('entrada', { ascending: false });

// Buscar tunagens da Reds
const { data: tunagens } = await supabase
  .from('log_tunagem')
  .select('*')
  .eq('mecanica_id', 'reds');
```

### B. No Site da Administração da Cidade:
Consultas agregadas e comparativos funcionam com um único `GROUP BY mecanica_id`:

```javascript
// 1. Comparativo de horas trabalhadas por oficina
const { data } = await supabase
  .from('log_ponto')
  .select('mecanica_id, total_minutos')
  .gte('data', '2026-09-08')
  .lte('data', '2026-09-15');

// 2. Faturamento e repasse de 80% das tunagens
const { data: repasses } = await supabase
  .from('log_tunagem')
  .select('mecanica_id, valor_pago')
  .gte('data', '2026-09-08')
  .lte('data', '2026-09-15');
```

---

## 4. Scripts de Automação Disponíveis

* **Carga Inicial / Reprocessamento Geral:**
  * [`scripts/alimentar_tabelas_unificadas.mjs`](file:///c:/Users/Garrido/registro-servicos/scripts/alimentar_tabelas_unificadas.mjs)
* **Script DDL SQL:**
  * [`migracoes/criar_tabelas_unificadas_cidade.sql`](file:///c:/Users/Garrido/registro-servicos/migracoes/criar_tabelas_unificadas_cidade.sql)
