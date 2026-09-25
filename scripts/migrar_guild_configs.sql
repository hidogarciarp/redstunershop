-- ==============================================================================
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
    '1388165063155646524',
    'A RED''S Tunershop',
    NULL,
    '{"registrationRoles":["1486119706221088879","1486119705814106308"],"channels":{"hierarquia":"1486119707684765831","logs":"1494752861421175024","registros":"1495986018820821153","promocoes":"1486119707416334589","avisos":"1486119707164540955","exoneracoes":"1486119707416334591","advertencias":"1486119707416334590","sugestoes":"1486119707953332288","sugestoes2":"1486119707953332289","logsdms":"1501144689124839424"},"suggestionCount":0,"roles":{"estagiario":"1486119706221088879","mecanico":"1486119706221088880","mecanico_senior":"1486119706221088881","supervisor":"1486119706221088882","gerente":"1486119706221088883","gerente_rh":"1486119706221088883","gerente_geral":"1486119706221088884","chief":"1486119706221088885","dono":"1486119706221088885"},"customChannels":{"___canal_de_avisos":"1486119707164540955"},"customResponses":{},"tickets":{"global":{"limit":1,"transcriptsChannel":"","workingHours":{"enabled":false,"start":"09:00","end":"18:00","timezone":"America/Sao_Paulo","days":[1,2,3,4,5]},"feedbackSystem":true,"actionOutsideHours":"warn"},"panels":[]}}'::jsonb,
    '{"topo":"ESTAGIARIO","cor":"#ffffff","masculino":{"lista":"COLETE 72-1\nJAQUETA 371-8\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775646973254-5pmelgko.png"},"feminino":{"lista":"COLETE 70-1\nJAQUETA 390-8\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775643251443-06pjzton.png"}}'::jsonb,
    '{"topo":"MECANICO","cor":"#00e1ff","masculino":{"lista":"COLETE 72-1\nJAQUETA 371-4\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775646968590-lsth8ona.png"},"feminino":{"lista":"COLETE 70-1\nJAQUETA 390-4\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775643252943-n90vblpl.png"}}'::jsonb,
    '{"topo":"MECANICO SENIOR","cor":"#0011ff","masculino":{"lista":"COLETE 72-1\nJAQUETA 371-5\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775646969457-fhenn25v.png"},"feminino":{"lista":"COLETE 70-1\nJAQUETA 390-5\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775643250658-qpzqc2gj.png"}}'::jsonb,
    '{"topo":"SUPERVISOR & GG","cor":"#ff0000","masculino":{"lista":"COLETE 72-1\nJAQUETA 371-0\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775646971732-3bqopsgg.png"},"feminino":{"lista":"COLETE 70-1\nJAQUETA 390-0\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775643248585-8zza2334.png"}}'::jsonb,
    '{"topo":"CHIEF","cor":"#ff008c","masculino":{"lista":"COLETE 72-1\nJAQUETA 371-6\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775646970974-34e7o1y1.png"},"feminino":{"lista":"COLETE 70-1\nJAQUETA 390-6\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)","imagem_url":"https://media.r2rp.com/v1/files/1775643249907-bd979tww.png"}}'::jsonb,
    '{"estagiario":{"nome":"ESTAGIARIO","funcionarios":["Jhenn Horvat - 598 (325-946)","Peter Delacruz - 1086 (920-491)","Bianca Lobianchi - 2029 (854-898)","Matias Vaz - 1252 (030-852)","Siid Nascimento - 2960 (985-548)"],"requisitos":""},"mecanico":{"nome":"Mecânico","funcionarios":["Bruce Garcia - 2929 (282-393)","Dazai Bennett - 1895 (729-341)","David Orosco Diamond - 1596 (979-365)","Emilly Portinari - 2993 (476-711)","Gracinha Felix - 2099 (381-994)","Karol Kapoy - 2957 (579-068)","Natasha Duclair - 888 (016-944)","Xi Ning - 1601 (302-68)","Lucas Piccinato - 3503 (559-112)","Emilly Portinari - 2993 (476-711)","Luna M. M. P. Garcia - 2711 (407-808)"],"requisitos":""},"mecanico_senior":{"nome":"Mecânico Senior","funcionarios":["Mexicanica Benitez - 1259 (362-357)","Raniel Benitez - 1260 (525-109)","Roque Delacruz - 1314 (656-167)"],"requisitos":""},"supervisor":{"nome":"Supervisor","funcionarios":["• (VAGO)"],"requisitos":""},"gerente":{"nome":"Gerente","funcionarios":["Nik Veneza - 395 (104-816)","Theo Benitez - 1217 (115-044)"],"requisitos":""},"gerente_geral":{"nome":"Gerente Geral","funcionarios":["• Ragnar OConner - 505 (798-254)"]},"chief":{"nome":"Chief (DONOS)","funcionarios":["Hido Garcia - 643 (680-145)","Roberto Pombal - 427 (647-797)","Roger Macedo Monteiro Prado Garcia - 503 (458-143)"],"requisitos":""}}'::jsonb,
    '{}'::jsonb,
    0,
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
