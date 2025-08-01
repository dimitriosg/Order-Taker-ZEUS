import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "@/pages/login";
import WaiterDashboard from "@/pages/waiter-dashboard";
import CashierDashboard from "@/pages/cashier-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/waiter">
        <ProtectedRoute requiredRole="waiter">
          <WaiterDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/cashier">
        <ProtectedRoute requiredRole="cashier">
          <CashierDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager">
        <ProtectedRoute requiredRole="manager">
          <ManagerDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/">
        {user ? <Redirect to={`/${user.role}`} /> : <Redirect to="/login" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <Toaster />
            <Router />
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
