import { Badge } from "@/components/ui/badge";

interface OrderStatusBadgeProps {
  status: "paid" | "in-prep" | "ready" | "served";
  animated?: boolean;
  size?: "sm" | "md" | "lg";
}

export function OrderStatusBadge({ status, animated = true, size = "md" }: OrderStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    const configs = {
      paid: {
        label: "Paid",
        variant: "secondary" as const,
        bgColor: "bg-blue-500",
        textColor: "text-blue-800",
        borderColor: "border-blue-300",
        pulseColor: "animate-pulse bg-blue-200",
        description: "Payment received, ready for kitchen"
      },
      "in-prep": {
        label: "In Preparation",
        variant: "default" as const,
        bgColor: "bg-amber-500",
        textColor: "text-amber-800",
        borderColor: "border-amber-300",
        pulseColor: "animate-pulse bg-amber-200",
        description: "Being prepared in kitchen"
      },
      ready: {
        label: "Ready",
        variant: "destructive" as const,
        bgColor: "bg-green-500",
        textColor: "text-green-800",
        borderColor: "border-green-300",
        pulseColor: "animate-pulse bg-green-200",
        description: "Ready for delivery to table"
      },
      served: {
        label: "Served",
        variant: "outline" as const,
        bgColor: "bg-gray-500",
        textColor: "text-gray-600",
        borderColor: "border-gray-300",
        pulseColor: "bg-gray-200",
        description: "Delivered to customer"
      }
    };
    return configs[status as keyof typeof configs] || configs.paid;
  };

  const config = getStatusConfig(status);
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Animated pulse background for active statuses */}
      {animated && (status === "in-prep" || status === "ready") && (
        <div 
          className={`absolute inset-0 rounded-full ${config.pulseColor} opacity-75`}
          style={{ 
            animation: status === "ready" ? "pulse 1s ease-in-out infinite" : "pulse 2s ease-in-out infinite" 
          }}
        />
      )}
      
      {/* Status indicator dot */}
      <div className="relative flex items-center gap-2">
        <div 
          className={`w-2 h-2 rounded-full ${config.bgColor} ${
            animated ? `status-${status}` : ""
          }`}
        />
        
        {/* Badge with custom styling and animations */}
        <Badge 
          variant={config.variant}
          className={`
            ${sizeClasses[size]} 
            ${config.textColor} 
            ${config.borderColor}
            transition-all duration-300 ease-in-out
            ${animated ? "hover:scale-105 hover:shadow-md" : ""}
            ${animated ? `status-${status}` : ""}
            relative z-10
          `}
        >
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

// Status progress bar component
interface OrderStatusProgressProps {
  currentStatus: "paid" | "in-prep" | "ready" | "served";
  animated?: boolean;
}

export function OrderStatusProgress({ currentStatus, animated = true }: OrderStatusProgressProps) {
  const statuses = ["paid", "in-prep", "ready", "served"];
  const currentIndex = statuses.indexOf(currentStatus);
  
  const getStepColor = (index: number) => {
    if (index < currentIndex) return "bg-green-500"; // Completed
    if (index === currentIndex) return "bg-blue-500"; // Current
    return "bg-gray-300"; // Future
  };

  const getStepLabel = (status: string) => {
    const labels = {
      paid: "Paid",
      "in-prep": "Prep",
      ready: "Ready",
      served: "Served"
    };
    return labels[status as keyof typeof labels];
  };

  return (
    <div className="flex items-center space-x-2">
      {statuses.map((status, index) => (
        <div key={status} className="flex items-center">
          {/* Step circle */}
          <div className="flex flex-col items-center">
            <div 
              className={`
                w-3 h-3 rounded-full transition-all duration-500 ease-in-out
                ${getStepColor(index)}
                ${animated && index === currentIndex ? "status-" + statuses[currentIndex] : ""}
                ${index <= currentIndex ? "scale-110" : "scale-100"}
                ${index < currentIndex ? "progress-bar-fill" : ""}
              `}
            />
            <span className="text-xs text-gray-600 mt-1">
              {getStepLabel(status)}
            </span>
          </div>
          
          {/* Connector line */}
          {index < statuses.length - 1 && (
            <div 
              className={`
                w-8 h-0.5 mx-1 transition-all duration-500 ease-in-out
                ${index < currentIndex ? "bg-green-500" : "bg-gray-300"}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}