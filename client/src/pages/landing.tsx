import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat } from "lucide-react";

export function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <ChefHat className="h-10 w-10 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Restaurant Management</CardTitle>
          <CardDescription>
            Professional order management system for restaurants with role-based access for waiters, cashiers, and managers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Real-time order tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Cash-only payment workflow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span>Dynamic table management</span>
            </div>
          </div>
          <Button 
            onClick={handleLogin} 
            className="w-full bg-orange-600 hover:bg-orange-700"
            size="lg"
          >
            Sign In to Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}