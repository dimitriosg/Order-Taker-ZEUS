import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface TouchCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
}

export function TouchCard({ 
  children, 
  onClick, 
  className = "", 
  disabled = false,
  variant = "default"
}: TouchCardProps) {
  const variantStyles = {
    default: "border-gray-200 hover:border-gray-300",
    success: "border-green-200 hover:border-green-300 bg-green-50",
    warning: "border-amber-200 hover:border-amber-300 bg-amber-50",
    danger: "border-red-200 hover:border-red-300 bg-red-50"
  };

  return (
    <Card
      className={`
        mobile-card cursor-pointer min-h-[120px] sm:min-h-[140px]
        ${variantStyles[variant]}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="p-4 sm:p-6 h-full flex flex-col justify-center">
        {children}
      </CardContent>
    </Card>
  );
}