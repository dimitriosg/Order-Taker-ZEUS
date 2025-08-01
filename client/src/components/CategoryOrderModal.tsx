import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryOrderModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CategoryOrderModal({ open, onClose }: CategoryOrderModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localCategories, setLocalCategories] = useState<Category[]>([]);

  // Fetch categories from the database
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: open,
  });

  // Fetch menu categories to include any categories not in the categories table
  const { data: menuCategories = [] } = useQuery<string[]>({
    queryKey: ["/api/menu/categories"],
    enabled: open,
  });

  // Update local state when data changes
  useEffect(() => {
    if (open) {
      if (categories.length > 0) {
        setLocalCategories([...categories].sort((a, b) => a.sortOrder - b.sortOrder));
      } else if (menuCategories.length > 0) {
        // If no categories in database, create temporary ones from menu items
        const tempCategories: Category[] = menuCategories.map((name, index) => ({
          id: `temp-${name}`,
          name,
          sortOrder: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setLocalCategories(tempCategories);
      }
    }
  }, [categories, menuCategories, open]);

  // Create missing categories mutation
  const createCategoriesMutation = useMutation({
    mutationFn: async (categoriesToCreate: string[]) => {
      const promises = categoriesToCreate.map((categoryName, index) =>
        apiRequest("POST", "/api/categories", {
          name: categoryName,
          sortOrder: index,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
    },
  });

  // Update category order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (categoryOrders: { id: string; sortOrder: number }[]) => {
      return apiRequest("PUT", "/api/categories/reorder", { categoryOrders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Categories reordered",
        description: "Category order has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category order",
        variant: "destructive",
      });
    },
  });

  const moveCategory = (index: number, direction: "up" | "down") => {
    const newCategories = [...localCategories];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newCategories.length) return;
    
    // Swap categories
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    
    // Update sort orders
    newCategories.forEach((category, idx) => {
      category.sortOrder = idx;
    });
    
    setLocalCategories(newCategories);
  };

  const handleSave = async () => {
    try {
      // First, check if we need to create any categories that don't exist in the database
      const tempCategories = localCategories.filter(c => c.id.startsWith('temp-'));
      
      if (tempCategories.length > 0) {
        await createCategoriesMutation.mutateAsync(tempCategories.map(c => c.name));
        // Refetch categories to get real IDs
        const updatedCategories = await queryClient.fetchQuery({
          queryKey: ["/api/categories"],
        }) as Category[];
        
        // Map the real categories with the correct order
        const orderedCategories = localCategories.map(local => {
          if (local.id.startsWith('temp-')) {
            const real = updatedCategories.find(c => c.name === local.name);
            return { ...real!, sortOrder: local.sortOrder };
          }
          return local;
        });
        
        // Update order
        const categoryOrders = orderedCategories.map((category, index) => ({
          id: category.id,
          sortOrder: index,
        }));
        
        await updateOrderMutation.mutateAsync(categoryOrders);
      } else {
        // Just update the order
        const categoryOrders = localCategories.map((category, index) => ({
          id: category.id,
          sortOrder: index,
        }));
        
        await updateOrderMutation.mutateAsync(categoryOrders);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category order",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Arrange Category Order</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Drag categories to arrange them in your preferred order. This will affect how they appear throughout the app.
          </p>
          
          {isLoading ? (
            <div className="text-center py-4">Loading categories...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {localCategories.map((category, index) => (
                <Card key={category.id} className="relative">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveCategory(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveCategory(index, "down")}
                          disabled={index === localCategories.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={updateOrderMutation.isPending || createCategoriesMutation.isPending}
              className="flex-1"
            >
              {(updateOrderMutation.isPending || createCategoriesMutation.isPending) ? "Saving..." : "Save Order"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}