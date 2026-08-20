-- Tabela para armazenar ajustes manuais de saldo
CREATE TABLE IF NOT EXISTS ajustes_saldo (
    id SERIAL PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    data TEXT NOT NULL, -- formato DD/MM/YYYY 
    saldo_dia_original INTEGER NOT NULL, -- saldo original em minutos
    saldo_dia_ajustado INTEGER NOT NULL, -- saldo ajustado em minutos
    saldo_total_original INTEGER NOT NULL, -- saldo total original em minutos
    saldo_total_ajustado INTEGER NOT NULL, -- saldo total ajustado em minutos
    motivo TEXT, -- motivo do ajuste
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Índices para performance
    UNIQUE(funcionario_id, data)
);

-- Índice para buscas rápidas por funcionário
CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_funcionario ON ajustes_saldo(funcionario_id);

-- Índice para buscas por data
CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_data ON ajustes_saldo(data);

-- Comentários para documentação
COMMENT ON TABLE ajustes_saldo IS 'Armazena ajustes manuais de saldo de horas trabalhadas por funcionário e dia';
COMMENT ON COLUMN ajustes_saldo.funcionario_id IS 'ID do funcionário (referência à tabela funcionarios)';
COMMENT ON COLUMN ajustes_saldo.data IS 'Data do ajuste no formato DD/MM/YYYY';
COMMENT ON COLUMN ajustes_saldo.saldo_dia_original IS 'Saldo original do dia calculado automaticamente (em minutos)';
COMMENT ON COLUMN ajustes_saldo.saldo_dia_ajustado IS 'Saldo ajustado manualmente (em minutos)';
COMMENT ON COLUMN ajustes_saldo.saldo_total_original IS 'Saldo total original calculado automaticamente (em minutos)';
COMMENT ON COLUMN ajustes_saldo.saldo_total_ajustado IS 'Saldo total ajustado manualmente (em minutos)';
COMMENT ON COLUMN ajustes_saldo.motivo IS 'Motivo do ajuste manual';