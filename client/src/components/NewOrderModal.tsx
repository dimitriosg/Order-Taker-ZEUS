import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface OrderItem {
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface NewOrderModalProps {
  tableNumber: number;
  onClose: () => void;
}

export function NewOrderModal({ tableNumber, onClose }: NewOrderModalProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState("Main Course");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch menu items
  const { data: menuItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu"],
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Order created successfully",
        description: `Order for Table ${tableNumber} has been submitted`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Failed to create order",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Fetch categories from API
  const { data: categoriesFromAPI = [] } = useQuery<string[]>({
    queryKey: ["/api/menu/categories"],
  });

  const categories = categoriesFromAPI.length > 0 ? categoriesFromAPI : Array.from(new Set(menuItems.map(item => item.category)));

  const addToOrder = (menuItem: MenuItem) => {
    const existingItem = orderItems.find(item => item.menuItemId === menuItem.id);
    
    if (existingItem) {
      setOrderItems(items =>
        items.map(item =>
          item.menuItemId === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setOrderItems(items => [...items, {
        menuItemId: menuItem.id,
        menuItem,
        quantity: 1,
      }]);
    }
  };

  const updateQuantity = (menuItemId: string, change: number) => {
    setOrderItems(items =>
      items.map(item => {
        if (item.menuItemId === menuItemId) {
          const newQuantity = item.quantity + change;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const removeItem = (menuItemId: string) => {
    setOrderItems(items => items.filter(item => item.menuItemId !== menuItemId));
  };

  const total = orderItems.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;

  const handleSubmit = () => {
    if (orderItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please add items to your order",
        variant: "destructive",
      });
      return;
    }

    if (cashAmount < total) {
      toast({
        title: "Insufficient payment",
        description: "Cash received must be at least the order total",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      tableNumber,
      items: orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
      })),
      cashReceived: cashAmount,
    };

    createOrderMutation.mutate(orderData);
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            New Order - Table {tableNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Menu Items */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Menu Items</h3>
            
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                {categories.slice(0, 3).map((category) => (
                  <TabsTrigger key={category} value={category} className="text-xs">
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {categories.map((category) => (
                <TabsContent key={category} value={category}>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {menuItems
                      .filter(item => item.category === category)
                      .map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:shadow-sm transition-shadow"
                          onClick={() => addToOrder(item)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                              </div>
                              <span className="font-semibold text-emerald-600 ml-4">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
          
          {/* Order Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            
            <Card className="mb-6">
              <CardContent className="p-4">
                {orderItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No items selected</p>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.menuItemId} className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.menuItemId, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.menuItemId, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm">{item.menuItem.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            ${(item.menuItem.price * item.quantity).toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.menuItemId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-emerald-600">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Payment Section */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Cash Payment</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cashReceived" className="block text-sm font-medium text-gray-700 mb-1">
                      Cash Received
                    </Label>
                    <Input
                      id="cashReceived"
                      type="number"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Change Due:</span>
                    <span className="font-medium">
                      ${change >= 0 ? change.toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleSubmit}
                disabled={createOrderMutation.isPending || orderItems.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {createOrderMutation.isPending ? "Creating Order..." : "Confirm Order & Payment"}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
