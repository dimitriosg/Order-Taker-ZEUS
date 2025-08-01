# Restaurant Order Management System

## Overview

This is a full-stack restaurant order management system built with React, Express, and TypeScript. The application provides role-based dashboards for waiters, cashiers, and managers to handle cash-only orders and table management in a restaurant environment. The system emphasizes real-time communication and streamlined workflow from order creation to completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Components**: Shadcn/ui component library with Radix UI primitives and Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Custom WebSocket service for live order updates
- **Authentication**: JWT-based authentication with context providers

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Data Storage**: In-memory storage implementation with interface for future database integration
- **Real-time Communication**: WebSocket server using native ws library for role-based broadcasts
- **Authentication**: JWT tokens with bcrypt for password hashing
- **API Design**: RESTful endpoints with proper error handling and logging middleware

### Database Schema Design
- **ORM**: Drizzle ORM configured for PostgreSQL with migration support
- **Tables**: Users (with role-based access), Tables, Menu Items, Orders, and Order Items
- **Relationships**: Foreign key constraints between orders, users, and menu items
- **Enums**: Predefined roles (waiter, cashier, manager), order statuses, and table statuses

### Authentication and Authorization
- **JWT Implementation**: Token-based authentication with automatic expiration checking
- **Role-based Access Control**: Three distinct user roles with specific dashboard access
- **Protected Routes**: Client-side route protection based on user roles
- **Session Management**: localStorage token persistence with automatic logout on expiration

### Real-time Features
- **WebSocket Architecture**: Role-based room management for targeted updates
- **Order Status Broadcasting**: Real-time notifications when orders change status
- **Automatic Reconnection**: Client-side reconnection logic with exponential backoff
- **Event-driven Updates**: Query invalidation triggered by WebSocket events

### Payment Processing
- **Cash-only System**: Simplified payment flow where waiters collect cash before order submission
- **Payment Validation**: Orders require payment confirmation before kitchen processing
- **Audit Trail**: Cash received amount and payment timestamps for reporting

### Table Management
- **Flexible Assignment**: Configurable table assignments per waiter or global access mode
- **Dynamic Status Tracking**: Real-time table occupancy status updates
- **Manager Controls**: Administrative interface for table assignment management

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