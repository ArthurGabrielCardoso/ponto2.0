-- Batida manual: a pessoa escolhe o proprio nome quando o reconhecimento
-- facial nao esta funcionando, e uma foto fica guardada como prova.
--
-- A batida em si continua indo para `registros_ponto`, pelo mesmo caminho e
-- pela mesma fila offline de sempre. Esta tabela guarda so a EVIDENCIA, e liga
-- as duas pelo par (funcionario_id, data_hora), que e identico nas duas.
-- Separar assim tem um motivo: se esta tabela ou o bucket nao existirem, ou o
-- upload falhar, o ponto continua sendo registrado normalmente.
--
-- situacao:
--   pendente        foto guardada, ainda nao comparada com o cadastro
--   confirmado      o rosto da foto bate com quem a pessoa disse ser
--   divergente      NAO bate (ou outra pessoa cadastrada parece mais com a
--                   foto). Revisar. `detalhe` diz com quem se parece.
--   sem_rosto       a foto nao tem um rosto detectavel. Revisar.
--   sem_foto        a camera nao deu foto (ou a foto se perdeu). Revisar.
--   nao_verificado  nao foi possivel comparar em 7 dias (ex.: funcionario sem
--                   rosto cadastrado). Revisar.
--
--
-- Nao guarda descritor facial. A foto fica no bucket privado
-- `fotos-ponto-manual`, que o tablet so consegue ESCREVER: ler, so pelo painel
-- do Supabase (Storage) ou por uma rota de servidor com a chave de servico.
--
-- Roda uma vez, no SQL Editor do Supabase. IF NOT EXISTS / DROP POLICY IF
-- EXISTS: rodar de novo nao quebra nada.

CREATE TABLE IF NOT EXISTS pontos_manuais (
    id UUID PRIMARY KEY,                    -- gerado no tablet: reenviar nao duplica
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    funcionario_id TEXT NOT NULL,
    nome_funcionario TEXT,
    tipo TEXT NOT NULL,                     -- o tipo da batida em registros_ponto
    data_hora TIMESTAMPTZ NOT NULL,         -- o mesmo instante gravado em registros_ponto
    foto_path TEXT,                         -- caminho no bucket; nulo apos a retencao
    situacao TEXT NOT NULL DEFAULT 'pendente',
    detalhe JSONB,                          -- distancias e, se divergente, com quem se parece
    verificado_em TIMESTAMPTZ,
    dispositivo TEXT
);

CREATE INDEX IF NOT EXISTS idx_pontos_manuais_data ON pontos_manuais(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_manuais_situacao ON pontos_manuais(situacao, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_manuais_func ON pontos_manuais(funcionario_id, data_hora DESC);

ALTER TABLE pontos_manuais ENABLE ROW LEVEL SECURITY;

-- Mesmo regime das outras tabelas do app: o tablet usa a chave publica. O
-- UPDATE existe porque a situacao e atualizada quando a comparacao do rosto
-- termina (pode ser horas depois, se o reconhecimento estava fora do ar).
DROP POLICY IF EXISTS "pontos_manuais_insert" ON pontos_manuais;
CREATE POLICY "pontos_manuais_insert" ON pontos_manuais
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pontos_manuais_update" ON pontos_manuais;
CREATE POLICY "pontos_manuais_update" ON pontos_manuais
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pontos_manuais_select" ON pontos_manuais;
CREATE POLICY "pontos_manuais_select" ON pontos_manuais
    FOR SELECT TO anon, authenticated USING (true);

-- Bucket PRIVADO, so JPEG, ate 2 MB por foto.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-ponto-manual', 'fotos-ponto-manual', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- O tablet so escreve. Sem policy de SELECT, ele nao lista nem baixa nada.
DROP POLICY IF EXISTS "fotos_manuais_insert" ON storage.objects;
CREATE POLICY "fotos_manuais_insert" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'fotos-ponto-manual');

-- Retencao de 90 dias. O tablet apaga as fotos vencidas sozinho, uma vez por
-- dia, pela API de Storage (apagar a linha de storage.objects por SQL NAO
-- remove o arquivo de verdade). Esta policy so permite apagar o que ja venceu.
DROP POLICY IF EXISTS "fotos_manuais_delete_vencidas" ON storage.objects;
CREATE POLICY "fotos_manuais_delete_vencidas" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'fotos-ponto-manual' AND created_at < NOW() - INTERVAL '90 days');

-- O que precisa de olho humano: tudo que nao foi confirmado pelo rosto.
-- (DROP antes de CREATE: se uma versao anterior deste script ja criou a visao
-- com outras colunas, CREATE OR REPLACE falharia.)
DROP VIEW IF EXISTS pontos_manuais_revisar;
CREATE VIEW pontos_manuais_revisar AS
SELECT data_hora, nome_funcionario, tipo, situacao, detalhe, foto_path
FROM pontos_manuais
WHERE situacao <> 'confirmado'
ORDER BY data_hora DESC;

-- Para revisar:  SELECT * FROM pontos_manuais_revisar;
-- (ou pelo painel: /dashboard/batidas-manuais)

-- Se voce chegou a rodar uma versao anterior com PIN, estes itens nao sao mais
-- usados e podem ser apagados:
--   DROP TABLE IF EXISTS pins_funcionarios;
--   ALTER TABLE pontos_manuais DROP COLUMN IF EXISTS pin_situacao;
