
-- Adicionar coluna de data de admissão na tabela de usuários
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_admissao DATE;

-- Comentário opcional para organização
COMMENT ON COLUMN usuarios.data_admissao IS 'Data em que o funcionário foi admitido para controle de isenção de taxas.';
