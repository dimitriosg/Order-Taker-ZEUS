# Restaurant Order Management System

## Overview

This is a full-stack restaurant order management system built with React, Express, and TypeScript. The application provides role-based dashboards for waiters, cashiers, and managers to handle cash-only orders and table management in a restaurant environment. The system emphasizes real-time communication and streamlined workflow from order creation to completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Password Change Feature Implementation (January 2025)
- **Backend Updates**: Added password hashing support to staff update endpoint with bcryptjs
- **Frontend Components**: Enhanced ProfileModal and ProfileEditForm with password validation
- **Security Reminders**: Added PasswordChangeReminder component across all dashboard roles
- **User Experience**: All users (manager, waiter, cashier) can now easily change their default passwords
- **Validation**: Frontend and backend validation ensures passwords are at least 6 characters

### Collapsible Sidebar Feature (January 2025)
- **Manager Dashboard Enhancement**: Added collapsible sidebar with smooth animations
- **Space Optimization**: Sidebar can shrink from 256px to 64px width for more screen space
- **Interactive Toggle**: Floating toggle button with chevron icons for expand/collapse
- **Smart Layout**: Icons remain visible in collapsed state with tooltips for accessibility
- **Responsive Design**: Maintains full functionality in both expanded and collapsed states

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Components**: Shadcn/ui component library with Radix UI primitives and Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Custom WebSocket service for live order updates
- **Authentication**: Replit OpenID Connect authentication with session-based authentication

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Data Storage**: PostgreSQL database with Drizzle ORM for type-safe queries
- **Real-time Communication**: WebSocket server using native ws library for role-based broadcasts
- **Authentication**: Replit OpenID Connect with Passport.js and session storage
- **API Design**: RESTful endpoints with proper error handling and logging middleware

### Database Schema Design
- **ORM**: Drizzle ORM configured for PostgreSQL with migration support
- **Tables**: Users (with role-based access and names), Tables, Menu Items, Orders, and Order Items
- **Relationships**: Foreign key constraints between orders, users, and menu items
- **Enums**: Predefined roles (waiter, cashier, manager), order statuses, and table statuses
- **User Profiles**: Name field added to users table with profile update API endpoints

### Authentication and Authorization
- **Replit Auth Integration**: OpenID Connect authentication with automatic token refresh
- **Role-based Access Control**: Three distinct user roles with specific dashboard access
- **Protected Routes**: Server-side authentication middleware with client-side role checking
- **Session Management**: PostgreSQL session storage with secure cookie handling

### Real-time Features
- **WebSocket Architecture**: Role-based room management for targeted updates
- **Order Status Broadcasting**: Real-time notifications when orders change status
- **Automatic Reconnection**: Client-side reconnection logic with exponential backoff
- **Event-driven Updates**: Query invalidation triggered by WebSocket events

### Payment Processing
- **Cash-only System**: Simplified payment flow where waiters collect cash before order submission
- **Payment Validation**: Orders require payment confirmation before kitchen processing
- **Audit Trail**: Cash received amount and payment timestamps for reporting
- **Multi-Currency Support**: Configurable currency display (EUR, USD, GBP, JPY) with Euro as default

### Table Management
- **Dynamic Table Creation**: Admins can create new tables with unique numbers
- **Visual Table Status**: Real-time display of table occupancy (free/occupied) with color coding
- **Flexible Assignment**: Configurable table assignments per waiter or global access mode
- **Dynamic Status Tracking**: Real-time table occupancy status updates
- **Manager Controls**: Administrative interface for table creation and assignment management

### Profile Management
- **User Profile Editing**: All users can update display names and passwords
- **Display Name Format**: Headers show "Name / @username" when name is set, "@username" otherwise
- **Secure Updates**: Password changes are properly hashed and JWT tokens refreshed
- **Password Change Reminders**: Security banner encourages users to change default passwords
- **Accessible Profile Access**: All dashboard roles have profile buttons (header or sidebar) to access password change functionality

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection (configured but using in-memory storage)
- **drizzle-orm & drizzle-kit**: Database ORM and migration tools
- **@tanstack/react-query**: Server state management and caching
- **jsonwebtoken & bcryptjs**: Authentication and password security
- **ws**: WebSocket server implementation

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant API for component styling
- **lucide-react**: Icon library for consistent iconography

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Type safety and enhanced developer experience
- **tsx**: TypeScript execution for server development
- **esbuild**: Fast bundling for production builds

### Optional Integrations
- **Replit Integration**: Development environment optimizations with cartographer and error overlay plugins
- **Date Utilities**: date-fns for timestamp formatting and manipulation