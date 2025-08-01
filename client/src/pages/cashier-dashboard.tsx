import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScanBarcode, Clock, Check, Receipt, LogOut, Bell, User, DollarSign, ShoppingCart, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showOrderStatusNotification, showNewOrderNotification } from "@/lib/orderNotifications";
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
  waiter?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    notes?: string;
    menuItem?: {
      id: string;
      name: string;
      price: number;
      category: string;
    };
  }>;
}

export default function CashierDashboard() {
  const { user } = useAuth() as { user: any };
  
  const logout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      // Clear all cached data
      queryClient.clear();
      // Redirect to landing page
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTillModal, setShowTillModal] = useState(false);
  const [tillStartAmount, setTillStartAmount] = useState<number>(() => {
    const saved = localStorage.getItem('tillStartAmount');
    return saved ? parseFloat(saved) : 0;
  });
  const [tillInput, setTillInput] = useState<string>("");

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

  // Fetch all orders for total statistics
  const { data: allOrdersData = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Sort orders by creation time (oldest first)
  const sortedNewOrders = [...newOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sortedInPrepOrders = [...inPrepOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sortedReadyOrders = [...readyOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Calculate statistics
  const activeOrders = [...newOrders, ...inPrepOrders, ...readyOrders];
  const totalOrderValue = allOrdersData.reduce((total, order) => 
    total + (order.items || []).reduce((orderTotal, item) => 
      orderTotal + ((item.menuItem?.price || 0) * item.quantity), 0
    ), 0
  );
  const totalOrdersReceived = allOrdersData.length;
  const currentTillTotal = tillStartAmount + totalOrderValue;

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all order status queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/paid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/in-prep"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/ready"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
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
      
      // Show new order notification
      showNewOrderNotification({
        order: data.order,
        userRole: 'cashier'
      });
    };

    const handleOrderStatusUpdate = (data: any) => {
      // Refresh all order status queries when any order status changes
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/paid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/in-prep"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/status/ready"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      
      // Show comprehensive status notification
      showOrderStatusNotification({
        order: data.order,
        userRole: 'cashier',
        previousStatus: data.previousStatus
      });
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("order_status_updated", handleOrderStatusUpdate);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("order_status_updated", handleOrderStatusUpdate);
    };
  }, [socket, queryClient, toast]);

  const handleTillStart = () => {
    const amount = parseFloat(tillInput);
    if (!isNaN(amount) && amount >= 0) {
      setTillStartAmount(amount);
      localStorage.setItem('tillStartAmount', amount.toString());
      setShowTillModal(false);
      setTillInput("");
      toast({
        title: "Till amount set",
        description: `Starting amount set to $${amount.toFixed(2)}`,
      });
    }
  };

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
              <Button variant="ghost" onClick={() => setShowTillModal(true)} size="sm">
                <Settings className="h-4 w-4" />
              </Button>
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
        {/* Till and Order Summary - First Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Till Starting Amount</p>
                <p className="text-2xl font-bold text-green-600">${tillStartAmount.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Order Value</p>
                <p className="text-2xl font-bold text-blue-600">${totalOrderValue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Till Total</p>
                <p className="text-2xl font-bold text-emerald-600">${currentTillTotal.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-purple-600">{totalOrdersReceived}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Receipt className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Order Status Summary - Second Row */}
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
                  <ShoppingCart className="text-purple-600 text-xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{activeOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              {sortedNewOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No new orders</p>
              ) : (
                sortedNewOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 order-card-enter">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                          {order.waiter && (
                            <p className="text-xs text-blue-600 mt-1">
                              Waiter: {order.waiter.firstName && order.waiter.lastName 
                                ? `${order.waiter.firstName} ${order.waiter.lastName}` 
                                : order.waiter.email}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-green-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {(order.items || []).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-700">
                            <span>{item.quantity}x {item.menuItem?.name || `Item #${item.menuItemId.slice(-6)}`}</span>
                            <span className="font-medium">${(item.menuItem?.price * item.quantity || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t pt-2 mb-4">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total:</span>
                          <span className="text-green-600">
                            ${(order.items || []).reduce((total, item) => 
                              total + ((item.menuItem?.price || 0) * item.quantity), 0
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>Cash Received:</span>
                          <span>${order.cashReceived?.toFixed(2) || '0.00'}</span>
                        </div>
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
              {sortedInPrepOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No orders in preparation</p>
              ) : (
                sortedInPrepOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 order-card-enter order-card-in-prep">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                          {order.waiter && (
                            <p className="text-xs text-blue-600 mt-1">
                              Waiter: {order.waiter.firstName && order.waiter.lastName 
                                ? `${order.waiter.firstName} ${order.waiter.lastName}` 
                                : order.waiter.email}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-amber-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {(order.items || []).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-700">
                            <span>{item.quantity}x {item.menuItem?.name || `Item #${item.menuItemId.slice(-6)}`}</span>
                            <span className="font-medium">${(item.menuItem?.price * item.quantity || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t pt-2 mb-4">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total:</span>
                          <span className="text-green-600">
                            ${(order.items || []).reduce((total, item) => 
                              total + ((item.menuItem?.price || 0) * item.quantity), 0
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>Cash Received:</span>
                          <span>${order.cashReceived?.toFixed(2) || '0.00'}</span>
                        </div>
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
              {sortedReadyOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No orders ready</p>
              ) : (
                sortedReadyOrders.map((order) => (
                  <Card key={order.id} className="border border-gray-200 bg-green-50 order-card-enter order-card-ready">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Table {order.tableNumber}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">Ready for pickup</p>
                          {order.waiter && (
                            <p className="text-xs text-blue-600 mt-1 font-medium">
                              Waiter: {order.waiter.firstName && order.waiter.lastName 
                                ? `${order.waiter.firstName} ${order.waiter.lastName}` 
                                : order.waiter.email}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <OrderStatusBadge status={order.status} animated={true} size="sm" />
                          <span className="text-sm font-medium text-green-600">
                            ${order.cashReceived}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {(order.items || []).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-700">
                            <span>{item.quantity}x {item.menuItem?.name || `Item #${item.menuItemId.slice(-6)}`}</span>
                            <span className="font-medium">${(item.menuItem?.price * item.quantity || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t pt-2 mb-4">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total:</span>
                          <span className="text-green-600">
                            ${(order.items || []).reduce((total, item) => 
                              total + ((item.menuItem?.price || 0) * item.quantity), 0
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>Cash Received:</span>
                          <span>${order.cashReceived?.toFixed(2) || '0.00'}</span>
                        </div>
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

      {/* Till Settings Modal */}
      <Dialog open={showTillModal} onOpenChange={setShowTillModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Till Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Current Till Total</p>
              <p className="text-3xl font-bold text-green-600">${currentTillTotal.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Start: ${tillStartAmount.toFixed(2)} + Orders: ${totalOrderValue.toFixed(2)}
              </p>
            </div>

            <div>
              <Label htmlFor="tillAmount">Set Starting Till Amount</Label>
              <div className="mt-2">
                <Input
                  id="tillAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={tillInput}
                  onChange={(e) => setTillInput(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the amount of cash you started with in the till
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleTillStart}
                disabled={!tillInput || isNaN(parseFloat(tillInput))}
                className="flex-1"
              >
                Set Amount
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTillModal(false);
                  setTillInput("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
