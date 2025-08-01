import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Users, Table, Menu, LogOut, Plus, Edit, Trash2, User } from "lucide-react";
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
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("overview");
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [globalTables, setGlobalTables] = useState(false);
  const [currency, setCurrency] = useState("EUR");

  // Fetch staff
  const { data: staff = [], isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  // Fetch tables
  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableData[]>({
    queryKey: ["/api/tables"],
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
                {user?.name ? `${user.name} / @${user.username}` : `@${user?.username}`}
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
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <span className="text-green-600 text-xl">{currencySymbols[currency as keyof typeof currencySymbols]}</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">{currencySymbols[currency as keyof typeof currencySymbols]}0</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <BarChart3 className="text-blue-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Orders Completed</p>
                        <p className="text-2xl font-bold text-gray-900">0</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-amber-100 rounded-lg">
                        <Table className="text-amber-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Tables</p>
                        <p className="text-2xl font-bold text-gray-900">{tables.filter(t => t.status === "occupied").length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Users className="text-purple-600 text-xl" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Staff</p>
                        <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
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
                    <h2 className="text-xl font-bold text-gray-900">Staff Management</h2>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setShowAddStaffModal(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Staff Member
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Username</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Display Name</th>
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
                              <div className="font-medium text-gray-900">@{staffMember.username}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-gray-900">{staffMember.name || "Not set"}</div>
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
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
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
