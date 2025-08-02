# Order-Taker-ZEUS 🍽️

A comprehensive restaurant order management system built with React, Express.js, and TypeScript. Designed for cash-only operations with advanced real-time communication and staff coordination capabilities.

## 🚀 Features

### Core Functionality
- **Role-Based Dashboards**: Separate interfaces for managers, waiters, and cashiers
- **Real-Time Communication**: WebSocket integration for instant order updates
- **Cash-Only Operations**: Streamlined payment flow optimized for cash transactions
- **Table Management**: Dynamic table creation, assignment, and status tracking
- **Order Processing**: Complete order lifecycle from creation to completion

### Advanced Features
- **Comprehensive Reporting**: Three detailed report types with flexible date filtering
- **Data Export**: Individual CSV exports and ZIP downloads with UTF-8 encoding
- **Profile Management**: User profiles with image uploads and password management
- **Theme Support**: Light/dark mode with persistent storage
- **Mobile Responsive**: Touch-friendly interface optimized for all devices
- **Multi-Language Support**: Greek character support with proper encoding

### Real-Time Updates
- Order status changes broadcast instantly to all relevant users
- Table occupancy updates in real-time
- Staff performance metrics updated live
- Automatic UI refresh on data changes

## 🛠️ Technical Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **shadcn/ui** components with Radix UI primitives
- **Tailwind CSS** for styling with custom mobile-first utilities
- **TanStack Query** for server state management
- **Wouter** for lightweight routing

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** database with connection pooling
- **Drizzle ORM** for type-safe database operations
- **WebSocket** server using native ws library
- **Passport.js** for authentication
- **bcryptjs** for password hashing

### Development Tools
- **tsx** for TypeScript execution
- **ESBuild** for fast bundling
- **Drizzle Kit** for database migrations
- **JSZip** for report archives

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- NPM or Yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dimitriosg/Order-Taker-ZEUS.git
   cd Order-Taker-ZEUS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/restaurant_db
   JWT_SECRET=your-secure-jwt-secret
   NODE_ENV=development
   ```

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 👥 Default User Accounts

The system comes with pre-configured test accounts:

| Role     | Username | Password   | Access Level |
|----------|----------|------------|--------------|
| Manager  | zeus     | 12345678   | Full system access, reporting, staff management |
| Waiter   | waiter   | waiter123  | Order creation, table management |
| Cashier  | cashier  | cashier123 | Order processing, payment handling |

⚠️ **Important**: Change these default passwords in production!

## 🎯 User Roles & Permissions

### Manager Dashboard
- **Staff Management**: Create, edit, and manage staff accounts
- **Table Management**: Create tables and assign them to waiters
- **Comprehensive Reports**: Access to all three report types
- **System Configuration**: Manage menu items and restaurant settings
- **Data Export**: Download reports as CSV or ZIP archives

### Waiter Dashboard
- **Order Creation**: Create new orders for assigned tables
- **Table Status**: View and update table occupancy
- **Order History**: Track order progress and completion
- **Profile Management**: Update personal information and password

### Cashier Dashboard
- **Order Processing**: Handle payment and order completion
- **Payment Validation**: Verify cash payments before kitchen processing
- **Order Queue**: View pending orders requiring payment
- **Transaction History**: Track completed transactions

## 📊 Reporting System

### Total Sales Report
- Complete order history with chronological sorting
- Detailed item breakdown with quantities
- Waiter assignment tracking
- Flexible date range filtering

### Items Sales Report
- Menu item performance ranked by popularity
- Total quantities sold and revenue generated
- Trend analysis for inventory management

### Staff Performance Report
- Individual waiter sales totals
- Performance ranking and comparison
- Date range analysis for payroll and incentives

### Export Options
- **Individual CSV**: Each report type separately
- **ZIP Archive**: All reports in a single download
- **UTF-8 Encoding**: Proper Greek character support
- **Excel Compatible**: BOM encoding for spreadsheet applications

## 🎨 User Interface

### Design System
- **Mobile-First**: Responsive design optimized for touch devices
- **Accessibility**: ARIA labels and keyboard navigation support
- **Theme Support**: Light and dark modes with system preference detection
- **Loading States**: Smooth animations and progress indicators
- **Error Handling**: User-friendly error messages and recovery options

### Component Library
- Consistent UI components across all dashboards
- Custom mobile utilities for touch interfaces
- Collapsible navigation for space optimization
- Interactive feedback and animations

## 🔒 Security Features

- **Role-Based Access Control**: Strict permission enforcement
- **Password Hashing**: bcrypt encryption for all passwords
- **JWT Authentication**: Secure token-based sessions
- **Session Management**: PostgreSQL-backed session storage
- **Input Validation**: Server-side validation for all user inputs

## 🗄️ Database Schema

### Core Tables
- **users**: Staff accounts with role assignments
- **tables**: Restaurant table configuration
- **menu_items**: Available food and drink items
- **orders**: Order records with status tracking
- **order_items**: Individual items within orders

### Relationships
- Orders linked to users (waiters) and tables
- Order items reference menu items with quantities
- Foreign key constraints ensure data integrity

## 🚀 Deployment

### Production Setup
1. **Environment Configuration**
   ```env
   NODE_ENV=production
   DATABASE_URL=your-production-database-url
   JWT_SECRET=your-production-jwt-secret
   ```

2. **Database Migration**
   ```bash
   npm run db:push
   ```

3. **Build Application**
   ```bash
   npm run build
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

### Deployment Platforms
- **Replit**: Direct deployment with database integration
- **Heroku**: PostgreSQL add-on supported
- **DigitalOcean**: App Platform compatible
- **Railway**: PostgreSQL plugin available

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open database management interface

### Project Structure
```
├── client/           # React frontend application
├── server/           # Express.js backend server
├── shared/           # Shared TypeScript types and schemas
├── uploads/          # User-uploaded files (profile pictures)
├── components.json   # shadcn/ui configuration
├── drizzle.config.ts # Database configuration
├── package.json      # Dependencies and scripts
└── vite.config.ts    # Build configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the code comments
- Review the console logs for debugging information

## 🔄 Recent Updates

### Version 2.0 - Enhanced Reporting & UX
- Fixed report sorting algorithms for chronological accuracy
- Implemented ZIP download functionality for bulk exports
- Enhanced UTF-8 encoding support for international characters
- Added comprehensive loading animations and theme switching
- Improved mobile responsiveness across all dashboards

### Version 1.5 - Profile Management
- Added profile picture upload functionality
- Implemented password change capabilities with security reminders
- Enhanced authentication system with real-time user data
- Added collapsible sidebar for better space utilization

### Version 1.0 - Core Release
- Complete restaurant management system
- Role-based dashboards with real-time WebSocket communication
- Cash-only payment processing workflow
- Comprehensive reporting system with CSV exports

---

**Built with ❤️ for restaurants seeking efficient order management**
