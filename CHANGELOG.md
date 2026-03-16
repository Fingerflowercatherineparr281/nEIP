# Changelog

## [0.2.0] - 2026-03-16

### Added
- MCP Server (`apps/mcp`) — 13 tools สำหรับ AI integration ผ่าน Model Context Protocol
- MCP tools: auth_login, dashboard, list_accounts, list_invoices, list_bills, list_contacts, list_products, list_employees, report_trial_balance, report_pnl, audit_logs, create_invoice, create_journal_entry
- Architecture diagram (`docs/architecture.excalidraw` + PNG)
- Test plan document (`docs/test-plan.md`) — 346 test cases, IPO-grade

### Fixed
- Web UI data binding: null safety (BigInt ?? 0), status mapping (void→voided)
- 16 Web UI pages fixed: invoices, bills, payments, journal-entries, quotations, sales-orders, delivery-notes, receipts, credit-notes, purchase-orders, bank, wht, budgets, fixed-assets, bills/[id], quotations/[id]
- Auth hydration: protected layout waits for zustand rehydrate
- Rate limiter: 10,000 req/min in dev mode
- CLI paths: removed wrong `/ar/`, `/ap/`, `/gl/` prefixes

### Changed
- Sidebar redesigned: SAP-style grouped menus (10 groups, collapsible, bilingual Thai+EN)
- README rewritten: explains EIP vs ERP, pain points, AI-Native approach
- API descriptions: 186/186 endpoints documented in Swagger

## [0.1.0] - 2026-03-15

### Added
- Initial release: 31 ERP modules
- 186 API endpoints (Fastify 5.8)
- 81 Web UI pages (Next.js 15)
- 39 CLI commands (Commander.js)
- 58 DB tables (PostgreSQL 17, RLS multi-tenant)
- Thai compliance: VAT 7%, WHT, SSC, PDPA, TFAC
- Audit trail: auto-log all mutations
- 417 unit tests passing

## [0.3.0] - 2026-03-16

### Added
- MCP Server expanded: 13 → 53 tools (list + create + action + report for all modules)

### Fixed
- CLI: auth login piped stdin TTY detection
- CLI: invoice/payment/bill response shape (items vs data)
- CLI: tax/roles/webhooks flat array handling
- CLI: settings response unwrapping
- CLI: AR paths /ar/invoices → /invoices
- All 34 CLI commands verified passing
