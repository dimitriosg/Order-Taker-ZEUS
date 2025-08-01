import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { ChefHat, Users, DollarSign, BarChart3 } from "lucide-react";

export function Landing() {
  const handleLogin = (role: 'manager' | 'waiter' | 'cashier') => {
    // For demo purposes, we'll simulate login by updating the mock user role
    localStorage.setItem('mockUserRole', role);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <ChefHat className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Restaurant Order Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Streamline your restaurant operations with our comprehensive order management system. 
            Perfect for cash-only establishments with role-based access for waiters, cashiers, and managers.
          </p>
          
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-sm mb-8">
            <h3 className="text-lg font-semibold mb-4">Demo Login</h3>
            <p className="text-sm text-gray-600 mb-4">Choose your role to explore the system:</p>
            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleLogin('manager')}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Login as Manager
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="w-full"
                onClick={() => handleLogin('waiter')}
              >
                <Users className="mr-2 h-4 w-4" />
                Login as Waiter
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="w-full"
                onClick={() => handleLogin('cashier')}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Login as Cashier
              </Button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-blue-600" />
                For Waiters
              </CardTitle>
              <CardDescription>
                Take orders, collect payments, and manage table assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Table management</li>
                <li>• Order creation</li>
                <li>• Cash collection</li>
                <li>• Real-time updates</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5 text-green-600" />
                For Cashiers
              </CardTitle>
              <CardDescription>
                Process orders, manage kitchen workflow, and track payments
              </CardDescription>  
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Order processing</li>
                <li>• Kitchen notifications</li>
                <li>• Payment tracking</li>
                <li>• Status updates</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5 text-purple-600" />
                For Managers
              </CardTitle>
              <CardDescription>
                Monitor operations, manage staff, and analyze performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Staff management</li>
                <li>• Real-time monitoring</li>
                <li>• Revenue analytics</li>
                <li>• System configuration</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Key Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-4">💳</div>
              <h3 className="font-semibold mb-2">Cash-Only System</h3>
              <p className="text-sm text-gray-600">Optimized for restaurants that operate with cash payments only</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="font-semibold mb-2">Real-Time Updates</h3>
              <p className="text-sm text-gray-600">WebSocket-powered live updates across all devices</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="font-semibold mb-2">Role-Based Access</h3>
              <p className="text-sm text-gray-600">Tailored dashboards for waiters, cashiers, and managers</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="font-semibent mb-2">Mobile Friendly</h3>
              <p className="text-sm text-gray-600">Responsive design that works on all devices</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}