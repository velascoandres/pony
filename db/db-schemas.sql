PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- 1. SUPPLIERS — un registro por RUC (caché del padrón SRI)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    ruc               TEXT PRIMARY KEY CHECK (length(ruc) = 13),
    legal_name        TEXT NOT NULL,        -- razón social
    trade_name        TEXT,                 -- nombre comercial
    status            TEXT,                 -- 'ACTIVO' | 'SUSPENDIDO' (valores SRI)
    economic_activity TEXT,                 -- actividad económica del padrón
    default_category  TEXT CHECK (default_category IN
                        ('VIVIENDA','SALUD','EDUCACION','ALIMENTACION',
                         'VESTIMENTA','TURISMO','NEGOCIO','NO_DEDUCIBLE')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 2. INVOICES — cabecera del comprobante
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id                INTEGER PRIMARY KEY,
    access_key        TEXT NOT NULL UNIQUE CHECK (length(access_key) = 49),
    supplier_ruc      TEXT NOT NULL REFERENCES suppliers(ruc),
    branch_code       TEXT,                 -- estab del XML: "002"
    invoice_number    TEXT NOT NULL,        -- "002-030-000123456"
    issue_date        TEXT NOT NULL,        -- ISO "2026-06-14"
    subtotal          REAL NOT NULL,        -- totalSinImpuestos
    vat               REAL NOT NULL DEFAULT 0,   -- IVA
    total             REAL NOT NULL,        -- importeTotal
    is_balanced       INTEGER NOT NULL DEFAULT 1 CHECK (is_balanced IN (0,1)),
    process_status    TEXT NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (process_status IN
                          ('PENDIENTE','CLASIFICADA','EN_REVISION')),
    processed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_ruc);

-- ---------------------------------------------------------------------
-- 3. INVOICE_LINES — detalle + clasificación en la misma fila
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_lines (
    id             INTEGER PRIMARY KEY,
    invoice_id     INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number    INTEGER NOT NULL,
    description    TEXT NOT NULL,
    quantity       REAL NOT NULL,
    unit_price     REAL NOT NULL,
    subtotal       REAL NOT NULL,           -- precioTotalSinImpuesto
    vat_rate       REAL DEFAULT 0,          -- 0, 12, 15
    vat_amount     REAL NOT NULL DEFAULT 0,
    -- Clasificación (la escribe el Paso 3 o el agent loop)
    tax_category   TEXT CHECK (tax_category IN
                     ('VIVIENDA','SALUD','EDUCACION','ALIMENTACION',
                      'VESTIMENTA','TURISMO','NEGOCIO','NO_DEDUCIBLE')),
    is_deductible  INTEGER DEFAULT 0 CHECK (is_deductible IN (0,1)),
    method         TEXT CHECK (method IN ('REGLA','LLM','HUMANO')),
    confidence     REAL CHECK (confidence BETWEEN 0 AND 1),
    UNIQUE (invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_lines_invoice ON invoice_lines(invoice_id);
-- Cola del agente = líneas sin clasificar
CREATE INDEX IF NOT EXISTS idx_lines_pending
    ON invoice_lines(id) WHERE tax_category IS NULL;

-- =====================================================================
-- CONSULTAS DE REPORTE
-- =====================================================================

-- Cola del agente (pendientes de clasificar):
--   SELECT l.id, l.description, l.subtotal, i.supplier_ruc
--   FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
--   WHERE l.tax_category IS NULL;

-- Gastos deducibles por rubro y mes (para la declaración):
--   SELECT strftime('%Y-%m', i.issue_date) AS month, l.tax_category,
--          SUM(l.subtotal) AS base, SUM(l.vat_amount) AS vat
--   FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
--   WHERE l.is_deductible = 1 AND i.is_balanced = 1
--   GROUP BY month, l.tax_category;

-- Gasto por establecimiento:
--   SELECT s.trade_name, i.branch_code,
--          COUNT(*) AS invoices, SUM(i.total) AS total
--   FROM invoices i JOIN suppliers s ON s.ruc = i.supplier_ruc
--   GROUP BY s.ruc, i.branch_code;