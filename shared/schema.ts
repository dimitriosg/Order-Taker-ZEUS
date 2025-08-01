import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { index } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["waiter", "cashier", "manager"]);
export const orderStatusEnum = pgEnum("order_status", ["paid", "in-prep", "ready", "served"]);
export const tableStatusEnum = pgEnum("table_status", ["free", "occupied"]);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Updated users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").notNull().default("waiter"),
  assignedTables: integer("assigned_tables").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull().unique(),
  name: text("name"), // Custom name for the table (optional)
  status: tableStatusEnum("status").notNull().default("free"),
});

export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  category: text("category").notNull(),
  image: text("image"),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableNumber: integer("table_number").notNull(),
  status: orderStatusEnum("status").notNull().default("paid"),
  waiterId: varchar("waiter_id").references(() => users.id),
  cashierId: varchar("cashier_id").references(() => users.id),
  paid: boolean("paid").notNull().default(false),
  cashReceived: real("cash_received"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  assignedTables: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ordersAsWaiter: many(orders, { relationName: "waiter" }),
  ordersAsCashier: many(orders, { relationName: "cashier" }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  waiter: one(users, { 
    fields: [orders.waiterId], 
    references: [users.id],
    relationName: "waiter"
  }),
  cashier: one(users, { 
    fields: [orders.cashierId], 
    references: [users.id],
    relationName: "cashier"
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { 
    fields: [orderItems.orderId], 
    references: [orders.id] 
  }),
  menuItem: one(menuItems, { 
    fields: [orderItems.menuItemId], 
    references: [menuItems.id] 
  }),
}));

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  orderItems: many(orderItems),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type Table = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
