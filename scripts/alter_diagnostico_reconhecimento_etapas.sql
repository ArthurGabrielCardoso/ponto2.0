-- Quatro colunas que ABREM dois numeros que hoje escondem o que importa.
--
-- Motivo: a telemetria diz "ate identificar: 2673 ms" e "sorriu ate a tela:
-- 2343 ms". Nenhum dos dois e acionavel:
--
--   "ate identificar" soma o tempo da PESSOA (aparecer na camera, decidir
--   tocar na tela) com o tempo do TABLET (os passes completos). Cortar 1 s
--   desse numero nao quer dizer nada se metade dele era alguem encostando o
--   dedo.
--
--   "sorriu ate a tela" soma o passe completo de confirmacao (~925 ms) com o
--   pulso da moldura (220 ms) e o render da tela de sucesso. Sobra ~1,2 s sem
--   explicacao, e enquanto for um numero so nao da para saber qual metade
--   atacar.
--
-- Chutar onde esses 1,2 s estao seria repetir o erro que deixou este projeto
-- "otimizado" e lento ao mesmo tempo. Estas colunas medem em vez de chutar.
--
--   ms_ate_tocar                 rosto aparece -> toque na tela   (PESSOA)
--   ms_do_toque_ate_identificar  toque -> identificada            (TABLET)
--   ms_sorriso_ate_confirmar     sorriso -> identidade confirmada (REDE NEURAL)
--   ms_confirmar_ate_tela        confirmada -> tela de sucesso    (RENDER)
--
-- Roda uma vez, no SQL Editor do Supabase. IF NOT EXISTS: rodar de novo nao
-- quebra nada.
ALTER TABLE diagnostico_reconhecimento
  ADD COLUMN IF NOT EXISTS ms_ate_tocar integer,
  ADD COLUMN IF NOT EXISTS ms_do_toque_ate_identificar integer,
  ADD COLUMN IF NOT EXISTS ms_sorriso_ate_confirmar integer,
  ADD COLUMN IF NOT EXISTS ms_confirmar_ate_tela integer;
