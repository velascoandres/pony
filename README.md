# Pony — Ecuadorian Invoice Tax Classifier Agent

> ⚠️ **Educational project.** Pony was built for learning purposes — to explore how to
> build a tool-using LLM agent with [Effect](https://effect.website) and the Anthropic
> API. It is **not** tax advice and must not be used to file real tax declarations.

## Purpose

Pony is an AI agent that reads Ecuadorian electronic invoices (`file` in XML) and
classifies each line item into the personal-expense tax category defined by the SRI
(_Servicio de Rentas Internas_): `VIVIENDA`, `SALUD`, `EDUCACION`, `ALIMENTACION`,
`VESTIMENTA`, `TURISMO`, `NEGOCIO` or `NO_DEDUCIBLE`.

For every line the agent assigns:

- a **`taxCategory`** — one of the eight categories above,
- a **`confidence`** score between 0 and 1,
- a **`rationale`** — a one-sentence justification written _before_ deciding the category
  (it names the real good/service, ignores brand names, and reconstructs truncated text
  such as `MEMBRES-A` → `MEMBRESÍA`).

Lines whose confidence falls below `CONFIDENCE_THRESHOLD` are routed to a **conflict
report** for a human to review instead of being trusted blindly. Everything else is
persisted to a local SQLite database.

## Agent flow

```mermaid
flowchart TD
    A[Start: read every XML in invoices/] --> B[For each invoice]
    B --> C[parse_invoice_tool<br/>extract header + line items]
    C --> D{Description ambiguous?<br/>brand / membership / code}
    D -- yes --> E[get_fiscal_invoice_tool<br/>look up issuer RUC in SRI]
    D -- no --> F[Classify each line:<br/>write rationale, then<br/>taxCategory + confidence]
    E --> F
    F --> G[save_invoice_info_tool<br/>persist invoice to SQLite]
    G --> H{confidence &lt; threshold?}
    H -- yes --> I[Add line to conflict report]
    H -- no --> J[Trusted line]
    I --> K[Write reports/ CSV + summary]
    J --> K
    K --> L[End]
```

The reasoning/tool loop is capped at `MAX_TOOL_CALLS` iterations per invoice to avoid
runaway loops; `save_invoice_info_tool` is always the final step for each invoice.

## Requirements

- **Node.js** ≥ 22.13
- **pnpm** (`packageManager: pnpm@11.5.2`)
- An **Anthropic API key** (and optionally an OpenAI key)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create your environment file and fill in the keys
cp .env.template .env
#   edit .env → set ANTHROPIC_API_KEY, MODEL_PROVIDER, DB_PATH, etc.
```

Key environment variables (see [.env.template](.env.template)):

| Variable               | Purpose                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | API key for the Claude models                                 |
| `MODEL_PROVIDER`       | `anthropic` or `openai`                                        |
| `ANTHROPIC_MODEL`      | Model id (e.g. a Claude model)                                 |
| `DB_PATH`              | Path to the SQLite database (e.g. `./db/pony.db`)             |
| `MAX_TOOL_CALLS`       | Max tool iterations per invoice (loop guard)                  |
| `CONFIDENCE_THRESHOLD` | Below this, a line is sent to the conflict report for review  |

## Initialize the database

Create the SQLite schema before the first run:

```bash
pnpm init-db
```

This runs [src/db/init.ts](src/db/init.ts), which applies
[db/db-schemas.sql](db/db-schemas.sql) at the location given by `DB_PATH`.

> To start completely fresh, delete the database file (and its `-wal` / `-shm`
> siblings) and run `pnpm init-db` again — the app also recreates the schema on startup.

## Run

```bash
pnpm start      # process every invoice in invoices/ once
pnpm dev        # same, but restarts on file changes (watch mode)
```

## Project directories

| Directory     | Role                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `invoices/`   | **Input.** Drop the `invoice` XML files to be analyzed here.                   |
| `reports/`    | **Output.** The agent writes its analysis here.                               |
| `db/`         | SQLite database and the `db-schemas.sql` DDL.                                  |
| `src/`        | Agent, tools, services and schemas.                                           |

On each run the agent writes two files to `reports/`, timestamped:

- `conflicts-<timestamp>.csv` — one row per low-confidence line, with its `reason` and the
  agent's `rationale`, so a human can reconcile it against the source invoice.
- `summary-<timestamp>.json` — counts of classified vs. conflicting lines.

## Useful scripts

```bash
pnpm typecheck   # TypeScript type check (no emit)
pnpm check       # Biome lint + format (writes fixes)
pnpm build       # Compile to dist/
```

## Disclaimer

This repository is an educational exercise about LLM agents and Ecuadorian tax categories.
Classifications are produced by a language model, may be wrong, and should always be
reviewed by a person. It is not a substitute for professional tax advice.
