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
-- pin_situacao (segunda camada, independente da foto):
--   validado         digitou o PIN certo da pessoa escolhida
--   pessoa_sem_pin   a pessoa ainda nao tem PIN cadastrado (batida liberada,
--                    mas marcada para revisao)
--   indisponivel     o navegador nao conseguiu calcular o hash (contexto sem
--                    HTTPS); batida liberada e marcada
-- Um PIN errado NAO gera batida: a tela barra antes.
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
    pin_situacao TEXT,
    detalhe JSONB,                          -- distancias e, se divergente, com quem se parece
    verificado_em TIMESTAMPTZ,
    dispositivo TEXT
);

-- Quem rodou uma versao anterior deste script ganha a coluna aqui.
ALTER TABLE pontos_manuais ADD COLUMN IF NOT EXISTS pin_situacao TEXT;

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

-- ---------------------------------------------------------------------------
-- PIN de cada funcionario, para a batida manual.
--
-- Guarda so o HASH (PBKDF2-SHA256, salt proprio por pessoa), nunca o PIN. O
-- PIN e definido pelo responsavel em /dashboard/pins e conferido NO TABLET,
-- que precisa funcionar sem internet: por isso o hash e legivel pela chave
-- publica do app. LIMITE HONESTO: PIN de 4 a 6 digitos tem poucas combinacoes,
-- entao quem tiver a chave publica E conhecimento tecnico consegue descobri-lo
-- offline. O que o PIN impede de verdade e o colega parado na frente do
-- tablet (o tablet bloqueia depois de 3 erros). 6 digitos e bem melhor que 4.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pins_funcionarios (
    funcionario_id TEXT PRIMARY KEY,
    salt TEXT NOT NULL,            -- hex
    hash TEXT NOT NULL,            -- hex (PBKDF2-SHA256, 32 bytes)
    iteracoes INTEGER NOT NULL,
    tamanho INTEGER NOT NULL,      -- quantos digitos, para a tela saber quando conferir
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pins_funcionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pins_select" ON pins_funcionarios;
CREATE POLICY "pins_select" ON pins_funcionarios
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pins_insert" ON pins_funcionarios;
CREATE POLICY "pins_insert" ON pins_funcionarios
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pins_update" ON pins_funcionarios;
CREATE POLICY "pins_update" ON pins_funcionarios
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pins_delete" ON pins_funcionarios;
CREATE POLICY "pins_delete" ON pins_funcionarios
    FOR DELETE TO anon, authenticated USING (true);

-- O que precisa de olho humano. Divergente e sem_rosto sempre; "sem foto" e
-- "nao verificado" so quando o PIN tambem nao validou a pessoa.
CREATE OR REPLACE VIEW pontos_manuais_revisar AS
SELECT data_hora, nome_funcionario, tipo, situacao, pin_situacao, detalhe, foto_path
FROM pontos_manuais
WHERE situacao IN ('divergente', 'sem_rosto')
   OR (situacao IN ('sem_foto', 'nao_verificado', 'pendente') AND COALESCE(pin_situacao, '') <> 'validado')
ORDER BY data_hora DESC;

-- Para revisar:  SELECT * FROM pontos_manuais_revisar;
