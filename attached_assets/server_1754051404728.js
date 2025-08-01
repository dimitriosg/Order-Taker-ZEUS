const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketio = require('socket.io');

/**
 * Simple restaurant order management backend skeleton.
 *
 * This Express application provides the bare minimum required to
 * authenticate users, manage menu items and tables, create paid orders
 * (cash-only), and update order statuses in real time via Socket.IO.
 *
 * It assumes a MongoDB instance is available at the address provided in
 * the MONGO_URI environment variable. JWT_SECRET should be defined in
 * your .env file to sign JSON Web Tokens.
 */

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*'
  }
});

// -----------------------------------------------------------------------------
// Database connection
// -----------------------------------------------------------------------------
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/order-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// -----------------------------------------------------------------------------
// Schema definitions
// -----------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['waiter', 'cashier', 'manager'] },
  /**
   * If assignedTables is an empty array or undefined, the user can access
   * all tables. Otherwise the user sees only these table numbers.
   */
  assignedTables: [Number]
});

const tableSchema = new mongoose.Schema({
  number: Number,
  status: { type: String, enum: ['free', 'occupied'], default: 'free' }
});

const menuItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  image: String
});

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  quantity: Number,
  notes: String
});

const orderSchema = new mongoose.Schema({
  table: { type: Number },
  items: [orderItemSchema],
  /**
   * Order status flow: paid (cash collected by waiter), in-prep (kitchen has
   * acknowledged and is preparing), ready (kitchen indicates ready to serve),
   * served (waiter delivered to table).
   */
  status: { type: String, enum: ['paid', 'in-prep', 'ready', 'served'], default: 'paid' },
  waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paid: { type: Boolean, default: false },
  cashReceived: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Table = mongoose.model('Table', tableSchema);
const MenuItem = mongoose.model('MenuItem', menuItemSchema);
const Order = mongoose.model('Order', orderSchema);

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

/**
 * Authentication and authorization middleware.  Verifies a JWT token and
 * optionally restricts access to certain roles.
 *
 * @param {string[]} roles - allowed roles.  If undefined, any authenticated
 * user can access the route.  If specified, the user must have one of the roles.
 */
const auth = (roles) => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    if (roles && !roles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

/**
 * Registers a new user.  Only managers should call this route in practice.
 */
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ message: 'Missing fields' });
  const existing = await User.findOne({ username });
  if (existing) return res.status(409).json({ message: 'User already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed, role });
  await user.save();
  res.json({ message: 'User created' });
});

/**
 * Logs in a user and returns a signed JWT token containing the user id, role
 * and assigned tables.  The client should include this token in subsequent
 * requests (Authorization: Bearer <token>).
 */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });
  const payload = { id: user._id, role: user.role, assignedTables: user.assignedTables };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret');
  res.json({ token });
});

/**
 * Returns the full menu.  Accessible by waiters, cashiers and managers.
 */
app.get('/api/menu', auth(['waiter', 'cashier', 'manager']), async (req, res) => {
  const menu = await MenuItem.find();
  res.json(menu);
});

/**
 * Creates a new order.  Only waiters can create orders.  The waiter must
 * collect cash before calling this endpoint.  `cashReceived` represents the
 * amount of cash taken from the customer.
 */
app.post('/api/orders', auth(['waiter']), async (req, res) => {
  const { table, items, cashReceived } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'No items' });
  const order = new Order({
    table,
    items,
    status: 'paid',
    waiter: req.user.id,
    paid: true,
    cashReceived
  });
  await order.save();
  // Notify cashiers in real time
  io.to('cashiers').emit('newOrder', order);
  res.json(order);
});

/**
 * Updates the status of an existing order.  Cashiers and managers can change
 * statuses from 'paid' to 'in-prep', 'ready', or 'served'.  When an order is
 * updated, the waiter is notified via Socket.IO.
 */
app.put('/api/orders/:id/status', auth(['cashier', 'manager']), async (req, res) => {
  const { status } = req.body;
  if (!['in-prep', 'ready', 'served'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  order.status = status;
  order.cashier = req.user.id;
  await order.save();
  // Notify waiters in real time
  io.to('waiters').emit('orderStatusUpdated', order);
  res.json(order);
});

// -----------------------------------------------------------------------------
// Socket.IO event handling
// -----------------------------------------------------------------------------
io.on('connection', (socket) => {
  /**
   * The client should emit a `join` event with their role after connecting.
   * This ensures that waiters and cashiers receive the correct real-time
   * notifications when orders are placed or updated.
   */
  socket.on('join', ({ role }) => {
    if (role === 'waiter') socket.join('waiters');
    if (role === 'cashier') socket.join('cashiers');
  });
});

// -----------------------------------------------------------------------------
// Server startup
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});