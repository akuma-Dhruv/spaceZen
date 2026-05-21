import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storagesTable = pgTable("storages", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  pathIds: integer("path_ids").array().notNull().default([]),
  pathNames: text("path_names").array().notNull().default([]),
  imageUrl: text("image_url"),
  createdBy: text("created_by").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStorageSchema = createInsertSchema(storagesTable).omit({ id: true, createdAt: true });
export type InsertStorage = z.infer<typeof insertStorageSchema>;
export type Storage = typeof storagesTable.$inferSelect;
