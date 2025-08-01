import { toast } from "@/hooks/use-toast";

export interface Order {
  id: string;
  tableNumber: number;
  status: string;
  totalAmount: number;
  items: Array<{
    menuItem: {
      name: string;
    };
    quantity: number;
  }>;
  createdAt: string;
  cashReceived?: number;
}

export interface OrderStatusNotificationProps {
  order: Order;
  userRole: string;
  previousStatus?: string;
}

// Status display names
const statusDisplayNames: Record<string, string> = {
  'pending': 'Pending Payment',
  'paid': 'Paid',
  'in-prep': 'In Preparation',
  'ready': 'Ready for Pickup',
  'served': 'Served',
  'cancelled': 'Cancelled'
};

// Status colors for toast variants
const getStatusColor = (status: string): "default" | "destructive" => {
  switch (status) {
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
  }
};

// Get notification icon based on status
const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'paid':
      return '💳';
    case 'in-prep':
      return '👨‍🍳';
    case 'ready':
      return '🔔';
    case 'served':
      return '✅';
    case 'cancelled':
      return '❌';
    default:
      return '📋';
  }
};

// Generate order summary for notification
const getOrderSummary = (order: Order): string => {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (itemCount <= 2) {
    return order.items.map(item => `${item.quantity}x ${item.menuItem.name}`).join(', ');
  }
  return `${itemCount} items (${order.items[0].menuItem.name}${itemCount > 1 ? ' + more' : ''})`;
};

// Main notification function
export const showOrderStatusNotification = ({ 
  order, 
  userRole, 
  previousStatus 
}: OrderStatusNotificationProps) => {
  const statusDisplay = statusDisplayNames[order.status] || order.status;
  const icon = getStatusIcon(order.status);
  const variant = getStatusColor(order.status);
  const orderSummary = getOrderSummary(order);

  // Role-specific messaging
  let title = '';
  let description = '';
  let duration = 5000; // Default 5 seconds

  switch (order.status) {
    case 'paid':
      if (userRole === 'cashier') {
        title = `${icon} Payment Confirmed`;
        description = `Table ${order.tableNumber} - Order sent to kitchen`;
      } else if (userRole === 'manager') {
        title = `${icon} Order Paid`;
        description = `Table ${order.tableNumber} - $${order.totalAmount.toFixed(2)} received`;
      } else {
        title = `${icon} Order Paid`;
        description = `Table ${order.tableNumber} - Sent to kitchen`;
      }
      break;

    case 'in-prep':
      if (userRole === 'waiter') {
        title = `${icon} Kitchen Started`;
        description = `Table ${order.tableNumber} - ${orderSummary}`;
      } else if (userRole === 'cashier') {
        title = `${icon} In Preparation`;
        description = `Table ${order.tableNumber} - Kitchen working on order`;
      } else {
        title = `${icon} Order In Preparation`;
        description = `Table ${order.tableNumber} - Kitchen started cooking`;
      }
      break;

    case 'ready':
      if (userRole === 'waiter') {
        title = `${icon} Order Ready for Pickup!`;
        description = `Table ${order.tableNumber} - Please collect from kitchen`;
        duration = 8000; // Longer for important waiter notifications
      } else if (userRole === 'cashier') {
        title = `${icon} Order Ready`;
        description = `Table ${order.tableNumber} - Waiting for waiter pickup`;
      } else {
        title = `${icon} Order Ready`;
        description = `Table ${order.tableNumber} - ${orderSummary}`;
      }
      break;

    case 'served':
      if (userRole === 'waiter') {
        title = `${icon} Order Delivered`;
        description = `Table ${order.tableNumber} - Order successfully served`;
      } else if (userRole === 'manager') {
        title = `${icon} Order Completed`;
        description = `Table ${order.tableNumber} - $${order.totalAmount.toFixed(2)} (${orderSummary})`;
      } else {
        title = `${icon} Order Served`;
        description = `Table ${order.tableNumber} - Order completed`;
      }
      break;

    case 'cancelled':
      title = `${icon} Order Cancelled`;
      if (userRole === 'manager') {
        description = `Table ${order.tableNumber} - $${order.totalAmount.toFixed(2)} refund may be needed`;
      } else {
        description = `Table ${order.tableNumber} - ${orderSummary}`;
      }
      duration = 7000; // Longer for cancellations
      break;

    default:
      title = `${icon} Order ${statusDisplay}`;
      description = `Table ${order.tableNumber} - ${orderSummary}`;
  }

  // Show the toast notification
  toast({
    title,
    description,
    variant,
    duration,
  });
};

// New order notification
export const showNewOrderNotification = ({ order, userRole }: { order: Order; userRole: string }) => {
  const orderSummary = getOrderSummary(order);
  let title = '';
  let description = '';

  if (userRole === 'cashier') {
    title = '🆕 New Order Received!';
    description = `Table ${order.tableNumber} - $${order.totalAmount.toFixed(2)} (${orderSummary})`;
  } else if (userRole === 'manager') {
    title = '🆕 New Order';
    description = `Table ${order.tableNumber} - $${order.totalAmount.toFixed(2)} awaiting payment`;
  } else {
    title = '🆕 New Order Placed';
    description = `Table ${order.tableNumber} - ${orderSummary}`;
  }

  toast({
    title,
    description,
    duration: 6000,
  });
};

// Cross-waiter order notification (when another waiter takes an order for assigned tables)
export const showCrossWaiterNotification = (data: { message: string; order: Order }) => {
  toast({
    title: '👥 Order Taken on Your Behalf',
    description: data.message,
    duration: 8000, // Show longer for important notifications
  });
};