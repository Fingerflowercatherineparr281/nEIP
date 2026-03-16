import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * contacts — Unified customer + vendor (CRM) contact registry.
 *
 * contact_type: 'customer' | 'vendor' | 'both'
 */
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  contact_type: text('contact_type')
    .notNull()
    .$type<'customer' | 'vendor' | 'both'>()
    .default('customer'),
  code: text('code'),
  company_name: text('company_name').notNull(),
  contact_person: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  tax_id: text('tax_id'),
  branch_number: text('branch_number'),
  address_line1: text('address_line1'),
  address_line2: text('address_line2'),
  city: text('city'),
  province: text('province'),
  postal_code: text('postal_code'),
  country: text('country').notNull().default('TH'),
  payment_terms_days: integer('payment_terms_days').notNull().default(30),
  credit_limit_satang: integer('credit_limit_satang'),
  notes: text('notes'),
  is_active: boolean('is_active').notNull().default(true),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
