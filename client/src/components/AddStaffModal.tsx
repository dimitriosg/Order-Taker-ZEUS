import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddStaffModalProps {
  onClose: () => void;
}

export function AddStaffModal({ onClose }: AddStaffModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createStaffMutation = useMutation({
    mutationFn: async (staffData: { username: string; password: string; role: string }) => {
      const response = await apiRequest("POST", "/api/register", staffData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Staff member created",
        description: "New staff member has been added successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Failed to create staff member",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password || !role) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createStaffMutation.mutate({ username, password, role });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Add Staff Member
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="staffUsername" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </Label>
            <Input
              id="staffUsername"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="staffPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </Label>
            <Input
              id="staffPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="staffRole" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="waiter">Waiter</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-4 border-t border-gray-200 flex space-x-3">
            <Button
              type="submit"
              disabled={createStaffMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {createStaffMutation.isPending ? "Creating..." : "Create Staff Member"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
