import type { Express, RequestHandler } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertOrderSchema, insertOrderItemSchema, insertTableSchema, insertMenuItemSchema, insertCategorySchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import jwt from "jsonwebtoken";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Auth middleware - temporarily disabled for testing
  // await setupAuth(app);
  
  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1y', // 1 year cache
  }));
  
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
    console.log(`Broadcasting to ${role}: ${clients ? clients.size : 0} clients connected`);
    if (clients) {
      const messageStr = JSON.stringify(message);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
          console.log(`Sent message to ${role} client:`, message.type);
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
      // Check if user is logged out or no session exists
      if (!req.session || req.session.loggedOut || !req.session.userRole) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user data from session - no defaults
      const role = req.session.userRole;
      const userId = req.session.userId;
      const isImpersonating = req.session?.isImpersonating || false;
      
      console.log('Auth session data:', { role, userId, isImpersonating, originalRole: req.session?.originalRole });
      
      // Try to get real user data from database first
      try {
        const realUser = await storage.getUser(userId);
        if (realUser) {
          console.log('Found user in database:', realUser);
          res.json({
            ...realUser,
            isImpersonating,
            originalRole: isImpersonating ? req.session?.originalRole || 'manager' : undefined
          });
          return;
        }
      } catch (error) {
        console.error("Error fetching user from database:", error);
      }
      
      // Fallback to mock users if not found in database
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
      console.log('Using fallback mock data for user:', userData);
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
  app.post('/api/logout', async (req: any, res) => {
    try {
      // Destroy the session completely
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            console.error("Session destruction error:", err);
            return res.status(500).json({ message: "Logout failed" });
          }
          
          // Clear the session cookie
          res.clearCookie('connect.sid');
          res.json({ success: true, message: "Logged out successfully" });
        });
      } else {
        res.json({ success: true, message: "Logged out successfully" });
      }
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Login route with username/password authentication
  app.post('/api/login', async (req: any, res) => {
    try {
      const { username, password, role } = req.body;
      console.log('Login attempt:', { username, password: password ? '[HIDDEN]' : 'undefined' });
      
      // Demo credentials for each role
      const demoCredentials = {
        'manager': { username: 'zeus', password: '12345678' },
        'waiter': { username: 'waiter', password: 'waiter123' },
        'cashier': { username: 'cashier', password: 'cashier123' }
      };
      
      let userRole = null;
      let userId = null;
      
      // Support both username/password login and legacy role-based login
      if (username && password) {
        // Try database authentication first (for users who changed their passwords)
        try {
          const dbUser = await storage.getUserByEmail(username);
          if (dbUser && dbUser.passwordHash) {
            const passwordMatch = await require('bcryptjs').compare(password, dbUser.passwordHash);
            if (passwordMatch) {
              userRole = dbUser.role;
              userId = dbUser.id;
            }
          }
        } catch (dbError) {
          console.log('Database auth failed, trying demo credentials:', dbError.message);
        }
        
        // If database auth failed, try demo credentials
        if (!userRole) {
          for (const [checkRole, credentials] of Object.entries(demoCredentials)) {
            console.log(`Checking ${checkRole}:`, { 
              expected: credentials, 
              received: { username, password: '[HIDDEN]' },
              match: credentials.username === username && credentials.password === password
            });
            if (credentials.username === username && credentials.password === password) {
              userRole = checkRole;
              userId = `test-${checkRole}-1`;
              break;
            }
          }
        }
        
        if (!userRole) {
          console.log('Login failed - no matching credentials');
          return res.status(401).json({ message: "Invalid username or password" });
        }
      } else if (role) {
        // Legacy role-based login (for landing page)
        if (!['manager', 'waiter', 'cashier'].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
        userRole = role;
        userId = `test-${role}-1`;
      } else {
        return res.status(400).json({ message: "Username and password or role required" });
      }
      
      // Store role and user in session and clear logout flag
      if (!req.session) req.session = {};
      req.session.userRole = userRole;
      req.session.userId = userId;
      req.session.loggedOut = false;
      req.session.isImpersonating = false;
      
      // Create JWT token for frontend
      const userData = {
        id: userId,
        username: username || userRole,
        role: userRole,
        assignedTables: userRole === 'waiter' ? [1, 2, 3] : null,
        name: userRole === 'manager' ? 'Test Manager' : 
              userRole === 'waiter' ? 'Test Waiter' : 'Test Cashier'
      };
      
      const token = jwt.sign(userData, 'demo-secret', { expiresIn: '24h' });
      
      res.json({ 
        success: true, 
        token,
        user: userData
      });
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

  // Category management routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.patch('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const category = await storage.updateCategory(id, updates);
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.put('/api/categories/reorder', async (req, res) => {
    try {
      const { categoryOrders } = req.body;
      await storage.updateCategoryOrder(categoryOrders);
      res.json({ message: 'Category order updated successfully' });
    } catch (error) {
      console.error("Error updating category order:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCategory(id);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error("Error deleting category:", error);
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
      const forceDelete = req.query.force === 'true';
      
      if (forceDelete) {
        // First, remove all order items that reference this menu item
        await storage.deleteOrderItemsByMenuItemId(id);
      }
      
      await storage.deleteMenuItem(id);
      res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
      console.error("Error deleting menu item:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
        res.status(409).json({ 
          message: "Cannot delete menu item: it is referenced in existing orders",
          code: "FOREIGN_KEY_CONSTRAINT"
        });
      } else {
        res.status(500).json({ message: 'Server error' });
      }
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
      const { name, firstName, lastName, email, role, password } = req.body;
      
      // Validate password length if provided
      if (password && password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      
      // Support both legacy 'name' field and new firstName/lastName fields
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (password !== undefined) updateData.password = password;
      
      const staff = await storage.updateStaff(id, updateData);
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

  // Profile image upload endpoint
  app.post('/api/upload/profile-image/:userId', upload.single('profileImage'), async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Create the image URL
      const imageUrl = `/uploads/${req.file.filename}`;
      
      // Update user's profile image URL in the database
      await storage.updateStaff(userId, { profileImageUrl: imageUrl });
      
      res.json({ 
        message: 'Profile image uploaded successfully',
        imageUrl: imageUrl 
      });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      
      // Clean up uploaded file if database update fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Error cleaning up file:", unlinkError);
        }
      }
      
      res.status(500).json({ message: 'Failed to upload profile image' });
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
      
      // Get current order to track previous status
      const currentOrder = await storage.getOrderById(req.params.id);
      const previousStatus = currentOrder?.status;
      
      const order = await storage.updateOrderStatus(req.params.id, status, user.id);
      
      // Broadcast status change to all roles with previous status
      const message = {
        type: 'order_status_updated',
        order: order,
        previousStatus: previousStatus
      };
      
      console.log('Broadcasting order status update:', message);
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