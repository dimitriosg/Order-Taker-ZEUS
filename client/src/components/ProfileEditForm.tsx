import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role: "waiter" | "cashier" | "manager";
}

export function ProfileEditForm() {
  const { user } = useAuth() as { user: User | undefined };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; email?: string; password?: string }) => {
      const response = await apiRequest("PUT", `/api/staff/${user?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleProfileInfoUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: { firstName?: string; lastName?: string; email?: string } = {};
    
    if (firstName !== user?.firstName) {
      updateData.firstName = firstName;
    }
    if (lastName !== user?.lastName) {
      updateData.lastName = lastName;
    }
    if (email !== user?.email) {
      updateData.email = email;
    }
    
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "No changes",
        description: "No changes were made to your profile",
      });
      return;
    }
    
    updateProfileMutation.mutate(updateData);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both password fields match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({ password: newPassword });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Profile Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Username</Label>
                <div className="mt-1 text-sm text-gray-900">{user?.email}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Role</Label>
                <div className="mt-1 text-sm text-gray-900 capitalize">{user?.role}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleProfileInfoUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email/Username</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  This will be used for login and identification
                </p>
              </div>
              <Button 
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateProfileMutation.isPending ? "Updating..." : "Update Profile Information"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Change Password */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="mt-1 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-1 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-1 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button 
                type="submit"
                disabled={updateProfileMutation.isPending || !newPassword || !confirmPassword}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateProfileMutation.isPending ? "Updating..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}