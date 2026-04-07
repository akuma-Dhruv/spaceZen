import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull(),
  storageId: integer("storage_id").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  tags: text("tags").array().notNull().default([]),
  customFields: jsonb("custom_fields").notNull().default({}),
  locationPathIds: integer("location_path_ids").array().notNull().default([]),
  locationPathNames: text("location_path_names").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
