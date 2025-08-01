import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SocketProvider } from "@/contexts/SocketContext";
import { useAuth } from "@/hooks/useAuth";

import { Landing } from "@/pages/landing";
import WaiterDashboard from "@/pages/waiter-dashboard";
import CashierDashboard from "@/pages/cashier-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If user is not authenticated or there's an error, show landing page
  if (!isAuthenticated || error) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  // User is authenticated, show role-based dashboard
  return (
    <Switch>
      <Route path="/waiter">
        <WaiterDashboard />
      </Route>
      
      <Route path="/cashier">
        <CashierDashboard />
      </Route>
      
      <Route path="/manager">
        <ManagerDashboard />
      </Route>
      
      <Route path="/">
        {user?.role === 'manager' && <Redirect to="/manager" />}
        {user?.role === 'waiter' && <Redirect to="/waiter" />}
        {user?.role === 'cashier' && <Redirect to="/cashier" />}
        {!user?.role && <Redirect to="/manager" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SocketProvider>
          <Toaster />
          <Router />
        </SocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
