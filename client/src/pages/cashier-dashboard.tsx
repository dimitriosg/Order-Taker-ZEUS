import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanBarcode, Clock, Check, Receipt, LogOut, Bell, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfileModal } from "@/components/ProfileModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { OrderStatusBadge, OrderStatusProgress } from "@/components/OrderStatusBadge";

interface Order {
  id: string;
  tableNumber: number;
  status: "paid" | "in-prep" | "ready" | "served";
  waiterId: string;
  cashReceived: number;
  createdAt: string;
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    notes?: string;
  }>;
}

export default function CashierDashboard() {
  const { user } = useAuth();
  
  const logout = () => {
    window.location.href = "/api/logout";
  };
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Fetch orders by status
  const { data: newOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders/status/paid"],
  });

  const { data: inPrepOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders/status/in-prep"],
  });

  const { data: readyOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders/status/ready"],
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/orders/${orderId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status"] });
      toast({
        title: "Order status updated",
        description: "Order has been moved to the next stage",
      });
    },
  });

  // Socket listeners
  useEffect(() => {
    const handleNewOrder = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/paid"] });
      toast({
        title: "New Order Received!",
        description: `Table ${data.order.tableNumber} has placed a new order`,
      });
    };

    socket.on("newOrder", handleNewOrder);

    return () => {
      socket.off("newOrder", handleNewOrder);
    };
  }, [socket, queryClient, toast]);

  const stats = {
    newOrders: newOrders.length,
    inPrep: inPrepOrders.length,
    ready: readyOrders.length,
    totalToday: newOrders.length + inPrepOrders.length + readyOrders.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ImpersonationBanner user={user} />
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <ScanBarcode className="text-emerald-600 text-xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Cashier Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-700">Live</span>
              </div>
              <span className="text-sm text-gray-600">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Cashier'}
              </span>
              <Button variant="ghost" onClick={() => setShowProfileModal(true)} size="sm">
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={logout} size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Receipt className="text-blue-600 text-xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">New Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.newOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="text-amber-600 text-xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">In Preparation</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inPrep}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Check className="text-green-600 text-xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ready</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.ready}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Receipt className="text-purple-600 text-xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Orders */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                New Orders (Paid)
              </h2>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {newOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No new orders</p>
              ) : (
                newOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 order-card-enter">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-green-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {order.items.map((item, index) => (
                          <p key={index} className="text-sm text-gray-700">
                            {item.quantity}x Item #{item.menuItemId.slice(-6)}
                          </p>
                        ))}
                      </div>
                      
                      {/* Order Progress */}
                      <div className="mb-4 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-2">Order Progress</p>
                        <OrderStatusProgress currentStatus={order.status} animated={true} />
                      </div>
                      
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        onClick={() => updateStatusMutation.mutate({
                          orderId: order.id,
                          status: "in-prep"
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Start Preparation
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </Card>

          {/* In Preparation */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-amber-500 rounded-full mr-3"></span>
                In Preparation
              </h2>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {inPrepOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No orders in preparation</p>
              ) : (
                inPrepOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 order-card-enter order-card-in-prep">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-amber-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {order.items.map((item, index) => (
                          <p key={index} className="text-sm text-gray-700">
                            {item.quantity}x Item #{item.menuItemId.slice(-6)}
                          </p>
                        ))}
                      </div>
                      
                      {/* Order Progress */}
                      <div className="mb-4 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-2">Order Progress</p>
                        <OrderStatusProgress currentStatus={order.status} animated={true} />
                      </div>
                      
                      <Button
                        className="w-full bg-green-500 hover:bg-green-600"
                        onClick={() => updateStatusMutation.mutate({
                          orderId: order.id,
                          status: "ready"
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark as Ready
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </Card>

          {/* Ready for Pickup */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                Ready for Pickup
              </h2>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {readyOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No orders ready</p>
              ) : (
                readyOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 bg-green-50 order-card-enter order-card-ready">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">Ready for pickup</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-green-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {order.items.map((item, index) => (
                          <p key={index} className="text-sm text-gray-700">
                            {item.quantity}x Item #{item.menuItemId.slice(-6)}
                          </p>
                        ))}
                      </div>
                      
                      {/* Order Progress */}
                      <div className="mb-4 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-2">Order Progress</p>
                        <OrderStatusProgress currentStatus={order.status} animated={true} />
                      </div>
                      
                      <div className="flex items-center justify-center p-2 bg-green-100 rounded-lg ready-notification">
                        <Bell className="text-green-600 mr-2 h-4 w-4" />
                        <span className="text-sm font-medium text-green-700">Ready - Notify Waiter</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
      />
    </div>
  );
}
