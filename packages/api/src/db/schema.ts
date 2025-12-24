import { pgTable, varchar, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

// ============================================
// Tenants (SaaS Customers)
// ============================================
export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 32 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 32 }).notNull().default('free'),
  apiKey: varchar('api_key', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// Widgets
// ============================================
export const widgets = pgTable('widgets', {
  id: varchar('id', { length: 32 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 32 }).notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// Visitors
// ============================================
export const visitors = pgTable('visitors', {
  id: varchar('id', { length: 32 }).primaryKey(),
  widgetId: varchar('widget_id', { length: 32 }).notNull().references(() => widgets.id),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  firstSeen: timestamp('first_seen').notNull().defaultNow(),
  lastSeen: timestamp('last_seen').notNull().defaultNow(),
});

// ============================================
// Conversations
// ============================================
export const conversations = pgTable('conversations', {
  id: varchar('id', { length: 32 }).primaryKey(),
  widgetId: varchar('widget_id', { length: 32 }).notNull().references(() => widgets.id),
  visitorId: varchar('visitor_id', { length: 32 }).notNull().references(() => visitors.id),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  metadata: jsonb('metadata').notNull().default({}),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
});

// ============================================
// Messages
// ============================================
export const messages = pgTable('messages', {
  id: varchar('id', { length: 32 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 32 }).notNull().references(() => conversations.id),
  role: varchar('role', { length: 16 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Type exports
export type TenantInsert = typeof tenants.$inferInsert;
export type TenantSelect = typeof tenants.$inferSelect;
export type WidgetInsert = typeof widgets.$inferInsert;
export type WidgetSelect = typeof widgets.$inferSelect;
export type VisitorInsert = typeof visitors.$inferInsert;
export type VisitorSelect = typeof visitors.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type ConversationSelect = typeof conversations.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
export type MessageSelect = typeof messages.$inferSelect;

