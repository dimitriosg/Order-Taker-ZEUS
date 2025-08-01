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

  // Impersonation routes
  app.post('/api/impersonate', async (req: any, res) => {
    try {
      const { userId } = req.body;
      
      // Initialize session if it doesn't exist
      if (!req.session) {
        req.session = {};
      }
      
      // Only managers can impersonate
      const currentRole = req.session.userRole || 'manager';
      if (currentRole !== 'manager' && !req.session.originalRole) {
        return res.status(403).json({ message: 'Only managers can impersonate users' });
      }

      // Get the user to impersonate
      const userToImpersonate = await storage.getUser(userId);
      if (!userToImpersonate) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Store original role if not already impersonating
      if (!req.session.originalRole) {
        req.session.originalRole = currentRole;
        req.session.originalUserId = req.session.userId || 'test-manager-1';
      }

      // Set impersonation session data
      req.session.userRole = userToImpersonate.role;
      req.session.userId = userToImpersonate.id;
      req.session.isImpersonating = true;

      res.json({ message: 'Impersonation started', user: userToImpersonate });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/stop-impersonation', async (req: any, res) => {
    try {
      // Initialize session if it doesn't exist
      if (!req.session) {
        req.session = {};
      }
      
      if (!req.session.isImpersonating) {
        return res.status(400).json({ message: 'Not currently impersonating' });
      }

      // Restore original role and user
      req.session.userRole = req.session.originalRole;
      req.session.userId = req.session.originalUserId;
      
      // Clear impersonation data
      delete req.session.originalRole;
      delete req.session.originalUserId;
      delete req.session.isImpersonating;

      res.json({ message: 'Impersonation stopped' });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Auth routes - demo mock for testing
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is "logged out" via logout endpoint
      const isLoggedOut = req.query.logout === 'true';
      if (isLoggedOut) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // For demo, create user based on role in session or default to manager
      const role = req.session?.userRole || 'manager';
      const userId = req.session?.userId || 'test-manager-1';
      const isImpersonating = req.session?.isImpersonating || false;
      
      console.log('Auth session data:', { role, userId, isImpersonating, originalRole: req.session?.originalRole });
      
      // If impersonating, try to get real user data from database
      if (isImpersonating) {
        try {
          const realUser = await storage.getUser(userId);
          if (realUser) {
            console.log('Found impersonated user:', realUser);
            res.json({
              ...realUser,
              isImpersonating: true,
              originalRole: req.session?.originalRole || 'manager'
            });
            return;
          }
        } catch (error) {
          console.error("Error fetching impersonated user:", error);
        }
      }
      
      const mockUsers = {
        manager: {
          id: 'test-manager-1',
          email: 'manager@example.com',
          firstName: 'Test',
          lastName: 'Manager',
          role: 'manager',
          assignedTables: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        waiter: {
          id: 'test-waiter-1',
          email: 'waiter@example.com',
          firstName: 'Test',
          lastName: 'Waiter',
          role: 'waiter',
          assignedTables: [1, 2, 3],
          createdAt: new Date(),
          updatedAt: new Date()
        },   
        cashier: {
          id: 'test-cashier-1',
          email: 'cashier@example.com',
          firstName: 'Test',
          lastName: 'Cashier',
          role: 'cashier',
          assignedTables: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      const userData = mockUsers[role as keyof typeof mockUsers] || mockUsers.manager;
      res.json({
        ...userData,
        isImpersonating,
        originalRole: isImpersonating ? 'manager' : undefined
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout route
  app.get('/api/logout', async (req: any, res) => {
    try {
      // Clear any session data if using sessions
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
        });
      }
      
      // Clear cookies
      res.clearCookie('connect.sid');
      res.clearCookie('session');
      
      // Redirect to landing page with logout flag
      res.redirect('/?logout=true');
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Login route with role selection
  app.post('/api/login', async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!['manager', 'waiter', 'cashier'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Store role in session for demo
      if (!req.session) req.session = {};
      req.session.userRole = role;
      
      res.json({ success: true, role });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
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

  // Get menu categories
  app.get('/api/menu/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Create menu item (admin only)
  app.post('/api/menu', async (req, res) => {
    try {
      const validatedData = insertMenuItemSchema.parse(req.body);
      const item = await storage.createMenuItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating menu item:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update menu item (admin only)
  app.patch('/api/menu/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const item = await storage.updateMenuItem(id, updates);
      res.json(item);
    } catch (error) {
      console.error("Error updating menu item:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Delete menu item (admin only)
  app.delete('/api/menu/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMenuItem(id);
      res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
      console.error("Error deleting menu item:", error);
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

  // Batch table operations
  app.post('/api/tables/batch', async (req, res) => {
    try {
      const { tables } = req.body;
      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ message: 'Tables array is required' });
      }

      const results = [];
      let created = 0;
      
      for (const tableNumber of tables) {
        try {
          const validatedData = insertTableSchema.parse({ number: tableNumber });
          const table = await storage.createTable(validatedData);
          results.push(table);
          created++;
        } catch (error) {
          // Skip tables that already exist or fail validation
          console.log(`Skipped table ${tableNumber}:`, error);
        }
      }

      res.json({ created, tables: results });
    } catch (error) {
      console.error("Error creating tables in batch:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.delete('/api/tables/batch', async (req, res) => {
    try {
      const { tables } = req.body;
      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ message: 'Tables array is required' });
      }

      let removed = 0;
      
      for (const tableNumber of tables) {
        try {
          await storage.removeTable(tableNumber);
          removed++;
        } catch (error) {
          // Skip tables that don't exist
          console.log(`Skipped removing table ${tableNumber}:`, error);
        }
      }

      res.json({ removed });
    } catch (error) {
      console.error("Error removing tables in batch:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update table name (support both PUT and PATCH)
  const updateTableName = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      const table = await storage.updateTableName(id, name);
      res.json(table);
    } catch (error) {
      console.error("Error updating table name:", error);
      res.status(500).json({ message: 'Server error' });
    }
  };

  app.put('/api/tables/:id/name', updateTableName);
  app.patch('/api/tables/:id/name', updateTableName);

  // Update staff member
  app.put('/api/staff/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, role } = req.body;
      
      const staff = await storage.updateStaff(id, { name, role });
      res.json(staff);
    } catch (error) {
      console.error("Error updating staff:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Delete staff member
  app.delete('/api/staff/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      await storage.deleteStaff(id);
      res.json({ message: 'Staff member deleted successfully' });
    } catch (error) {
      console.error("Error deleting staff:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Register new staff member
  app.post('/api/register', async (req, res) => {
    try {
      const { username, firstName, lastName, role } = req.body;
      
      if (!username || !firstName || !role) {
        return res.status(400).json({ message: 'Username, first name, and role are required' });
      }

      if (!['waiter', 'cashier', 'manager'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      // Check if user already exists (using email field to store username)
      const existingUser = await storage.getUserByEmail(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Create new staff member with no assigned tables for waiters
      const newStaff = await storage.createUser({
        email: username, // Store username in email field for compatibility
        firstName,
        lastName,
        profileImageUrl: null,
        role: role as "waiter" | "cashier" | "manager",
        assignedTables: role === 'waiter' ? [] : null
      });

      res.status(201).json({ message: 'Staff member created successfully', user: newStaff });
    } catch (error) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Order routes
  app.post('/api/orders', async (req: any, res) => {
    try {
      // Get current user info from session
      const userId = req.session?.userId || 'test-manager-1';
      const userRole = req.session?.userRole || 'manager';
      const user = { id: userId, role: userRole };

      const { tableNumber, items, cashReceived } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
      }

      // Check if table is assigned to someone else
      const allStaff = await storage.getAllUsers();
      const assignedWaiter = allStaff.find(s => 
        s.role === 'waiter' && s.assignedTables?.includes(tableNumber)
      );
      const currentWaiter = allStaff.find(s => s.id === user.id);

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

      // If this is cross-waiter ordering, notify the assigned waiter
      if (assignedWaiter && assignedWaiter.id !== user.id) {
        const waiterName = currentWaiter?.firstName || currentWaiter?.email || 'Another waiter';
        broadcastToRole('waiter', {
          type: 'cross_waiter_order',
          order: order,
          message: `${waiterName} took an order for your table ${tableNumber} while you were away`,
          assignedWaiterId: assignedWaiter.id,
          actualWaiterId: user.id
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.get('/api/orders', async (req: any, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get orders by status - for cashier dashboard
  app.get('/api/orders/status/:status', async (req: any, res) => {
    try {
      const { status } = req.params;
      const validStatuses = ['paid', 'in-prep', 'ready', 'served'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      const orders = await storage.getOrdersByStatus(status);
      res.json(orders);
    } catch (error) {
      console.error(`Error fetching orders by status ${req.params.status}:`, error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.patch('/api/orders/:id/status', async (req: any, res) => {
    try {
      // Get current user from session
      const userId = req.session?.userId || 'test-manager-1';
      const user = { id: userId, role: 'cashier' };
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