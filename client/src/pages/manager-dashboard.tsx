import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, Users, Table, Menu, LogOut, Plus, Edit, Trash2, User, Download, TrendingUp, Clock, DollarSign, Settings, Receipt, Check, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { AddStaffModal } from "@/components/AddStaffModal";
import { AddTableModal } from "@/components/AddTableModal";
import { BatchTableModal } from "@/components/BatchTableModal";
import { BatchAssignModal } from "@/components/BatchAssignModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ImpersonateModal } from "@/components/ImpersonateModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { PasswordChangeReminder } from "@/components/PasswordChangeReminder";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";
import { EditUserModal } from "@/components/EditUserModal";
import { DeleteUserModal } from "@/components/DeleteUserModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/contexts/SocketContext";
import { showOrderStatusNotification, showNewOrderNotification } from "@/lib/orderNotifications";

interface Order {
  id: string;
  tableNumber: number;
  status: "paid" | "in-prep" | "ready" | "served";
  waiterId?: string | null;
  cashierId?: string | null;
  paid: boolean;
  cashReceived?: number | null;
  createdAt?: string;
  totalAmount?: number;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  notes?: string | null;
}

interface Staff {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role: "waiter" | "cashier" | "manager";
  assignedTables?: number[] | null;
  createdAt?: string;
  updatedAt?: string;
}

interface TableData {
  id: string;
  number: number;
  name?: string | null;
  status: "free" | "occupied";
}

export default function ManagerDashboard() {
  const { user } = useAuth() as { user: Staff | undefined };
  
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      const response = await apiRequest("POST", "/api/logout", {});
      if (response.ok) {
        // Clear all cached data
        queryClient.clear();
        // Clear any localStorage data
        localStorage.removeItem('mockUserRole');
        localStorage.removeItem('auth_token');
        // Force page reload to reset all state
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
    setShowLogoutConfirm(false);
  };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const socket = useSocket();
  const [activeView, setActiveView] = useState("overview");
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showRemoveTableModal, setShowRemoveTableModal] = useState(false);
  const [showAssignTableModal, setShowAssignTableModal] = useState(false);
  const [selectedWaiterForAssignment, setSelectedWaiterForAssignment] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableName, setEditingTableName] = useState("");
  const [globalTables, setGlobalTables] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Staff | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds default
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Fetch staff
  const { data: staff = [], isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  // Fetch tables
  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableData[]>({
    queryKey: ["/api/tables"],
  });

  // Fetch orders for monitoring
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchInterval: activeView === "monitor" ? refreshInterval : false,
  });

  // Socket listeners for real-time notifications
  useEffect(() => {
    const handleNewOrder = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      // Show new order notification
      showNewOrderNotification({
        order: data.order,
        userRole: 'manager'
      });
    };

    const handleOrderStatusUpdate = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      // Show comprehensive status notification
      showOrderStatusNotification({
        order: data.order,
        userRole: 'manager',
        previousStatus: data.previousStatus
      });
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("order_status_updated", handleOrderStatusUpdate);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("order_status_updated", handleOrderStatusUpdate);
    };
  }, [socket, queryClient]);

  // Update table assignments mutation
  const updateTablesMutation = useMutation({
    mutationFn: async ({ staffId, assignedTables }: { staffId: string; assignedTables: number[] }) => {
      const response = await apiRequest("PUT", `/api/staff/${staffId}/tables`, { assignedTables });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Table assignments updated",
        description: "Staff member's table assignments have been saved",
      });
    },
  });

  // Create table mutation (supports both single and batch)
  const createTableMutation = useMutation({
    mutationFn: async (data: { tables: number[] }) => {
      const response = await apiRequest("POST", "/api/tables/batch", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Tables created",
        description: `${data.created} table(s) added successfully`,
      });
      setShowAddTableModal(false);
    },
  });

  // Remove table mutation (supports both single and batch)
  const removeTableMutation = useMutation({
    mutationFn: async (data: { tables: number[] }) => {
      const response = await apiRequest("DELETE", "/api/tables/batch", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Tables removed",
        description: `${data.removed} table(s) removed successfully`,
      });
      setShowRemoveTableModal(false);
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

  const toggleTableAssignment = (staffId: string, tableNumber: number) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;

    const currentTables = staffMember.assignedTables || [];
    const newTables = currentTables.includes(tableNumber)
      ? currentTables.filter(t => t !== tableNumber)
      : [...currentTables, tableNumber];

    updateTablesMutation.mutate({ staffId, assignedTables: newTables });
  };

  const waiters = staff.filter(s => s.role === "waiter");

  // Format table display name
  const getTableDisplayName = (table: TableData) => {
    if (table.name) {
      return `${table.name} / Table ${table.number}`;
    }
    return `Table ${table.number}`;
  };

  // Format user display name
  const getUserDisplayName = (user: Staff) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email || 'Unknown User';
  };

  // Handle table name edit
  const handleTableNameEdit = (table: TableData) => {
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

  // Refresh interval options
  const refreshIntervalOptions = [
    { value: 2000, label: "2s" },
    { value: 5000, label: "5s" },
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
    { value: 60000, label: "1min" },
    { value: 120000, label: "2min" },
    { value: 300000, label: "5min" },
  ];

  const currencySymbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥"
  };

  // CSV Export functionality
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: "No data to export",
        description: "There's no data available to download.",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => 
        typeof row[header] === 'string' && row[header].includes(',') 
          ? `"${row[header]}"` 
          : row[header]
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `${filename} has been downloaded as CSV`,
    });
  };

  // Calculate real stats from orders data
  const todayStats = {
    revenue: orders.reduce((total, order) => 
      total + (order.items || []).reduce((orderTotal, item) => 
        orderTotal + (((item as any).menuItem?.price || 0) * item.quantity), 0
      ), 0
    ),
    ordersCompleted: orders.filter(order => order.status === "served").length,
    activeTables: tables.filter(t => t.status === "occupied").length,
    activeStaff: staff.length,
    avgOrderTime: orders.length > 0 ? Math.round(
      orders.reduce((total, order) => {
        const orderTime = new Date(order.createdAt || new Date());
        const timeDiff = Date.now() - orderTime.getTime();
        return total + (timeDiff / (1000 * 60)); // minutes
      }, 0) / orders.length
    ) : 0,
    peakHour: "12:00 PM"
  };

  const handleMetricClick = (metric: string) => {
    setSelectedMetric(metric);
    // In a real app, this would fetch detailed data for the metric
    switch(metric) {
      case 'revenue':
        setActiveView('reports');
        break;
      case 'orders':
        setActiveView('reports');
        break;
      case 'tables':
        setActiveView('tables');
        break;
      case 'staff':
        setActiveView('staff');
        break;
    }
  };

  // Calculate table monitoring data
  const getTableMonitorData = () => {
    return tables.map(table => {
      const tableOrders = orders.filter(order => order.tableNumber === table.number);
      const activeOrder = tableOrders.find(order => order.status !== "served");
      const completedOrders = tableOrders.filter(order => order.status === "served");
      
      // Calculate total revenue from order items and their prices
      const totalRevenue = completedOrders.reduce((sum, order) => {
        const orderTotal = (order.items || []).reduce((orderSum, item) => {
          const itemPrice = (item as any).menuItem?.price || 0;
          return orderSum + (itemPrice * item.quantity);
        }, 0);
        return sum + orderTotal;
      }, 0);
      
      let waitingTime = 0;
      if (activeOrder) {
        const orderTime = new Date(activeOrder.createdAt || new Date());
        waitingTime = Math.floor((Date.now() - orderTime.getTime()) / (1000 * 60)); // minutes
      }

      return {
        ...table,
        activeOrder,
        totalRevenue,
        completedOrdersCount: completedOrders.length,
        waitingTime,
        status: (activeOrder ? "occupied" : "free") as "free" | "occupied"
      };
    });
  };

  if (staffLoading || tablesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <ImpersonationBanner user={user as any} />}
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <BarChart3 className="text-emerald-600 text-xl mr-3" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'M'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm text-gray-600">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'Manager'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("profile")} 
                size="sm"
                className={activeView === "profile" ? "bg-gray-100" : ""}
              >
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleLogoutClick} size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 py-2 space-y-1">
            <Button
              variant={activeView === "overview" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("overview");
                setMobileMenuOpen(false);
              }}
            >
              <BarChart3 className="mr-3 h-4 w-4" />
              Overview
            </Button>
            <Button
              variant={activeView === "reports" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("reports");
                setMobileMenuOpen(false);
              }}
            >
              <Download className="mr-3 h-4 w-4" />
              Reports
            </Button>
            <Button
              variant={activeView === "monitor" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("monitor");
                setMobileMenuOpen(false);
              }}
            >
              <Clock className="mr-3 h-4 w-4" />
              Table Monitor
            </Button>
            <Button
              variant={activeView === "staff" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("staff");
                setMobileMenuOpen(false);
              }}
            >
              <Users className="mr-3 h-4 w-4" />
              Staff Management
            </Button>
            <Button
              variant={activeView === "tables" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("tables");
                setMobileMenuOpen(false);
              }}
            >
              <Table className="mr-3 h-4 w-4" />
              Table Assignment
            </Button>
            <Button
              variant={activeView === "profile" ? "default" : "ghost"}
              className="w-full justify-start text-sm"
              onClick={() => {
                setActiveView("profile");
                setMobileMenuOpen(false);
              }}
            >
              <User className="mr-3 h-4 w-4" />
              Edit Profile
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => {
                window.location.href = "/menu-management";
                setMobileMenuOpen(false);
              }}
            >
              <Menu className="mr-3 h-4 w-4" />
              Menu Management
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => {
                setShowImpersonateModal(true);
                setMobileMenuOpen(false);
              }}
            >
              <Settings className="mr-3 h-4 w-4" />
              Impersonate
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className={`hidden lg:block ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-sm transition-all duration-300 relative`}>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute -right-3 top-4 z-10 w-6 h-6 rounded-full bg-white shadow-md border hover:bg-gray-50"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
          
          <div className="p-4 space-y-2">
            <Button
              variant={activeView === "overview" ? "default" : "ghost"}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setActiveView("overview")}
              title={sidebarCollapsed ? "Overview" : ""}
            >
              <BarChart3 className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Overview"}
            </Button>
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => window.location.href = '/reports'}
              title={sidebarCollapsed ? "Reports" : ""}
            >
              <FileText className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Reports"}
            </Button>
            <Button
              variant={activeView === "monitor" ? "default" : "ghost"}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setActiveView("monitor")}
              title={sidebarCollapsed ? "Table Monitor" : ""}
            >
              <Clock className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Table Monitor"}
            </Button>
            <Button
              variant={activeView === "staff" ? "default" : "ghost"}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setActiveView("staff")}
              title={sidebarCollapsed ? "Staff Management" : ""}
            >
              <Users className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Staff Management"}
            </Button>
            <Button
              variant={activeView === "tables" ? "default" : "ghost"}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setActiveView("tables")}
              title={sidebarCollapsed ? "Table Assignment" : ""}
            >
              <Table className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Table Assignment"}
            </Button>
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => window.location.href = '/menu-management'}
              title={sidebarCollapsed ? "Menu Management" : ""}
            >
              <Receipt className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Menu Management"}
            </Button>
            <Button
              variant={activeView === "profile" ? "default" : "ghost"}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setActiveView("profile")}
              title={sidebarCollapsed ? "Edit Profile" : ""}
            >
              <User className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Edit Profile"}
            </Button>
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => window.location.href = "/menu-management"}
              title={sidebarCollapsed ? "Menu Management" : ""}
            >
              <Menu className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Menu Management"}
            </Button>
            
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
              onClick={() => setShowImpersonateModal(true)}
              title={sidebarCollapsed ? "Impersonate" : ""}
            >
              <Settings className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && "Impersonate"}
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          <PasswordChangeReminder onChangePassword={() => setActiveView("profile")} />
          
          {activeView === "overview" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Daily Overview</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-xs sm:text-sm text-gray-600">Currency:</span>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <Card className="cursor-pointer hover:bg-gray-50 active:scale-95 transition-all duration-150" onClick={() => handleMetricClick('revenue')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                          <DollarSign className="text-green-600 text-lg sm:text-xl" />
                        </div>
                        <div className="ml-3 sm:ml-4">
                          <p className="text-xs sm:text-sm font-medium text-gray-600">Today's Revenue</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{currencySymbols[currency as keyof typeof currencySymbols]}{todayStats.revenue}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 active:scale-95 transition-all duration-150" onClick={() => handleMetricClick('orders')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                          <BarChart3 className="text-blue-600 text-lg sm:text-xl" />
                        </div>
                        <div className="ml-3 sm:ml-4">
                          <p className="text-xs sm:text-sm font-medium text-gray-600">Orders Completed</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{todayStats.ordersCompleted}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 active:scale-95 transition-all duration-150" onClick={() => handleMetricClick('tables')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 sm:p-3 bg-amber-100 rounded-lg">
                          <Table className="text-amber-600 text-lg sm:text-xl" />
                        </div>
                        <div className="ml-3 sm:ml-4">
                          <p className="text-xs sm:text-sm font-medium text-gray-600">Active Tables</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{todayStats.activeTables}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 active:scale-95 transition-all duration-150" onClick={() => handleMetricClick('staff')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                          <Users className="text-purple-600 text-lg sm:text-xl" />
                        </div>
                        <div className="ml-3 sm:ml-4">
                          <p className="text-xs sm:text-sm font-medium text-gray-600">Active Staff</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{todayStats.activeStaff}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Additional Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                    </div>
                    <div className="space-y-3">
                      <Button 
                        className="w-full justify-start bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => window.location.href = '/reports'}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Reports
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setShowAddTableModal(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Table
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setShowAddStaffModal(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Staff Member
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Performance Insights</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Avg. Order Time</span>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="font-medium">{todayStats.avgOrderTime} min</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Peak Hour</span>
                        <span className="font-medium">{todayStats.peakHour}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Table Turnover</span>
                        <span className="font-medium">0 times</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeView === "reports" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Daily Sales Report</h3>
                      <Download className="text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Export today's sales data including orders, revenue, and payment details.</p>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => downloadCSV([
                        {
                          Date: new Date().toLocaleDateString(),
                          'Total Revenue': `${currencySymbols[currency as keyof typeof currencySymbols]}${todayStats.revenue}`,
                          'Orders Completed': todayStats.ordersCompleted,
                          'Active Tables': todayStats.activeTables,
                          'Staff Count': todayStats.activeStaff,
                          'Avg Order Time': `${todayStats.avgOrderTime} min`,
                          'Peak Hour': todayStats.peakHour
                        }
                      ], 'daily_sales_report')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Staff Performance</h3>
                      <Download className="text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Export staff performance metrics and table assignments.</p>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => downloadCSV(
                        staff.map(member => ({
                          Email: member.email,
                          'Display Name': member.firstName || 'Not set',
                          Role: member.role,
                          'Assigned Tables': member.assignedTables?.join(', ') || 'All Tables',
                          Status: 'Active',
                          'Created Date': new Date(member.createdAt || Date.now()).toLocaleDateString()
                        })), 
                        'staff_performance_report'
                      )}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Table Utilization</h3>
                      <Download className="text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Export table usage statistics and occupancy rates.</p>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => downloadCSV(
                        tables.map(table => ({
                          'Table Number': table.number,
                          Status: table.status,
                          'Current Occupancy': table.status === 'occupied' ? 'Yes' : 'No'
                        })), 
                        'table_utilization_report'
                      )}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <Card className="mb-8">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Export All Data</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Complete Business Report</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Export a comprehensive report including all sales, staff, and table data for business analysis.
                      </p>
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          const businessData = [
                            {
                              'Report Type': 'Business Overview',
                              'Generated Date': new Date().toLocaleDateString(),
                              'Total Tables': tables.length,
                              'Active Tables': todayStats.activeTables,
                              'Total Staff': staff.length,
                              'Total Revenue': `${currencySymbols[currency as keyof typeof currencySymbols]}${todayStats.revenue}`,
                              'Orders Completed': todayStats.ordersCompleted,
                              'Peak Hour': todayStats.peakHour,
                              'Avg Order Time': `${todayStats.avgOrderTime} min`
                            }
                          ];
                          downloadCSV(businessData, 'complete_business_report');
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Business Data
                      </Button>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">System Status Report</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Export system configuration and operational status for technical analysis.
                      </p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const systemData = [
                            {
                              'System Status': 'Operational',
                              'Database Status': 'Connected',
                              'Active Sessions': staff.length,
                              'Total Tables Configured': tables.length,
                              'Currency Setting': currency,
                              'Global Table Access': globalTables ? 'Enabled' : 'Disabled',
                              'Export Date': new Date().toISOString()
                            }
                          ];
                          downloadCSV(systemData, 'system_status_report');
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export System Status
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
              
            </div>
          )}

          {activeView === "monitor" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Real-Time Table Monitor</h2>
                  <p className="text-sm text-gray-600 mt-1">Live monitoring of table status, orders, and revenue</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600">Live Updates</span>
                  </div>
                  <select 
                    value={refreshInterval} 
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    {refreshIntervalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label} refresh
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => downloadCSV(
                      getTableMonitorData().map(table => ({
                        'Table Number': table.number,
                        Status: table.status,
                        'Active Order': table.activeOrder ? `Order #${table.activeOrder.id.slice(-6)}` : 'None',
                        'Order Status': table.activeOrder?.status || 'No Order',
                        'Waiting Time (min)': table.waitingTime,
                        'Today Revenue': `${currencySymbols[currency as keyof typeof currencySymbols]}${table.totalRevenue}`,
                        'Completed Orders': table.completedOrdersCount,
                        'Last Updated': new Date().toLocaleTimeString()
                      })), 
                      'table_monitor_snapshot'
                    )}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Snapshot
                  </Button>
                </div>
              </div>

              {/* Quick Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="text-green-600 text-lg" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-xl font-bold text-gray-900">
                          {currencySymbols[currency as keyof typeof currencySymbols]}
                          {getTableMonitorData().reduce((sum, table) => sum + table.totalRevenue, 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Receipt className="text-blue-600 text-lg" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Total Orders</p>
                        <p className="text-xl font-bold text-gray-900">
                          {getTableMonitorData().reduce((sum, table) => sum + table.completedOrdersCount, 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Check className="text-green-600 text-lg" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Available Tables</p>
                        <p className="text-xl font-bold text-gray-900">
                          {getTableMonitorData().filter(table => table.status === "free").length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Clock className="text-amber-600 text-lg" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Occupied Tables</p>
                        <p className="text-xl font-bold text-gray-900">
                          {getTableMonitorData().filter(table => table.status === "occupied").length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="text-purple-600 text-lg" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
                        <p className="text-xl font-bold text-gray-900">
                          {(() => {
                            const occupiedTables = getTableMonitorData().filter(table => table.status === "occupied" && table.waitingTime > 0);
                            const avgWait = occupiedTables.length > 0 
                              ? Math.round(occupiedTables.reduce((sum, table) => sum + table.waitingTime, 0) / occupiedTables.length)
                              : 0;
                            return `${avgWait}m`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Table Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {getTableMonitorData().map((table) => (
                  <Card key={table.id} className={`border-l-4 ${
                    table.activeOrder?.status === "ready" ? "border-l-red-500 bg-red-50" :
                    table.status === "occupied" ? "border-l-amber-500 bg-amber-50" :
                    "border-l-green-500 bg-green-50"
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {editingTableId === table.id ? (
                            <div className="flex items-center space-x-2 mb-2">
                              <input
                                type="text"
                                value={editingTableName}
                                onChange={(e) => setEditingTableName(e.target.value)}
                                placeholder="Custom name (optional)"
                                className="text-sm border border-gray-300 rounded px-2 py-1 flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={handleTableNameSave}
                                disabled={updateTableNameMutation.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleTableNameCancel}
                                disabled={updateTableNameMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">
                                {getTableDisplayName(table)}
                              </h3>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTableNameEdit(table)}
                                className="p-1 h-6 w-6 hover:bg-gray-100"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            table.activeOrder?.status === "ready" ? "bg-red-100 text-red-800" :
                            table.status === "occupied" ? "bg-amber-100 text-amber-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {table.activeOrder?.status === "ready" ? "🔔 Order Ready" :
                             table.status === "occupied" ? "👥 Occupied" :
                             "✅ Available"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {currencySymbols[currency as keyof typeof currencySymbols]}{table.totalRevenue}
                          </div>
                          <div className="text-xs text-gray-500">Today's Revenue</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {table.activeOrder ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Current Order:</span>
                              <span className="text-sm font-medium">#{table.activeOrder.id}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Status:</span>
                              <span className={`text-sm font-medium ${
                                table.activeOrder.status === "ready" ? "text-red-600" :
                                table.activeOrder.status === "in-prep" ? "text-amber-600" :
                                "text-blue-600"
                              }`}>
                                {table.activeOrder.status === "paid" ? "Preparing" :
                                 table.activeOrder.status === "in-prep" ? "In Kitchen" :
                                 table.activeOrder.status === "ready" ? "Ready to Serve" :
                                 table.activeOrder.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Waiting:</span>
                              <span className={`text-sm font-medium ${
                                table.waitingTime > 30 ? "text-red-600" :
                                table.waitingTime > 15 ? "text-amber-600" :
                                "text-green-600"
                              }`}>
                                {table.waitingTime} min
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Order Total:</span>
                              <span className="text-sm font-medium">
                                {currencySymbols[currency as keyof typeof currencySymbols]}{table.activeOrder.totalAmount || 0}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-sm text-gray-500">No active order</div>
                            <div className="text-xs text-gray-400 mt-1">Table is available</div>
                          </div>
                        )}
                        
                        <div className="border-t pt-2 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Orders Today:</span>
                            <span className="text-xs font-medium">{table.completedOrdersCount}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <DollarSign className="text-green-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {currencySymbols[currency as keyof typeof currencySymbols]}
                          {getTableMonitorData().reduce((sum, table) => sum + table.totalRevenue, 0)}
                        </p>
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
                        <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.round(
                            getTableMonitorData()
                              .filter(t => t.activeOrder)
                              .reduce((sum, table) => sum + table.waitingTime, 0) /
                            Math.max(getTableMonitorData().filter(t => t.activeOrder).length, 1)
                          )} min
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Table className="text-blue-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Orders</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {getTableMonitorData().filter(t => t.activeOrder).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <TrendingUp className="text-red-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Ready to Serve</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {getTableMonitorData().filter(t => t.activeOrder?.status === "ready").length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeView === "tables" && (
            <div>
              <Card className="mb-8">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Table Management & Assignments</h2>
                    <div className="flex items-center space-x-4">
                      <Button
                        onClick={() => setShowAddTableModal(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Tables
                      </Button>
                      <Button
                        onClick={() => setShowRemoveTableModal(true)}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Tables
                      </Button>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="globalTables"
                          checked={globalTables}
                          onCheckedChange={setGlobalTables}
                        />
                        <label htmlFor="globalTables" className="text-sm font-medium text-gray-700">
                          Allow all waiters to access all tables
                        </label>
                      </div>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Tables</h3>
                    <div className="grid grid-cols-8 gap-2">
                      {tables.map((table) => (
                        <div key={table.id} className="text-center">
                          <div className={`w-12 h-12 rounded border-2 flex items-center justify-center ${
                            table.status === "occupied" ? "bg-red-100 border-red-300" : "bg-green-100 border-green-300"
                          }`}>
                            <span className="font-medium">{table.number}</span>
                          </div>
                          <span className={`text-xs ${
                            table.status === "occupied" ? "text-red-600" : "text-green-600"
                          }`}>
                            {table.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">Waiter Assignments</h3>
                    {waiters.map((waiter) => (
                      <div key={waiter.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">{getUserDisplayName(waiter)}</h3>
                            <p className="text-sm text-gray-600">Waiter</p>
                          </div>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Assigned Tables
                            </label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedWaiterForAssignment(waiter.id);
                                setShowAssignTableModal(true);
                              }}
                            >
                              <Settings className="mr-1 h-3 w-3" />
                              Batch Assign
                            </Button>
                          </div>
                          <div className="grid grid-cols-6 gap-2">
                            {tables.map((table) => {
                              const isAssigned = waiter.assignedTables?.includes(table.number) || false;
                              return (
                                <Button
                                  key={table.id}
                                  variant={isAssigned ? "default" : "outline"}
                                  size="sm"
                                  className="w-10 h-10"
                                  onClick={() => toggleTableAssignment(waiter.id, table.number)}
                                  disabled={updateTablesMutation.isPending}
                                >
                                  {table.number}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeView === "staff" && (
            <div>
              <Card>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Staff Management</h2>
                      <p className="text-sm text-gray-600 mt-1">Manage all restaurant staff members and their roles</p>
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        variant="outline"
                        onClick={() => downloadCSV(
                          staff.map(member => ({
                            ID: member.id,
                            Email: member.email,
                            'First Name': member.firstName || 'Not set',
                            'Last Name': member.lastName || 'Not set',
                            Role: member.role,
                            'Assigned Tables': member.assignedTables?.join(', ') || 'All Tables',
                            'Created Date': new Date(member.createdAt || new Date()).toLocaleDateString(),
                            'Updated Date': new Date(member.updatedAt || new Date()).toLocaleDateString()
                          })), 
                          'all_staff_list'
                        )}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setShowAddStaffModal(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Staff Member
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Email / ID</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Full Name</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Assigned Tables</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((staffMember) => (
                          <tr key={staffMember.id} className="border-b border-gray-100">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{staffMember.email}</div>
                              <div className="text-sm text-gray-500">ID: {staffMember.id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-gray-900">
                                {staffMember.firstName && staffMember.lastName 
                                  ? `${staffMember.firstName} ${staffMember.lastName}` 
                                  : "Not set"
                                }
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={
                                staffMember.role === "manager" ? "default" :
                                staffMember.role === "cashier" ? "secondary" : "outline"
                              }>
                                {staffMember.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">Active</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">
                                {staffMember.role === "waiter" 
                                  ? (staffMember.assignedTables?.length 
                                      ? `Tables ${staffMember.assignedTables.join(", ")}`
                                      : "All Tables")
                                  : "All Tables"
                                }
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedUser(staffMember);
                                    setShowEditUserModal(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedUser(staffMember);
                                    setShowDeleteUserModal(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeView === "profile" && (
            <div>
              <Card>
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                  <p className="text-sm text-gray-600 mt-1">Update your personal information and account settings</p>
                </div>
                <div className="p-6">
                  <ProfileEditForm />
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {showAddStaffModal && (
        <AddStaffModal onClose={() => setShowAddStaffModal(false)} />
      )}
      <BatchTableModal 
        open={showAddTableModal} 
        onOpenChange={setShowAddTableModal}
        onSubmit={(tables) => createTableMutation.mutate({ tables })}
        isLoading={createTableMutation.isPending}
        title="Add Tables"
        description="Add tables individually or in batches"
        existingTables={tables.map(t => t.number)}
        mode="add"
      />
      <BatchTableModal 
        open={showRemoveTableModal} 
        onOpenChange={setShowRemoveTableModal}
        onSubmit={(tables) => removeTableMutation.mutate({ tables })}
        isLoading={removeTableMutation.isPending}
        title="Remove Tables"
        description="Remove tables individually or in batches"
        existingTables={tables.map(t => t.number)}
        mode="remove"
      />
      <BatchAssignModal 
        open={showAssignTableModal} 
        onOpenChange={setShowAssignTableModal}
        waiterId={selectedWaiterForAssignment}
        waiterName={selectedWaiterForAssignment ? getUserDisplayName(staff.find(s => s.id === selectedWaiterForAssignment)!) : 'Waiter'}
        existingTables={tables.map(t => t.number)}
        assignedTables={staff.find(s => s.id === selectedWaiterForAssignment)?.assignedTables || []}
        onSubmit={(tables) => {
          if (selectedWaiterForAssignment) {
            updateTablesMutation.mutate({ 
              staffId: selectedWaiterForAssignment, 
              assignedTables: tables 
            });
            setShowAssignTableModal(false);
            setSelectedWaiterForAssignment(null);
          }
        }}
        isLoading={updateTablesMutation.isPending}
      />
      <EditUserModal
        isOpen={showEditUserModal}
        onClose={() => {
          setShowEditUserModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
      <DeleteUserModal
        isOpen={showDeleteUserModal}
        onClose={() => {
          setShowDeleteUserModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      {showImpersonateModal && (
        <ImpersonateModal
          onClose={() => setShowImpersonateModal(false)}
        />
      )}

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
