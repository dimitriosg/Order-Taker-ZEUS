import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, ImageIcon, Tag, DollarSign } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function MenuManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    newCategory: "",
    available: true,
    sortOrder: 0,
  });

  // Fetch menu items
  const { data: menuItems = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu"],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/menu/categories"],
  });

  // Create menu item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = null;
      
      // Handle image upload if present
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        // For now, we'll create a simple base64 data URL
        // In production, you'd upload to a proper image service
        imageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const response = await apiRequest("POST", "/api/menu", {
        ...data,
        image: imageUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Menu item created",
        description: "The new menu item has been added successfully",
      });
      resetForm();
      setShowAddDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create menu item",
        variant: "destructive",
      });
    },
  });

  // Update menu item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      let imageUrl = data.image;
      
      if (imageFile) {
        imageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const response = await apiRequest("PATCH", `/api/menu/${id}`, {
        ...data,
        image: imageUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Menu item updated",
        description: "The menu item has been updated successfully",
      });
      resetForm();
      setEditingItem(null);
    },
  });

  // Delete menu item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/menu/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Menu item deleted",
        description: "The menu item has been removed successfully",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      newCategory: "",
      available: true,
      sortOrder: 0,
    });
    setImageFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCategory = formData.newCategory.trim() || formData.category;
    if (!finalCategory) {
      toast({
        title: "Error",
        description: "Please select or enter a category",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: parseFloat(formData.price),
      category: finalCategory,
      available: formData.available,
      sortOrder: formData.sortOrder,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: submitData });
    } else {
      createItemMutation.mutate(submitData);
    }
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      category: item.category,
      newCategory: "",
      available: item.available,
      sortOrder: item.sortOrder,
    });
    setImageFile(null);
  };

  const filteredItems = selectedCategory === "all" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  // Group items by category for display
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Sort categories and items
  Object.keys(itemsByCategory).forEach(category => {
    itemsByCategory[category].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Menu Management</h1>
          <p className="text-gray-600">Add, edit, and organize your restaurant menu</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Menu Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Menu Item" : "Add New Menu Item"}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the menu item"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="newCategory">Or New Category</Label>
                  <Input
                    id="newCategory"
                    value={formData.newCategory}
                    onChange={(e) => setFormData({ ...formData, newCategory: e.target.value })}
                    placeholder="Enter new category name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="image">Image</Label>
                  <div className="mt-2">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    {(editingItem?.image || imageFile) && (
                      <div className="mt-2">
                        <img
                          src={imageFile ? URL.createObjectURL(imageFile) : editingItem?.image}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="available"
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                />
                <Label htmlFor="available">Available for ordering</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setEditingItem(null);
                    setShowAddDialog(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                  {editingItem ? "Update Item" : "Add Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Tag className="w-4 h-4" />
          <Label>Filter by Category:</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All Categories ({menuItems.length})
          </Button>
          {categories.map((category) => {
            const count = menuItems.filter(item => item.category === category).length;
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Menu Items Display */}
      {menuLoading ? (
        <div className="text-center py-8">Loading menu items...</div>
      ) : (
        <div className="space-y-8">
          {Object.keys(itemsByCategory).sort().map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="w-5 h-5 mr-2" />
                  {category}
                  <Badge variant="outline" className="ml-2">
                    {itemsByCategory[category].length} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {itemsByCategory[category].map((item) => (
                    <Card key={item.id} className={`${!item.available ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold">{item.name}</h3>
                              {!item.available && (
                                <Badge variant="secondary">Unavailable</Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            )}
                            <p className="text-lg font-bold text-green-600">${item.price.toFixed(2)}</p>
                          </div>
                          
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-16 h-16 object-cover rounded ml-2"
                            />
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center mt-3">
                          <div className="text-xs text-gray-500">
                            Order: {item.sortOrder}
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                startEdit(item);
                                setShowAddDialog(true);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"?`)) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredItems.length === 0 && !menuLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No menu items found</h3>
            <p className="text-gray-600 mb-4">
              {selectedCategory === "all" 
                ? "Start by adding your first menu item" 
                : `No items found in "${selectedCategory}" category`}
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Menu Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}