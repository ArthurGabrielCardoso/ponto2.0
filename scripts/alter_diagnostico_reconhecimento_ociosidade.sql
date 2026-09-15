-- Tres colunas novas na tabela de diagnostico do reconhecimento.
--
-- Por que: a primeira linha real de telemetria mostrou 4,4 s por passe completo
-- e 648 ms ate no passe barato. Isso diz QUE esta lento, mas nao diz POR QUE
-- duas batidas seguidas sao instantaneas e a primeira depois de tres horas
-- parada demora. Estas colunas medem exatamente essa diferenca:
--
--   ms_ocioso_antes            quanto tempo a rede pesada ficou sem rodar
--   ms_desde_ultimo_ponto      intervalo desde a batida anterior no tablet
--   ms_primeiro_passe_completo o primeiro passe separado da mediana
--
-- Com isso da para cruzar "estava parado ha muito tempo" contra "demorou" e ver
-- se a relacao existe, em vez de continuar no palpite.
--
-- Roda uma vez, no SQL Editor do Supabase. IF NOT EXISTS: rodar de novo nao
-- quebra nada.
ALTER TABLE diagnostico_reconhecimento
  ADD COLUMN IF NOT EXISTS ms_ocioso_antes integer,
  ADD COLUMN IF NOT EXISTS ms_desde_ultimo_ponto integer,
  ADD COLUMN IF NOT EXISTS ms_primeiro_passe_completo integer;
