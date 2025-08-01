import { type User, type InsertUser, type Table, type InsertTable, type MenuItem, type InsertMenuItem, type Order, type InsertOrder, type OrderItem, type InsertOrderItem } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTables(userId: string, assignedTables: number[]): Promise<User>;
  getAllUsers(): Promise<User[]>;

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tables: Map<string, Table>;
  private menuItems: Map<string, MenuItem>;
  private orders: Map<string, Order>;
  private orderItems: Map<string, OrderItem>;

  constructor() {
    this.users = new Map();
    this.tables = new Map();
    this.menuItems = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.seedData();
  }

  private seedData() {
    // Seed sample users
    const manager: User = {
      id: randomUUID(),
      username: "manager",
      password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
      role: "manager",
      assignedTables: null,
    };
    
    const waiter: User = {
      id: randomUUID(),
      username: "waiter",
      password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
      role: "waiter",
      assignedTables: [1, 2, 3],
    };
    
    const cashier: User = {
      id: randomUUID(),
      username: "cashier",
      password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
      role: "cashier",
      assignedTables: null,
    };

    this.users.set(manager.id, manager);
    this.users.set(waiter.id, waiter);
    this.users.set(cashier.id, cashier);

    // Seed tables
    for (let i = 1; i <= 10; i++) {
      const table: Table = {
        id: randomUUID(),
        number: i,
        status: "free",
      };
      this.tables.set(table.id, table);
    }

    // Seed menu items
    const menuItems: MenuItem[] = [
      {
        id: randomUUID(),
        name: "Grilled Chicken Breast",
        description: "Served with seasonal vegetables and rice pilaf",
        price: 18.00,
        category: "Main Course",
        image: null,
      },
      {
        id: randomUUID(),
        name: "Caesar Salad",
        description: "Fresh romaine lettuce with parmesan and croutons",
        price: 12.00,
        category: "Appetizers",
        image: null,
      },
      {
        id: randomUUID(),
        name: "Salmon Fillet",
        description: "Pan-seared salmon with lemon butter sauce",
        price: 24.00,
        category: "Main Course",
        image: null,
      },
      {
        id: randomUUID(),
        name: "Pasta Carbonara",
        description: "Classic Italian pasta with pancetta and parmesan",
        price: 16.00,
        category: "Main Course",
        image: null,
      },
      {
        id: randomUUID(),
        name: "Tiramisu",
        description: "Traditional Italian dessert with coffee and mascarpone",
        price: 8.00,
        category: "Desserts",
        image: null,
      },
    ];

    menuItems.forEach(item => this.menuItems.set(item.id, item));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, assignedTables: null };
    this.users.set(id, user);
    return user;
  }

  async updateUserTables(userId: string, assignedTables: number[]): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.assignedTables = assignedTables;
    this.users.set(userId, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllTables(): Promise<Table[]> {
    return Array.from(this.tables.values()).sort((a, b) => a.number - b.number);
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const id = randomUUID();
    const table: Table = { ...insertTable, id, status: insertTable.status || "free" };
    this.tables.set(id, table);
    return table;
  }

  async updateTableStatus(tableNumber: number, status: "free" | "occupied"): Promise<Table> {
    const table = Array.from(this.tables.values()).find(t => t.number === tableNumber);
    if (!table) throw new Error("Table not found");
    table.status = status;
    this.tables.set(table.id, table);
    return table;
  }

  async getAllMenuItems(): Promise<MenuItem[]> {
    return Array.from(this.menuItems.values());
  }

  async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    return Array.from(this.menuItems.values()).filter(item => item.category === category);
  }

  async createMenuItem(insertItem: InsertMenuItem): Promise<MenuItem> {
    const id = randomUUID();
    const item: MenuItem = { 
      ...insertItem, 
      id, 
      description: insertItem.description || null,
      image: insertItem.image || null 
    };
    this.menuItems.set(id, item);
    return item;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = { 
      ...insertOrder, 
      id, 
      status: insertOrder.status || "paid",
      paid: insertOrder.paid !== undefined ? insertOrder.paid : false,
      cashReceived: insertOrder.cashReceived || null,
      waiterId: insertOrder.waiterId || null,
      cashierId: insertOrder.cashierId || null,
      createdAt: new Date() 
    };
    this.orders.set(id, order);
    return order;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByStatus(status: "paid" | "in-prep" | "ready" | "served"): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async updateOrderStatus(id: string, status: "paid" | "in-prep" | "ready" | "served", cashierId?: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error("Order not found");
    order.status = status;
    if (cashierId) order.cashierId = cashierId;
    this.orders.set(id, order);
    return order;
  }

  async getOrdersByWaiter(waiterId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.waiterId === waiterId);
  }

  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const item: OrderItem = { 
      ...insertItem, 
      id, 
      notes: insertItem.notes || null 
    };
    this.orderItems.set(id, item);
    return item;
  }

  async getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(item => item.orderId === orderId);
  }
}

export const storage = new MemStorage();
