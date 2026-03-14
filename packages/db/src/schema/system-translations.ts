import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';

// Database-driven i18n — composite PK (key, namespace, locale)
// No tenant_id: translations are global system resources
export const system_translations = pgTable(
  'system_translations',
  {
    key: text('key').notNull(),
    namespace: text('namespace').notNull(),
    locale: text('locale').notNull(),
    value: text('value').notNull(),
  },
  (table) => [primaryKey({ columns: [table.key, table.namespace, table.locale] })],
);

export type SystemTranslation = typeof system_translations.$inferSelect;
export type NewSystemTranslation = typeof system_translations.$inferInsert;
