import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isImpersonating?: boolean;
  originalRole?: string;
}

interface ImpersonationBannerProps {
  user: User;
}

export function ImpersonationBanner({ user }: ImpersonationBannerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stop-impersonation", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Impersonation stopped",
        description: "You are now back to your manager role",
      });
      // Force a page reload to update all UI components
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Failed to stop impersonation",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email || 'Unknown User';
  };

  if (!user.isImpersonating) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 mb-4">
      <Eye className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-amber-800">
            <strong>Impersonating:</strong> {getUserDisplayName(user)} ({user.role})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => stopImpersonationMutation.mutate()}
          disabled={stopImpersonationMutation.isPending}
          className="bg-white hover:bg-gray-50 border-amber-300 text-amber-800 hover:text-amber-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {stopImpersonationMutation.isPending ? "Stopping..." : "Go Back to Manager"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}