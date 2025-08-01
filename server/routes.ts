import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertOrderSchema, insertOrderItemSchema, insertTableSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Auth middleware - temporarily disabled for testing
  // await setupAuth(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store client connections by role
  const clientsByRole = new Map<string, Set<WebSocket>>();
  
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'join' && data.role) {
          if (!clientsByRole.has(data.role)) {
            clientsByRole.set(data.role, new Set());
          }
          clientsByRole.get(data.role)!.add(ws);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove from all role sets
      clientsByRole.forEach(clients => clients.delete(ws));
    });
  });

  // Broadcast to specific role
  const broadcastToRole = (role: string, message: any) => {
    const clients = clientsByRole.get(role);
    if (clients) {
      const messageStr = JSON.stringify(message);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  };

  // Auth routes - temporary mock for testing
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Return a mock manager user to test table creation
      const mockUser = {
        id: 'test-manager-1',
        email: 'manager@example.com',
        firstName: 'Test',
        lastName: 'Manager',
        role: 'manager',
        assignedTables: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      res.json(mockUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Menu routes
  app.get('/api/menu', async (req, res) => {
    try {
      const menuItems = await storage.getAllMenuItems();
      res.json(menuItems);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/menu/category/:category', async (req, res) => {
    try {
      const menuItems = await storage.getMenuItemsByCategory(req.params.category);
      res.json(menuItems);
    } catch (error) {
      console.error("Error fetching menu by category:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Table routes
  app.get('/api/tables', async (req, res) => {
    try {
      const tables = await storage.getAllTables();
      res.json(tables);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/tables', async (req: any, res) => {
    try {
      const validatedData = insertTableSchema.parse(req.body);
      const table = await storage.createTable(validatedData);
      res.status(201).json(table);
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Order routes
  app.post('/api/orders', async (req: any, res) => {
    try {
      const user = { id: 'test-waiter-1', role: 'waiter' }; // Mock user for testing

      const { tableNumber, items, cashReceived } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
      }

      const order = await storage.createOrder({
        tableNumber,
        status: 'paid',
        waiterId: user.id,
        paid: true,
        cashReceived
      });

      // Create order items
      for (const item of items) {
        await storage.createOrderItem({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes || null
        });
      }

      // Update table status to occupied
      await storage.updateTableStatus(tableNumber, 'occupied');

      // Broadcast to cashiers about new order
      broadcastToRole('cashier', {
        type: 'new_order',
        order: order
      });
      
      // Broadcast to managers
      broadcastToRole('manager', {
        type: 'new_order',
        order: order
      });

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/orders', async (req: any, res) => {
    try {
      const orders = await storage.getOrdersByStatus('paid');
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.patch('/api/orders/:id/status', async (req: any, res) => {
    try {
      const user = { id: 'test-cashier-1', role: 'cashier' }; // Mock user for testing
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status, user.id);
      
      // Broadcast status change to all roles
      const message = {
        type: 'order_status_updated',
        order: order
      };
      
      broadcastToRole('waiter', message);
      broadcastToRole('cashier', message);
      broadcastToRole('manager', message);

      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Staff management routes (managers only)
  app.get('/api/staff', async (req: any, res) => {
    try {
      const staff = await storage.getAllUsers();
      res.json(staff);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.patch('/api/staff/:id/tables', async (req: any, res) => {
    try {
      const { assignedTables } = req.body;
      const updatedUser = await storage.updateUserTables(req.params.id, assignedTables);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user tables:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  return httpServer;
}