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
import { eq, and, gte, lt } from "drizzle-orm";

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
  updateTableName(id: string, name: string): Promise<Table>;

  // Menu Items
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItemsByCategory(category: string): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, updates: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;
  getCategories(): Promise<string[]>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrderById(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: "paid" | "in-prep" | "ready" | "served"): Promise<Order[]>;
  updateOrderStatus(id: string, status: "paid" | "in-prep" | "ready" | "served", cashierId?: string): Promise<Order>;
  getOrdersByWaiter(waiterId: string): Promise<Order[]>;

  // Order Items
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]>;
  deleteOrderItemsByMenuItemId(menuItemId: string): Promise<void>;
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

  async updateMenuItem(id: string, updates: Partial<InsertMenuItem>): Promise<MenuItem> {
    const [item] = await db
      .update(menuItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return item;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await db
      .delete(menuItems)
      .where(eq(menuItems.id, id));
  }

  async deleteOrderItemsByMenuItemId(menuItemId: string): Promise<void> {
    await db
      .delete(orderItems)
      .where(eq(orderItems.menuItemId, menuItemId));
  }

  async getCategories(): Promise<string[]> {
    const results = await db
      .selectDistinct({ category: menuItems.category })
      .from(menuItems)
      .orderBy(menuItems.category);
    return results.map(r => r.category);
  }

  // Helper to generate custom order ID in format DD-TT-NNNN
  private async generateOrderId(tableNumber: number): Promise<string> {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const table = tableNumber.toString().padStart(2, '0');
    
    // Get today's orders to determine next sequence number
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, todayStart),
          lt(orders.createdAt, todayEnd)
        )
      );
    
    const nextSequence = (todayOrders.length + 1).toString().padStart(4, '0');
    return `${day}-${table}-${nextSequence}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Generate custom order ID
    const customId = await this.generateOrderId(insertOrder.tableNumber);
    
    const [order] = await db
      .insert(orders)
      .values({ ...insertOrder, id: customId })
      .returning();
    return order;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: {
          with: {
            menuItem: true,
          },
        },
      },
    });
    return order as Order | undefined;
  }

  async getAllOrders(): Promise<Order[]> {
    const ordersWithItems = await db.query.orders.findMany({
      with: {
        items: {
          with: {
            menuItem: true,
          },
        },
        waiter: true,
      },
    });
    return ordersWithItems as Order[];
  }

  async getOrdersByStatus(status: "paid" | "in-prep" | "ready" | "served"): Promise<Order[]> {
    const ordersWithItems = await db.query.orders.findMany({
      where: eq(orders.status, status),
      with: {
        items: {
          with: {
            menuItem: true,
          },
        },
        waiter: true,
      },
    });
    return ordersWithItems as Order[];
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
    const ordersWithItems = await db.query.orders.findMany({
      where: eq(orders.waiterId, waiterId),
      with: {
        items: {
          with: {
            menuItem: true,
          },
        },
        waiter: true,
      },
    });
    return ordersWithItems as Order[];
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