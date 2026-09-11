import { createClient } from '@supabase/supabase-js';

// URL e Key do Supabase antigo (de onde vamos ler)
const OLD_SUPABASE_URL = 'https://prperurjtvayjrazdxvh.supabase.co';
const OLD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0';

// Insira os dados do novo Supabase aqui
const NEW_SUPABASE_URL = 'https://usqwhhergsexrmlsfjcc.supabase.co';
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || '';

const oldClient = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
const newClient = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const TABLES = [
  "audit_logs",
  "blacklist",
  "candidaturas",
  "clientes",
  "config_vagas",
  "configuracoes",
  "curriculos",
  "discord_log_events",
  "discord_log_messages",
  "evento_equipes",
  "evento_membros",
  "guild_configs",
  "mechanics",
  "missao_participacoes",
  "missoes",
  "notificacoes",
  "pagamentos_semanais",
  "point_sessions",
  "ponto_cidade",
  "ponto_cidade_mecanica_2",
  "ponto_cidade_mecanica_3",
  "ponto_horas",
  "pontos",
  "profile_mechanics",
  "profiles",
  "registros",
  "servicos",
  "solicitacoes_ponto",
  "sugestoes",
  "ticket_transcripts",
  "triathlon_participantes",
  "usuarios",
  "usuarios_online",
  "vendas_drift_cidade",
  "vendas_nitro",
  "vendas_nitro_cidade",
  "votos_sugestoes"
];

async function migrate() {
  if (NEW_SUPABASE_URL.includes('COLE_AQUI')) {
    console.error('Erro: Por favor, preencha a URL e a Service Role Key do novo Supabase no script!');
    process.exit(1);
  }

  console.log('Iniciando copia de dados...\n');

  for (const table of TABLES) {
    console.log(`Copiando dados da tabela [${table}]...`);
    try {
      // 1. Obter dados da tabela antiga (usando paginacao de 1000 em 1000)
      let allRows = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await oldClient
          .from(table)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          throw new Error(`Erro ao ler da tabela antiga: ${error.message}`);
        }

        if (data && data.length > 0) {
          allRows.push(...data);
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`- Encontrados ${allRows.length} registros no Supabase antigo.`);

      if (allRows.length === 0) {
        console.log(`- Tabela [${table}] esta vazia. Pulando.\n`);
        continue;
      }

      // 2. Limpar dados existentes na tabela nova (opcional, para evitar duplicados)
      // Nota: Com service_role podemos fazer delete sem politicas de RLS atrapalharem.
      await newClient.from(table).delete().neq('id', 'dummy_value_non_existent').select().limit(1); 
      // Caso a tabela nao tenha campo 'id' ou de erro no delete acima, a gente tenta inserir direto.
      
      // 3. Inserir no novo Supabase em blocos para nao estourar limite de payload
      const chunkSize = 200;
      for (let i = 0; i < allRows.length; i += chunkSize) {
        const chunk = allRows.slice(i, i + chunkSize);
        const { error: insertError } = await newClient
          .from(table)
          .insert(chunk);

        if (insertError) {
          throw new Error(`Erro ao inserir lote na tabela nova: ${insertError.message}`);
        }
      }

      console.log(`✓ Todos os ${allRows.length} registros da tabela [${table}] foram migrados com sucesso!\n`);
    } catch (err) {
      console.error(`✗ Erro na tabela [${table}]:`, err.message, '\n');
    }
  }

  console.log('Migracao concluida!');
}

migrate();
