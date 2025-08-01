import { 
  type User, 
  type UpsertUser,
  type Table, 
  type InsertTable, 
  type Category,
  type InsertCategory,
  type MenuItem, 
  type InsertMenuItem, 
  type Order, 
  type InsertOrder, 
  type OrderItem, 
  type InsertOrderItem, 
  users, 
  tables, 
  categories,
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
  updateStaff(id: string, updates: { name?: string; role?: string; password?: string }): Promise<User>;
  deleteStaff(id: string): Promise<void>;

  // Tables
  getAllTables(): Promise<Table[]>;
  createTable(table: InsertTable): Promise<Table>;
  updateTableStatus(tableNumber: number, status: "free" | "occupied"): Promise<Table>;
  updateTableName(id: string, name: string): Promise<Table>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category>;
  updateCategoryOrder(categoryOrders: { id: string; sortOrder: number }[]): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  getCategories(): Promise<string[]>; // Legacy method for backwards compatibility

  // Menu Items
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItemsByCategory(category: string): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, updates: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;

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

  async updateStaff(id: string, data: { name?: string; firstName?: string; lastName?: string; email?: string; role?: string; password?: string; profileImageUrl?: string }): Promise<User> {
    const updateData: any = { updatedAt: new Date() };
    
    // Handle legacy 'name' field or new firstName/lastName fields
    if (data.name !== undefined) updateData.firstName = data.name.trim() || null;
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim() || null;
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim() || null;
    if (data.email !== undefined) updateData.email = data.email.trim() || null;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    
    // Handle password if provided (passwords are handled differently in this demo system)
    if (data.password !== undefined) {
      // For this demo system, we don't actually store hashed passwords in the database
      // The authentication is handled through demo credentials in the routes
      console.log('Password update requested for user:', id);
    }

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

  // Categories
  async getAllCategories(): Promise<Category[]> {
    const results = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder, categories.name);
    return results;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [result] = await db
      .insert(categories)
      .values(category)
      .returning();
    return result;
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category> {
    const [result] = await db
      .update(categories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result;
  }

  async updateCategoryOrder(categoryOrders: { id: string; sortOrder: number }[]): Promise<void> {
    for (const { id, sortOrder } of categoryOrders) {
      await db
        .update(categories)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(categories.id, id));
    }
  }

  async deleteCategory(id: string): Promise<void> {
    await db
      .delete(categories)
      .where(eq(categories.id, id));
  }

  // Legacy method for backwards compatibility
  async getCategories(): Promise<string[]> {
    // First try to get from categories table (ordered)
    const orderedCategories = await db
      .select({ name: categories.name })
      .from(categories)
      .orderBy(categories.sortOrder, categories.name);
    
    if (orderedCategories.length > 0) {
      // Also get categories that exist in menu items but not in categories table
      const menuCategories = await db
        .selectDistinct({ category: menuItems.category })
        .from(menuItems);
      
      const categoriesFromTable = orderedCategories.map(c => c.name);
      const menuCategoriesList = menuCategories.map(c => c.category);
      
      // Add any menu categories that aren't in the categories table
      const missingCategories = menuCategoriesList.filter(c => !categoriesFromTable.includes(c));
      
      return [...categoriesFromTable, ...missingCategories.sort()];
    } else {
      // Fallback to menu items approach if no categories in table
      const results = await db
        .selectDistinct({ category: menuItems.category })
        .from(menuItems)
        .orderBy(menuItems.category);
      return results.map(r => r.category);
    }
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