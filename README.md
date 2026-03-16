# nEIP — AI-Native ERP for Thai SMEs

**next-generation Enterprise Resource Planning** ระบบบริหารจัดการธุรกิจสำหรับ SME ไทย

## Quick Start

```bash
# 1. Start database
docker compose up -d db

# 2. Install & build
pnpm install && pnpm run build

# 3. Run migrations
PGPASSWORD=neip psql -h localhost -p 5433 -U neip -d neip \
  -f packages/db/migrations/0000_initial_schema.sql \
  -f packages/db/migrations/0001_domain_events.sql \
  -f packages/db/migrations/0002_complete_schema.sql \
  -f packages/db/migrations/0003_quotations.sql \
  -f packages/db/migrations/0004_sales_purchase_documents.sql \
  -f packages/db/migrations/0005_financial_modules.sql \
  -f packages/db/migrations/0006_inventory_hr_crm.sql \
  -f packages/db/migrations/0007_compliance_fixes.sql

# 4. Setup environment
cp .env.example .env

# 5. Start API (port 5400)
node apps/api/dist/index.js

# 6. Start Web UI (port 3100)
pnpm --filter web dev -- -p 3100
```

## Access

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3100 |
| API Docs (Swagger) | http://localhost:5400/api/docs |
| CLI | `node apps/cli/dist/index.js --help` |

## Architecture

```
┌─ Clients ─────────────────────────────┐
│ Web UI (Next.js 15) │ CLI │ Swagger  │
├─ API Gateway ─────────────────────────┤
│ Fastify 5.8 · 186 endpoints · JWT    │
│ RBAC 140 perms · Audit Trail auto-log│
├─ Shared Packages ─────────────────────┤
│ @neip/shared · @neip/core · @neip/db │
│ @neip/ai · @neip/tax                 │
├─ Business Modules (SAP Equivalent) ──┤
│ FI: GL·AR·AP·Assets·Bank·WHT·Tax    │
│ SD: QT→SO→DO→Invoice→Receipt→CN      │
│ MM: PO→Bill→Payment · Inventory      │
│ HR: Employee·Dept·Payroll·Leave      │
│ CO: Cost Center·Profit Center·Budget │
│ CRM: Contacts · Reports · Dashboard  │
├─ Infrastructure ──────────────────────┤
│ PostgreSQL 17 · 58 tables · RLS      │
│ pg-boss · Docker · Pino logging      │
└───────────────────────────────────────┘
```

## Modules (31 SAP-equivalent)

| Module | Description | API | Web | CLI |
|--------|-------------|:---:|:---:|:---:|
| FI-GL | General Ledger | ✓ | ✓ | ✓ |
| FI-AR | Accounts Receivable | ✓ | ✓ | ✓ |
| FI-AP | Accounts Payable | ✓ | ✓ | ✓ |
| FI-AA | Fixed Assets | ✓ | ✓ | ✓ |
| FI-BL | Bank Reconciliation | ✓ | ✓ | ✓ |
| FI-TV | WHT Certificate (ภ.ง.ด.) | ✓ | ✓ | ✓ |
| FI-TX | Tax Engine (VAT/WHT) | ✓ | ✓ | ✓ |
| CO | Cost/Profit Center + Budget | ✓ | ✓ | ✓ |
| SD-QT | Quotation | ✓ | ✓ | ✓ |
| SD-SO | Sales Order | ✓ | ✓ | ✓ |
| SD-DO | Delivery Note | ✓ | ✓ | ✓ |
| SD-INV | Invoice | ✓ | ✓ | ✓ |
| SD-RC | Receipt | ✓ | ✓ | ✓ |
| SD-CN | Credit Note | ✓ | ✓ | ✓ |
| SD-PAY | Payment | ✓ | ✓ | ✓ |
| MM-PO | Purchase Order | ✓ | ✓ | ✓ |
| MM-IM | Inventory/Stock | ✓ | ✓ | ✓ |
| MM-PR | Products | ✓ | ✓ | ✓ |
| HR | Employee/Dept/Payroll/Leave | ✓ | ✓ | ✓ |
| CRM | Contacts | ✓ | ✓ | ✓ |
| RPT | Reports + P&L Comparison | ✓ | ✓ | ✓ |
| DASH | Dashboard | ✓ | ✓ | ✓ |
| AUDIT | Audit Trail | ✓ | ✓ | ✓ |

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **API**: Fastify 5.8, TypeScript 5.x strict
- **Web**: Next.js 15.5, React 19, Tailwind CSS 4, Zustand, TanStack Query
- **CLI**: Commander.js
- **DB**: PostgreSQL 17, Drizzle ORM, RLS multi-tenant
- **AI**: BaseAgent, Invoice Matching, HITL Queue
- **Tax**: VAT 7%, WHT (8 types), Buddhist Era dates
- **Auth**: argon2id, JWT (1hr access + 30d refresh)
- **Queue**: pg-boss v12

## Thai Compliance

- VAT 7% with round-half-up (กรมสรรพากร)
- WHT by income type (ภ.ง.ด.3/53)
- Social Security 5% capped at 750 THB
- PDPA: PII masking, audit trail, employee anonymization
- TFAC Chart of Accounts standard
- Buddhist Era date support (พ.ศ.)

## License

Proprietary
