import { 
  type User, 
  type UpsertUser,
  type Table, 
  type InsertTable, 
  type MenuItem, 
  type InsertMenuItem, 
  type Order, 
  type InsertOrder, 
  type OrderItem, 
  type InsertOrderItem, 
  users, 
  tables, 
  menuItems, 
  orders, 
  orderItems 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users - updated for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserTables(userId: string, assignedTables: number[]): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateStaff(id: string, updates: { name?: string; role?: string }): Promise<User>;
  deleteStaff(id: string): Promise<void>;

  // Tables
  getAllTables(): Promise<Table[]>;
  createTable(table: InsertTable): Promise<Table>;
  updateTableStatus(tableNumber: number, status: "free" | "occupied"): Promise<Table>;

  // Menu Items
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItemsByCategory(category: string): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrdersByStatus(status: "paid" | "in-prep" | "ready" | "served"): Promise<Order[]>;
  updateOrderStatus(id: string, status: "paid" | "in-prep" | "ready" | "served", cashierId?: string): Promise<Order>;
  getOrdersByWaiter(waiterId: string): Promise<Order[]>;

  // Order Items
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]>;
}

export class DatabaseStorage implements IStorage {
  // Users - updated for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserTables(userId: string, assignedTables: number[]): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ assignedTables })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllTables(): Promise<Table[]> {
    return await db.select().from(tables).orderBy(tables.number);
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const [table] = await db
      .insert(tables)
      .values(insertTable)
      .returning();
    return table;
  }

  async updateTableStatus(tableNumber: number, status: "free" | "occupied"): Promise<Table> {
    const [table] = await db
      .update(tables)
      .set({ status })
      .where(eq(tables.number, tableNumber))
      .returning();
    return table;
  }

  async removeTable(tableNumber: number): Promise<void> {
    await db
      .delete(tables)
      .where(eq(tables.number, tableNumber));
  }

  async updateTableName(id: string, name: string): Promise<Table> {
    const [table] = await db
      .update(tables)
      .set({ name: name.trim() || null })
      .where(eq(tables.id, id))
      .returning();
    return table;
  }

  async updateStaff(id: string, data: { name?: string; role?: string }): Promise<User> {
    const updateData: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.firstName = data.name.trim() || null;
    if (data.role !== undefined) updateData.role = data.role;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteStaff(id: string): Promise<void> {
    await db
      .delete(users)
      .where(eq(users.id, id));
  }

  async getAllMenuItems(): Promise<MenuItem[]> {
    return await db.select().from(menuItems);
  }

  async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.category, category));
  }

  async createMenuItem(insertItem: InsertMenuItem): Promise<MenuItem> {
    const [item] = await db
      .insert(menuItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(insertOrder)
      .returning();
    return order;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByStatus(status: "paid" | "in-prep" | "ready" | "served"): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.status, status));
  }

  async updateOrderStatus(id: string, status: "paid" | "in-prep" | "ready" | "served", cashierId?: string): Promise<Order> {
    const updateData: any = { status };
    if (cashierId) updateData.cashierId = cashierId;
    
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getOrdersByWaiter(waiterId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.waiterId, waiterId));
  }

  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db
      .insert(orderItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
}

export const storage = new DatabaseStorage();