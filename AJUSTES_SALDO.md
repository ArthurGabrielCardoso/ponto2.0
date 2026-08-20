# Funcionalidade de Ajuste Manual de Saldos

## Visão Geral

Esta funcionalidade permite editar manualmente os saldos de horas (saldo do dia e saldo total do mês) através do modal de edição de registros de ponto.

## Como Usar

### 1. Abrir o Modal de Edição

1. Acesse o calendário semanal de um funcionário
2. Clique no ícone de edição (🖊️) em qualquer dia para abrir o modal de edição

### 2. Editar os Saldos

No modal de edição, você encontrará duas seções:

#### Seção de Registros de Ponto (parte superior)
- Edite normalmente os horários de entrada e saída
- Adicione ou remova registros conforme necessário

#### Seção de Edição Manual de Saldos (parte inferior)
- **Saldo do Dia**: Permite ajustar o saldo de horas específico daquele dia
- **Saldo Total do Mês**: Permite ajustar o saldo acumulado do mês

### 3. Formato de Entrada

- Use o formato: `±HH:MM`
- Exemplos válidos:
  - `+02:30` (2 horas e 30 minutos positivos)
  - `-01:15` (1 hora e 15 minutos negativos)
  - `00:00` (saldo zero)

### 4. Salvar as Alterações

- Clique em "Salvar Alterações" para aplicar tanto os registros quanto os ajustes de saldo
- Os ajustes serão salvos no banco de dados e aplicados imediatamente

## Indicadores Visuais

### Asterisco (*)
- Dias com ajustes manuais exibem um asterisco (*) ao lado do saldo
- Isso indica que o valor foi modificado manualmente

### Cores dos Saldos
- 🟢 Verde: Saldo positivo (horas extras)
- 🔴 Vermelho: Saldo negativo (horas devidas)
- ⚪ Cinza: Saldo zero

## Estrutura do Banco de Dados

### Tabela: `ajustes_saldo`

```sql
CREATE TABLE ajustes_saldo (
    id SERIAL PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    data TEXT NOT NULL, -- formato DD/MM/YYYY
    saldo_dia_original INTEGER NOT NULL, -- em minutos
    saldo_dia_ajustado INTEGER NOT NULL, -- em minutos
    saldo_total_original INTEGER NOT NULL, -- em minutos
    saldo_total_ajustado INTEGER NOT NULL, -- em minutos
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(funcionario_id, data)
);
```

## Funcionalidades Técnicas

### 1. Persistência
- Os ajustes são salvos na tabela `ajustes_saldo`
- Cada funcionário pode ter um ajuste por dia
- Ajustes existentes são atualizados automaticamente

### 2. Carregamento Automático
- Os ajustes são carregados automaticamente quando o calendário é exibido
- A aplicação busca ajustes para todos os dias da semana atual

### 3. Aplicação dos Ajustes
- Os saldos ajustados substituem os valores calculados automaticamente
- Apenas os valores com ajustes são modificados
- Dias sem ajustes continuam usando o cálculo automático

### 4. Histórico
- Todos os ajustes mantêm o valor original e o valor ajustado
- Inclui timestamp de criação e última atualização
- Campo opcional para motivo do ajuste

## Casos de Uso

### 1. Correção de Erros de Cálculo
- Quando o sistema calcula incorretamente devido a registros atípicos
- Para ajustar discrepâncias em horários especiais

### 2. Compensação de Horas
- Registro manual de trabalho externo não capturado pelo sistema
- Compensação por reuniões ou atividades fora do escritório

### 3. Ajustes Administrativos
- Correções solicitadas pelo RH
- Ajustes retroativos autorizados pela gerência

## Avisos e Cuidados

### ⚠️ Aviso Importante
A edição manual sobrescreve os cálculos automáticos. Use com cuidado e apenas para correções específicas.

### 🔒 Permissões
- Esta funcionalidade deve ser restrita a usuários autorizados
- Recomenda-se implementar logs de auditoria para controle

### 📝 Documentação
- Sempre documente o motivo dos ajustes
- Mantenha registros das alterações para auditoria

## Scripts de Instalação

Execute o script SQL em `scripts/create_ajustes_saldo_table.sql` para criar a tabela necessária no banco de dados.

```bash
# No Supabase ou PostgreSQL
psql -f scripts/create_ajustes_saldo_table.sql
```