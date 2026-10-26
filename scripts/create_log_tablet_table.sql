-- Caixa-preta do tablet: um registro por EVENTO, nao por tentativa.
--
-- Motivo: `diagnostico_reconhecimento` so grava tentativas que tiveram pelo
-- menos um passe completo. Quando o reconhecimento morre de vez (GPU perde o
-- contexto, o worker trava, a camera congela) nao existe tentativa nenhuma, e
-- justamente o estado quebrado fica invisivel. Esta tabela grava o que
-- acontece AO REDOR das tentativas: erros, travamentos, reinicios do worker,
-- estado da camera, memoria, bateria, e um batimento a cada 2 minutos que
-- prova que o app estava vivo (a ausencia dele tambem e informacao).
--
-- Nao guarda biometria: nada de descritor, foto ou landmark. Nem nome de
-- funcionario. Quando ha funcionario, e so o id.
--
-- Roda uma vez, no SQL Editor do Supabase. IF NOT EXISTS: rodar de novo nao
-- quebra nada.
CREATE TABLE IF NOT EXISTS log_tablet (
    id BIGSERIAL PRIMARY KEY,
    criado_em TIMESTAMPTZ DEFAULT NOW(),   -- quando o servidor recebeu
    cliente_em TIMESTAMPTZ,                -- quando o tablet gerou (difere se ficou offline)
    sessao TEXT NOT NULL,                  -- uma por carga da pagina; separa um boot do outro
    seq INTEGER,                           -- ordem dentro da sessao; buraco = evento perdido
    nivel TEXT NOT NULL,                   -- 'info' | 'aviso' | 'erro' | 'fatal'
    evento TEXT NOT NULL,                  -- nome curto e estavel, ex.: 'worker_reiniciado'
    mensagem TEXT,
    detalhe JSONB,                         -- especifico do evento
    contexto JSONB                         -- retrato do tablet no instante: memoria, bateria, rede, camera...
);

CREATE INDEX IF NOT EXISTS idx_log_tablet_criado_em ON log_tablet(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_log_tablet_evento ON log_tablet(evento, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_log_tablet_sessao ON log_tablet(sessao, seq);

-- Mesmo regime das outras tabelas do app: o tablet escreve com a chave publica.
ALTER TABLE log_tablet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_tablet_insert" ON log_tablet;
CREATE POLICY "log_tablet_insert" ON log_tablet
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "log_tablet_select" ON log_tablet;
CREATE POLICY "log_tablet_select" ON log_tablet
    FOR SELECT TO anon, authenticated USING (true);

-- Limpeza: o batimento sozinho gera ~720 linhas por dia. Guarda 30 dias.
-- Rode isto de vez em quando, ou agende com pg_cron se a extensao estiver ligada:
--   DELETE FROM log_tablet WHERE criado_em < NOW() - INTERVAL '30 days';
