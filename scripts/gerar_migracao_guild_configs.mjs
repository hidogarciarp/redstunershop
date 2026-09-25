import fs from 'fs';

const config = JSON.parse(fs.readFileSync('C:/Users/Garrido/botreds/config.json', 'utf8'));
const guildId = '1388165063155646524';
const guildName = "A RED'S Tunershop";

// Function to escape string for SQL literals
function escapeSql(str) {
  return "'" + str.replace(/'/g, "''") + "'";
}

const sql = `-- ==============================================================================
-- CRIAÇÃO E MIGRAÇÃO DA TABELA guild_configs
-- Execute este script no SQL Editor do seu novo Supabase:
-- https://supabase.com/dashboard/project/sxrfkbjbyjdmyyxbzobb/sql/new
-- ==============================================================================

-- 1. Cria a estrutura da tabela guild_configs
CREATE TABLE IF NOT EXISTS public.guild_configs (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    guild_icon TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    foto1 JSONB DEFAULT '{}'::jsonb,
    foto2 JSONB DEFAULT '{}'::jsonb,
    foto3 JSONB DEFAULT '{}'::jsonb,
    foto4 JSONB DEFAULT '{}'::jsonb,
    foto5 JSONB DEFAULT '{}'::jsonb,
    hierarquia JSONB DEFAULT '{}'::jsonb,
    advertencias JSONB DEFAULT '{}'::jsonb,
    suggestion_count INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Desabilita RLS para permitir leitura e escrita pelo bot e dashboard
ALTER TABLE public.guild_configs DISABLE ROW LEVEL SECURITY;

-- 2. Insere os dados completos de configuração do servidor
INSERT INTO public.guild_configs (
    guild_id,
    guild_name,
    guild_icon,
    settings,
    foto1,
    foto2,
    foto3,
    foto4,
    foto5,
    hierarquia,
    advertencias,
    suggestion_count,
    updated_at
)
VALUES (
    ${escapeSql(guildId)},
    ${escapeSql(guildName)},
    NULL,
    ${escapeSql(JSON.stringify(config.settings))}::jsonb,
    ${escapeSql(JSON.stringify(config.foto1))}::jsonb,
    ${escapeSql(JSON.stringify(config.foto2))}::jsonb,
    ${escapeSql(JSON.stringify(config.foto3))}::jsonb,
    ${escapeSql(JSON.stringify(config.foto4))}::jsonb,
    ${escapeSql(JSON.stringify(config.foto5))}::jsonb,
    ${escapeSql(JSON.stringify(config.hierarquia))}::jsonb,
    ${escapeSql(JSON.stringify(config.advertencias))}::jsonb,
    ${config.suggestionCount || 0},
    NOW()
)
ON CONFLICT (guild_id) DO UPDATE SET
    guild_name = EXCLUDED.guild_name,
    settings = EXCLUDED.settings,
    foto1 = EXCLUDED.foto1,
    foto2 = EXCLUDED.foto2,
    foto3 = EXCLUDED.foto3,
    foto4 = EXCLUDED.foto4,
    foto5 = EXCLUDED.foto5,
    hierarquia = EXCLUDED.hierarquia,
    advertencias = EXCLUDED.advertencias,
    suggestion_count = EXCLUDED.suggestion_count,
    updated_at = NOW();
`;

fs.writeFileSync('C:/Users/Garrido/registro-servicos/scripts/migrar_guild_configs.sql', sql, 'utf8');
console.log('Script SQL gerado com sucesso em C:/Users/Garrido/registro-servicos/scripts/migrar_guild_configs.sql');
