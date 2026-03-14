/**
 * @neip/db — Drizzle ORM schemas, DB client, and test utilities.
 */

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------
export {
  tenants,
  users,
  roles,
  permissions,
  role_permissions,
  user_roles,
  system_translations,
  domain_events,
  chart_of_accounts,
  budgets,
  journal_entries,
  journal_entry_lines,
  document_sequences,
  fiscal_years,
  fiscal_periods,
  audit_logs,
  hitl_queue,
  vendors,
  bills,
  bill_line_items,
  bill_payments,
  webhooks,
  notification_preferences,
  notification_log,
  tax_rates,
} from './schema/index.js';

export type {
  Tenant,
  NewTenant,
  User,
  NewUser,
  Role,
  NewRole,
  Permission,
  NewPermission,
  RolePermission,
  NewRolePermission,
  UserRole,
  NewUserRole,
  SystemTranslation,
  NewSystemTranslation,
  DomainEventRow,
  NewDomainEventRow,
  ChartOfAccount,
  NewChartOfAccount,
  Budget,
  NewBudget,
  JournalEntry,
  NewJournalEntry,
  JournalEntryLine,
  NewJournalEntryLine,
  DocumentSequence,
  NewDocumentSequence,
  FiscalYear,
  NewFiscalYear,
  FiscalPeriod,
  NewFiscalPeriod,
  AuditLog,
  NewAuditLog,
  HitlQueueRow,
  NewHitlQueueRow,
  Vendor,
  NewVendor,
  Bill,
  NewBill,
  BillLineItem,
  NewBillLineItem,
  BillPayment,
  NewBillPayment,
  Webhook,
  NewWebhook,
  NotificationPreference,
  NewNotificationPreference,
  NotificationLog,
  NewNotificationLog,
  TaxRateRow,
  NewTaxRateRow,
} from './schema/index.js';

// ---------------------------------------------------------------------------
// Database client
// ---------------------------------------------------------------------------
export { createClient } from './client.js';
export type { DbClient, DbSchema } from './client.js';

// ---------------------------------------------------------------------------
// Test utilities (tree-shaken in production — only imported in test files)
// ---------------------------------------------------------------------------
export {
  setupTestDb,
  teardownTestDb,
  truncateAll,
  seedTestData,
} from './test-utils.js';

export type {
  TestTenant,
  TestUser,
  TestRole,
  TestPermission,
  SeedResult,
} from './test-utils.js';
