-- De onde saiu a voz da saudacao em cada batida.
--
-- Motivo: "as vezes nao sai a voz" e queixa, nao medida. E ja aconteceu neste
-- projeto de uma correcao parecer certa por meses sem nunca ter funcionado --
-- o aquecimento das redes de reconhecimento aquecia um quarto do trabalho e
-- ninguem sabia, porque nada media.
--
--   despensa   frase e MP3 prontos de antes de alguem chegar. Deve dominar.
--   cache      frase diferente da guardada, mas o audio ja estava em memoria.
--   rede       teve que buscar o MP3 na hora, com alguem esperando na tela.
--   navegador  caiu na voz do sistema. No WebView do Fully Kiosk isso e quase
--              sempre silencio, entao qualquer aparicao aqui e um problema.
--   nenhuma    nao falou nada.
--
-- Nao guarda o texto da saudacao nem nada sobre a pessoa: so o nome do caminho.
--
-- Roda uma vez, no SQL Editor do Supabase. IF NOT EXISTS: rodar de novo nao
-- quebra nada.
ALTER TABLE diagnostico_reconhecimento
  ADD COLUMN IF NOT EXISTS origem_voz text;
