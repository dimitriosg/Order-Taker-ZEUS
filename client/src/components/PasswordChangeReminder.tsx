import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PasswordChangeReminderProps {
  onChangePassword: () => void;
}

export function PasswordChangeReminder({ onChangePassword }: PasswordChangeReminderProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if user has dismissed the reminder in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('passwordReminderDismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('passwordReminderDismissed', 'true');
  };

  const handleChangePassword = () => {
    handleDismiss();
    onChangePassword();
  };

  if (dismissed) return null;

  return (
    <Alert className="border-amber-200 bg-amber-50 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1">
          <span className="text-amber-700 font-medium">Security Notice: </span>
          <span className="text-amber-700">
            For security, please change your default password to a personal one.
          </span>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleChangePassword}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            Change Password
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-amber-700 hover:bg-amber-100 p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}