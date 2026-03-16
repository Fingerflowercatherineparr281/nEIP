# Changelog

## [0.3.0] - 2026-03-16

### Added
- MCP Server expanded: 13 → 53 tools (list + create + action + report for all modules)
- 63 business flow tests verified (test_all_flows.sh)

### Fixed
- Invoice void: now accepts posted status + payment guard prevents voiding paid invoices
- CLI: auth login piped stdin TTY detection
- CLI: invoice/payment/bill response shape (items vs data)
- CLI: tax/roles/webhooks flat array handling
- CLI: settings response unwrapping
- CLI: AR paths /ar/invoices → /invoices
- All 34 CLI commands verified passing

## [0.2.0] - 2026-03-16

### Added
- MCP Server (`apps/mcp`) — 13 tools for AI integration via Model Context Protocol
- Architecture diagram + Test plan document (346 test cases)

### Fixed
- Web UI data binding: null safety (BigInt ?? 0), status mapping (void→voided)
- 16 Web UI pages fixed
- Auth hydration: protected layout waits for zustand rehydrate
- Rate limiter: 10,000 req/min in dev mode

### Changed
- Sidebar redesigned: SAP-style grouped menus (bilingual Thai+EN)
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
