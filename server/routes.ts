import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertOrderSchema, insertOrderItemSchema, type User } from "@shared/schema";

interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
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

  // Authentication middleware
  const auth = (roles?: string[]) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const user = await storage.getUser(decoded.id);
      if (!user) return res.status(401).json({ message: 'User not found' });
      
      req.user = user;
      if (roles && !roles.includes(user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  // Auth routes
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const { username, password, role } = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: 'User already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword, role });
      
      res.json({ message: 'User created', user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, assignedTables: user.assignedTables, name: user.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          assignedTables: user.assignedTables,
          name: user.name
        } 
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Menu routes
  app.get('/api/menu', auth(['waiter', 'cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const menuItems = await storage.getAllMenuItems();
      res.json(menuItems);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/menu/category/:category', auth(['waiter', 'cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const menuItems = await storage.getMenuItemsByCategory(req.params.category);
      res.json(menuItems);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Table routes
  app.get('/api/tables', auth(['waiter', 'cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tables = await storage.getAllTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Order routes
  app.post('/api/orders', auth(['waiter']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tableNumber, items, cashReceived } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
      }

      const order = await storage.createOrder({
        tableNumber,
        status: 'paid',
        waiterId: req.user!.id,
        paid: true,
        cashReceived,
        cashierId: null,
      });

      // Create order items
      for (const item of items) {
        await storage.createOrderItem({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes,
        });
      }

      // Update table status
      await storage.updateTableStatus(tableNumber, 'occupied');

      // Notify cashiers
      broadcastToRole('cashier', {
        type: 'newOrder',
        order: { ...order, items }
      });

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/orders/status/:status', auth(['waiter', 'cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.params.status as "paid" | "in-prep" | "ready" | "served";
      const orders = await storage.getOrdersByStatus(status);
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );
      
      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.put('/api/orders/:id/status', auth(['cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.body;
      
      if (!['in-prep', 'ready', 'served'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const order = await storage.updateOrderStatus(req.params.id, status, req.user!.id);
      
      // If order is served, free the table
      if (status === 'served') {
        await storage.updateTableStatus(order.tableNumber, 'free');
      }

      // Notify waiters
      broadcastToRole('waiter', {
        type: 'orderStatusUpdated',
        order
      });

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/orders/waiter/:waiterId', auth(['waiter', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orders = await storage.getOrdersByWaiter(req.params.waiterId);
      
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );
      
      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Staff management routes
  app.get('/api/staff', auth(['manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const staff = users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        assignedTables: user.assignedTables
      }));
      res.json(staff);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Table management routes
  app.get('/api/tables', auth(['manager', 'waiter', 'cashier']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tables = await storage.getAllTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/tables', auth(['manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { number } = req.body;
      
      if (!number || number <= 0) {
        return res.status(400).json({ message: 'Valid table number is required' });
      }

      // Check if table already exists
      const existingTables = await storage.getAllTables();
      const tableExists = existingTables.some(table => table.number === number);
      
      if (tableExists) {
        return res.status(400).json({ message: `Table ${number} already exists` });
      }

      const table = await storage.createTable({ number, status: "free" });
      res.json(table);
    } catch (error) {
      console.error('Table creation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.put('/api/staff/:id/tables', auth(['manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { assignedTables } = req.body;
      const user = await storage.updateUserTables(req.params.id, assignedTables);
      res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        assignedTables: user.assignedTables 
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Profile management routes
  app.put('/api/profile', auth(['waiter', 'cashier', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, password } = req.body;
      const updateData: { name?: string; password?: string } = {};
      
      if (name !== undefined) updateData.name = name;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateData.password = hashedPassword;
      }
      
      const user = await storage.updateUserProfile(req.user!.id, updateData);
      
      // Generate new token with updated user info
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, assignedTables: user.assignedTables, name: user.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        token,
        user: {
          id: user.id, 
          username: user.username, 
          role: user.role, 
          name: user.name,
          assignedTables: user.assignedTables 
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return httpServer;
}
