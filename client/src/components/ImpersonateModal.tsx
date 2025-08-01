import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Shield, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonateModalProps {
  onClose: () => void;
}

interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "waiter" | "cashier" | "manager";
  assignedTables?: number[] | null;
}

export function ImpersonateModal({ onClose }: ImpersonateModalProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", "/api/impersonate", { userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Impersonation started",
        description: "You are now viewing the system as the selected user",
      });
      onClose();
      // Force a page reload to update all UI components
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Failed to start impersonation",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleImpersonate = () => {
    if (selectedUser) {
      impersonateMutation.mutate(selectedUser);
    }
  };

  const getUserDisplayName = (user: StaffMember) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email || 'Unknown';
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'waiter':
        return 'bg-blue-100 text-blue-800';
      case 'cashier':
        return 'bg-green-100 text-green-800';
      case 'manager':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter out managers (can't impersonate other managers)
  const impersonatableStaff = staff.filter(member => member.role !== 'manager');

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Eye className="mr-2 h-5 w-5" />
            Impersonate User
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-600">
            Select a user to view the system from their perspective. You can switch back at any time.
          </p>

          {impersonatableStaff.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Available</h3>
                <p className="text-gray-600">There are no staff members available to impersonate.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {impersonatableStaff.map((member) => (
                <Card
                  key={member.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedUser === member.id
                      ? 'ring-2 ring-emerald-500 bg-emerald-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedUser(member.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {getUserDisplayName(member)}
                          </h3>
                          <p className="text-xs text-gray-500">{member.email}</p>
                          {member.role === 'waiter' && member.assignedTables && member.assignedTables.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Tables: {member.assignedTables.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                        {selectedUser === member.id && (
                          <Shield className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={!selectedUser || impersonateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {impersonateMutation.isPending ? "Starting..." : "Start Impersonation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}