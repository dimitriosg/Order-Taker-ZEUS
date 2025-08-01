import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Users, Table, Menu, LogOut, Plus, Edit, Trash2, User, Download, TrendingUp, Clock, DollarSign } from "lucide-react";
import { AddStaffModal } from "@/components/AddStaffModal";
import { AddTableModal } from "@/components/AddTableModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Staff {
  id: string;
  username: string;
  role: "waiter" | "cashier" | "manager";
  assignedTables?: number[] | null;
  name?: string | null;
}

interface TableData {
  id: string;
  number: number;
  status: "free" | "occupied";
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  
  const logout = () => {
    window.location.href = "/api/logout";
  };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("overview");
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [globalTables, setGlobalTables] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

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

  // Create table mutation
  const createTableMutation = useMutation({
    mutationFn: async (tableNumber: number) => {
      const response = await apiRequest("POST", "/api/tables", { number: tableNumber });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Table created",
        description: "New table has been added successfully",
      });
      setShowAddTableModal(false);
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

  // Mock data for demonstration - in real app this would come from API
  const todayStats = {
    revenue: 0,
    ordersCompleted: 0,
    activeTables: tables.filter(t => t.status === "occupied").length,
    activeStaff: staff.length,
    avgOrderTime: 0,
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
      const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
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
        status: activeOrder ? 
          (activeOrder.status === "ready" ? "ready" : "occupied") : "free"
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BarChart3 className="text-emerald-600 text-xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Manager Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Manager'}
              </span>
              <Button variant="ghost" onClick={() => setActiveView("profile")} size="sm">
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
              variant={activeView === "overview" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("overview")}
            >
              <BarChart3 className="mr-3 h-4 w-4" />
              Overview
            </Button>
            <Button
              variant={activeView === "reports" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("reports")}
            >
              <Download className="mr-3 h-4 w-4" />
              Reports
            </Button>
            <Button
              variant={activeView === "monitor" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("monitor")}
            >
              <Clock className="mr-3 h-4 w-4" />
              Table Monitor
            </Button>
            <Button
              variant={activeView === "staff" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("staff")}
            >
              <Users className="mr-3 h-4 w-4" />
              Staff Management
            </Button>
            <Button
              variant={activeView === "tables" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("tables")}
            >
              <Table className="mr-3 h-4 w-4" />
              Table Assignment
            </Button>
            <Button
              variant={activeView === "profile" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveView("profile")}
            >
              <User className="mr-3 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          {activeView === "overview" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Daily Overview</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Currency:</span>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-24">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleMetricClick('revenue')}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <DollarSign className="text-green-600 text-xl" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                          <p className="text-2xl font-bold text-gray-900">{currencySymbols[currency as keyof typeof currencySymbols]}{todayStats.revenue}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleMetricClick('orders')}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <BarChart3 className="text-blue-600 text-xl" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Orders Completed</p>
                          <p className="text-2xl font-bold text-gray-900">{todayStats.ordersCompleted}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleMetricClick('tables')}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-3 bg-amber-100 rounded-lg">
                          <Table className="text-amber-600 text-xl" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Active Tables</p>
                          <p className="text-2xl font-bold text-gray-900">{todayStats.activeTables}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleMetricClick('staff')}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <Users className="text-purple-600 text-xl" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Active Staff</p>
                          <p className="text-2xl font-bold text-gray-900">{todayStats.activeStaff}</p>
                        </div>
                      </div>
                      <TrendingUp className="text-gray-400 w-4 h-4" />
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
                        onClick={() => setActiveView('reports')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Today's Report
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
                          Username: member.username,
                          'Display Name': member.name || 'Not set',
                          Role: member.role,
                          'Assigned Tables': member.assignedTables?.join(', ') || 'All Tables',
                          Status: 'Active',
                          'Created Date': new Date(member.createdAt || new Date()).toLocaleDateString()
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
                          'Created Date': new Date(table.createdAt || new Date()).toLocaleDateString(),
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
                    <option value={2000}>2s refresh</option>
                    <option value={5000}>5s refresh</option>
                    <option value={10000}>10s refresh</option>
                    <option value={30000}>30s refresh</option>
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {getTableMonitorData().map((table) => (
                  <Card key={table.id} className={`border-l-4 ${
                    table.status === "ready" ? "border-l-red-500 bg-red-50" :
                    table.status === "occupied" ? "border-l-amber-500 bg-amber-50" :
                    "border-l-green-500 bg-green-50"
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Table {table.number}</h3>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            table.status === "ready" ? "bg-red-100 text-red-800" :
                            table.status === "occupied" ? "bg-amber-100 text-amber-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {table.status === "ready" ? "🔔 Order Ready" :
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
                              <span className="text-sm font-medium">#{table.activeOrder.id.slice(-6)}</span>
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
                          {getTableMonitorData().filter(t => t.status === "ready").length}
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
                        Add Table
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
                            <h3 className="font-semibold text-gray-900">{waiter.username}</h3>
                            <p className="text-sm text-gray-600">Waiter</p>
                          </div>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assigned Tables
                          </label>
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
                                  onClick={() => {
                                    // TODO: Implement edit functionality
                                    toast({
                                      title: "Edit User",
                                      description: `Edit functionality for ${staffMember.email}`,
                                    });
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    // TODO: Implement delete functionality
                                    toast({
                                      title: "Delete User",
                                      description: `Delete functionality for ${staffMember.email}`,
                                    });
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
      <AddTableModal
        open={showAddTableModal}
        onOpenChange={setShowAddTableModal}
        existingTables={tables.map(t => t.number)}
      />

    </div>
  );
}
