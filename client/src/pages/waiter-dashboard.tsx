import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Utensils, Receipt, Menu, LogOut, Check, Clock, Plus, User, Edit } from "lucide-react";
import { NewOrderModal } from "@/components/NewOrderModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Table {
  id: string;
  number: number;
  name?: string | null;
  status: "free" | "occupied";
}

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

export default function WaiterDashboard() {
  const { user } = useAuth() as { user: any };
  
  const logout = () => {
    window.location.href = "/api/logout";
  };
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeView, setActiveView] = useState("tables");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableName, setEditingTableName] = useState("");

  // Fetch tables
  const { data: tables = [], isLoading: tablesLoading } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
  });

  // Fetch waiter's orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch staff to show table assignments
  const { data: staff = [], isLoading: staffLoading } = useQuery<any[]>({
    queryKey: ["/api/staff"],
  });

  // Mark order as served mutation
  const markServedMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("PUT", `/api/orders/${orderId}/status`, {
        status: "served"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Order marked as served",
        description: "The order has been completed successfully",
      });
    },
  });

  // Update table name mutation
  const updateTableNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PUT", `/api/tables/${id}/name`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Table name updated",
        description: "Table name has been saved successfully",
      });
      setEditingTableId(null);
      setEditingTableName("");
    },
  });

  // Socket listeners
  useEffect(() => {
    const handleOrderUpdate = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      if (data.order.status === "ready") {
        toast({
          title: "Order Ready!",
          description: `Table ${data.order.tableNumber} order is ready for pickup`,
        });
      }
    };

    const handleCrossWaiterOrder = (data: any) => {
      // Only show notification if this is for the assigned waiter
      if (data.assignedWaiterId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
        
        toast({
          title: "Order Taken on Your Behalf",
          description: data.message,
          duration: 8000, // Show longer for important notifications
        });
      }
    };

    socket.on("orderStatusUpdated", handleOrderUpdate);
    socket.on("cross_waiter_order", handleCrossWaiterOrder);

    return () => {
      socket.off("orderStatusUpdated", handleOrderUpdate);
      socket.off("cross_waiter_order", handleCrossWaiterOrder);
    };
  }, [socket, queryClient, toast, user?.id]);

  const handleTableSelect = (tableNumber: number) => {
    const assignedWaiter = getTableAssignedWaiter(tableNumber);
    const isMyTable = user?.assignedTables?.includes(tableNumber);
    
    // If taking order for someone else's table, show confirmation
    if (assignedWaiter && !isMyTable) {
      const confirmed = window.confirm(
        `This table is assigned to ${getUserDisplayName(assignedWaiter)}. ` +
        `Taking this order will notify them that you've handled it on their behalf. Continue?`
      );
      if (!confirmed) return;
    }
    
    setSelectedTable(tableNumber);
    setShowOrderModal(true);
  };

  const getTableStatus = (tableNumber: number) => {
    const table = tables.find(t => t.number === tableNumber);
    const hasActiveOrder = orders.some(order => 
      order.tableNumber === tableNumber && order.status !== "served"
    );
    
    if (hasActiveOrder) {
      const order = orders.find(o => o.tableNumber === tableNumber && o.status !== "served");
      return {
        status: order?.status === "ready" ? "ready" : "occupied",
        color: order?.status === "ready" ? "red" : "amber"
      };
    }
    
    return { status: "free", color: "green" };
  };

  // Show all tables but indicate accessibility
  const filteredTables = tables;

  const activeOrders = orders.filter(order => order.status !== "served");

  // Format table display name
  const getTableDisplayName = (table: Table) => {
    if (table.name) {
      return `${table.name} / Table ${table.number}`;
    }
    return `Table ${table.number}`;
  };

  // Handle table name edit
  const handleTableNameEdit = (table: Table) => {
    setEditingTableId(table.id);
    setEditingTableName(table.name || "");
  };

  const handleTableNameSave = () => {
    if (editingTableId) {
      updateTableNameMutation.mutate({
        id: editingTableId,
        name: editingTableName.trim()
      });
    }
  };

  const handleTableNameCancel = () => {
    setEditingTableId(null);
    setEditingTableName("");
  };

  // Get assigned waiter for a table
  const getTableAssignedWaiter = (tableNumber: number) => {
    return staff.find(s => s.role === 'waiter' && s.assignedTables?.includes(tableNumber));
  };

  // Check if current user can take orders for this table
  const canTakeOrderForTable = (tableNumber: number) => {
    const assignedWaiter = getTableAssignedWaiter(tableNumber);
    const hasActiveOrder = orders.some(order => 
      order.tableNumber === tableNumber && order.status !== "served"
    );
    
    // Can take order if: assigned to this table, OR no one assigned, OR table has active order (cross-waiter support)
    return !assignedWaiter || 
           (user?.assignedTables?.includes(tableNumber)) || 
           hasActiveOrder;
  };

  // Get user display name
  const getUserDisplayName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email || 'Unknown';
  };

  if (tablesLoading || ordersLoading || staffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ImpersonationBanner user={user} />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Utensils className="text-emerald-600 text-xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Waiter Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Waiter'}
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

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="hidden lg:block w-64 bg-white shadow-sm">
          <div className="p-4 space-y-2">
            <Button
              variant={activeView === "tables" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("tables")}
            >
              <Utensils className="mr-3 h-4 w-4" />
              Tables
            </Button>
            <Button
              variant={activeView === "orders" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("orders")}
            >
              <Receipt className="mr-3 h-4 w-4" />
              My Orders
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          {activeView === "tables" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Tables</h2>
                <Button
                  className="lg:hidden"
                  onClick={() => setActiveView("orders")}
                  variant="outline"
                >
                  View Orders
                </Button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredTables.map((table) => {
                  const { status, color } = getTableStatus(table.number);
                  return (
                    <Card
                      key={table.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${
                        color === "green" ? "border-green-200" :
                        color === "amber" ? "border-amber-200" : "border-red-200"
                      }`}
                      onClick={() => handleTableSelect(table.number)}
                    >
                      <CardContent className="p-6 text-center">
                        <div className={`w-12 h-12 ${
                          color === "green" ? "bg-green-100" :
                          color === "amber" ? "bg-amber-100" : "bg-red-100"
                        } rounded-full flex items-center justify-center mx-auto mb-3`}>
                          {status === "ready" ? (
                            <Utensils className={`text-red-600 h-5 w-5`} />
                          ) : status === "occupied" ? (
                            <Clock className={`text-amber-600 h-5 w-5`} />
                          ) : (
                            <Check className={`text-green-600 h-5 w-5`} />
                          )}
                        </div>
                        {editingTableId === table.id ? (
                          <div className="flex flex-col items-center space-y-2">
                            <input
                              type="text"
                              value={editingTableName}
                              onChange={(e) => setEditingTableName(e.target.value)}
                              placeholder="Custom name"
                              className="text-xs border border-gray-300 rounded px-2 py-1 w-full text-center"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                onClick={handleTableNameSave}
                                disabled={updateTableNameMutation.isPending}
                                className="text-xs h-6 px-2"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleTableNameCancel}
                                disabled={updateTableNameMutation.isPending}
                                className="text-xs h-6 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1">
                            <h3 className="font-semibold text-gray-900 text-center">
                              {getTableDisplayName(table)}
                            </h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTableNameEdit(table);
                              }}
                              className="p-1 h-4 w-4 hover:bg-gray-100"
                            >
                              <Edit className="h-2 w-2" />
                            </Button>
                          </div>
                        )}
                        <p className={`text-sm ${
                          color === "green" ? "text-green-600" :
                          color === "amber" ? "text-amber-600" : "text-red-600"
                        }`}>
                          {status === "ready" ? "Order Ready" :
                           status === "occupied" ? "Occupied" : "Available"}
                        </p>
                        
                        {/* Show assignment information */}
                        {(() => {
                          const assignedWaiter = getTableAssignedWaiter(table.number);
                          const isMyTable = user?.assignedTables?.includes(table.number);
                          const hasActiveOrder = orders.some(order => 
                            order.tableNumber === table.number && order.status !== "served"
                          );
                          const activeOrder = orders.find(order => 
                            order.tableNumber === table.number && order.status !== "served"
                          );
                          
                          if (isMyTable) {
                            return <p className="text-xs text-blue-600 mt-1">Your table</p>;
                          } else if (assignedWaiter) {
                            return (
                              <p className="text-xs text-gray-500 mt-1">
                                Assigned: {getUserDisplayName(assignedWaiter)}
                              </p>
                            );
                          } else if (hasActiveOrder && activeOrder?.waiterId !== user?.id) {
                            const orderWaiter = staff.find(s => s.id === activeOrder?.waiterId);
                            return (
                              <p className="text-xs text-orange-600 mt-1">
                                Order by: {orderWaiter ? getUserDisplayName(orderWaiter) : 'Other waiter'}
                              </p>
                            );
                          }
                          return <p className="text-xs text-gray-400 mt-1">Unassigned</p>;
                        })()}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {activeView === "orders" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Active Orders</h2>
                <Button
                  className="lg:hidden"
                  onClick={() => setActiveView("tables")}
                  variant="outline"
                >
                  View Tables
                </Button>
              </div>
              
              {activeOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Orders</h3>
                    <p className="text-gray-600">Create a new order by selecting a table</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeOrders.map((order) => (
                    <Card key={order.id}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900">Table {order.tableNumber}</h4>
                            <p className="text-sm text-gray-600">
                              Order #{order.id.slice(-6)} - {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge variant={
                            order.status === "paid" ? "secondary" :
                            order.status === "in-prep" ? "default" :
                            order.status === "ready" ? "destructive" : "outline"
                          }>
                            {order.status === "in-prep" ? "In Preparation" :
                             order.status === "ready" ? "Ready" : order.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.quantity}x Item #{item.menuItemId.slice(-6)}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                          <span className="font-semibold">Cash: ${order.cashReceived}</span>
                          {order.status === "ready" && (
                            <Button
                              onClick={() => markServedMutation.mutate(order.id)}
                              disabled={markServedMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {markServedMutation.isPending ? "Marking..." : "Mark as Served"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showOrderModal && selectedTable && (
        <NewOrderModal
          tableNumber={selectedTable}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedTable(null);
          }}
        />
      )}
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
      />
    </div>
  );
}
