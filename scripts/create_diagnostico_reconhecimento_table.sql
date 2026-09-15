-- Telemetria do reconhecimento facial no tablet.
--
-- Existe para responder com dados, e não com palpite, três perguntas que hoje
-- só temos de forma anedótica:
--   1. Qual backend o tablet realmente usa (webgl, wasm ou cpu)?
--   2. Quanto tempo leva cada etapa, e onde vai o tempo da primeira batida
--      depois de horas parado?
--   3. Quão perto do limiar os reconhecimentos ficam? (a coluna menor_distancia
--      responde qual limiar seria o certo, sem precisar chutar)
--
-- UMA LINHA POR TENTATIVA, não por frame. O loop roda a ~5-10 quadros por
-- segundo; gravar frame a frame encheria a tabela e deixaria o tablet mais
-- lento justamente enquanto mede lentidão.
--
-- PRIVACIDADE, de propósito: esta tabela NÃO guarda descritor facial, foto,
-- landmark nem localização. Só medidas de tempo, contadores e a distância
-- numérica da comparação. Nada aqui reconstrói um rosto.

CREATE TABLE IF NOT EXISTS diagnostico_reconhecimento (
    id SERIAL PRIMARY KEY,
    criado_em TIMESTAMPTZ DEFAULT NOW(),

    -- Quem e o quê
    funcionario_id TEXT,              -- nulo quando ninguém chegou a ser identificado
    tipo_ponto TEXT,                  -- nulo quando a tentativa não virou batida
    desfecho TEXT NOT NULL,           -- 'ponto_batido' | 'desistiu' | 'nao_identificado'

    -- Ambiente do tablet
    backend TEXT,                     -- 'webgl' | 'wasm' | 'cpu'
    gpu TEXT,                         -- renderer do WebGL, para separar tablets
    user_agent TEXT,
    modo_teste BOOLEAN DEFAULT FALSE,

    -- Tempos da tentativa, em milissegundos
    ms_ate_identificar INTEGER,       -- rosto aparecer -> saber quem é
    ms_ate_sorrir INTEGER,            -- identificado -> sorriso detectado
    ms_ate_tela_sucesso INTEGER,      -- sorriso -> tela de ponto batido
    ms_total INTEGER,                 -- rosto aparecer -> fim da tentativa

    -- Onde o tempo foi gasto
    ms_passe_barato_p50 INTEGER,      -- detector + expressões
    ms_passe_completo_p50 INTEGER,    -- + landmarks + descritor 128D
    ms_consulta_registros INTEGER,    -- o Supabase; é aqui que aparece conexão fria
    ms_saudacao_ia INTEGER,

    -- Qualidade do reconhecimento
    passes_baratos INTEGER DEFAULT 0,
    passes_completos INTEGER DEFAULT 0,
    falhas_desconhecido INTEGER DEFAULT 0,  -- passe completo não bateu com ninguém
    perdas_identidade INTEGER DEFAULT 0,    -- identificação chegou a ser derrubada
    menor_distancia REAL,             -- melhor (menor) distância euclidiana obtida
    maior_distancia_aceita REAL,      -- a pior que ainda passou no limiar
    limiar_usado REAL                 -- para interpretar as duas colunas acima
);

CREATE INDEX IF NOT EXISTS idx_diag_reconhecimento_criado_em
    ON diagnostico_reconhecimento(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_diag_reconhecimento_funcionario
    ON diagnostico_reconhecimento(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_diag_reconhecimento_desfecho
    ON diagnostico_reconhecimento(desfecho);

COMMENT ON TABLE diagnostico_reconhecimento IS
    'Telemetria do reconhecimento facial. Uma linha por tentativa. Não guarda biometria.';
COMMENT ON COLUMN diagnostico_reconhecimento.menor_distancia IS
    'Menor distância euclidiana obtida na tentativa. É o número que diz qual limiar seria o correto.';
COMMENT ON COLUMN diagnostico_reconhecimento.ms_consulta_registros IS
    'Tempo da consulta ao Supabase. Valores altos na primeira batida do período indicam conexão fria.';
