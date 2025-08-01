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
import { Plus, Edit, Trash2, ImageIcon, Tag, DollarSign, ArrowLeft, FolderPlus, Trash, PencilIcon } from "lucide-react";
import { useLocation } from "wouter";

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
  const [, setLocation] = useLocation();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string>("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{type: 'all' | 'category' | 'single', category?: string, item?: MenuItem}>({type: 'all'});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "uncategorized",
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
    mutationFn: async ({ id, force = false }: { id: string, force?: boolean }) => {
      const url = force ? `/api/menu/${id}?force=true` : `/api/menu/${id}`;
      const response = await apiRequest("DELETE", url);
      if (!response.ok) {
        const errorData = await response.json();
        throw { ...errorData, status: response.status };
      }
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
    onError: (error: any) => {
      if (error.code === "FOREIGN_KEY_CONSTRAINT") {
        toast({
          title: "Cannot delete menu item",
          description: "This item is used in existing orders. You can mark it unavailable or force delete (which removes it from all orders).",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error deleting item",
          description: error.message || "An error occurred while deleting the item",
          variant: "destructive",
        });
      }
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ type, category, force = false }: {type: 'all' | 'category', category?: string, force?: boolean}) => {
      const itemsToDelete = type === 'all' 
        ? menuItems 
        : menuItems.filter(item => item.category === category);
      
      const results = await Promise.allSettled(
        itemsToDelete.map(async (item) => {
          try {
            const url = force ? `/api/menu/${item.id}?force=true` : `/api/menu/${item.id}`;
            const response = await apiRequest("DELETE", url);
            if (!response.ok) {
              const errorData = await response.json();
              throw errorData;
            }
            return { success: true, item: item.name };
          } catch (error) {
            return { success: false, item: item.name, error };
          }
        })
      );
      
      return results;
    },
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
      
      if (failedCount === 0) {
        const description = variables.type === 'all' 
          ? `All ${successCount} menu items have been deleted` 
          : `All ${successCount} items in "${variables.category}" category have been deleted`;
        toast({
          title: "Bulk delete completed",
          description,
        });
      } else {
        toast({
          title: "Bulk delete partially completed",
          description: `${successCount} items deleted, ${failedCount} items could not be deleted (they may be referenced in existing orders)`,
          variant: "destructive",
        });
      }
      setShowDeleteConfirmDialog(false);
    },
    onError: () => {
      toast({
        title: "Bulk delete failed",
        description: "An error occurred during bulk deletion",
        variant: "destructive",
      });
      setShowDeleteConfirmDialog(false);
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
    
    const finalCategory = formData.newCategory.trim() || formData.category || "uncategorized";

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

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }

    // Create a dummy item to establish the category, then delete it
    // This is a workaround since categories are derived from items
    const tempItem = {
      name: `temp-${Date.now()}`,
      price: 0,
      category: newCategoryName.trim(),
      available: false,
      sortOrder: 999,
    };

    createItemMutation.mutate(tempItem, {
      onSuccess: (createdItem: any) => {
        // Immediately delete the temp item
        deleteItemMutation.mutate(createdItem.id);
        setNewCategoryName("");
        setShowAddCategoryDialog(false);
        toast({
          title: "Category added",
          description: `"${newCategoryName.trim()}" category is now available`,
        });
      }
    });
  };

  const handleBulkDelete = (type: 'all' | 'category', category?: string) => {
    setDeleteTarget({ type, category });
    setShowDeleteConfirmDialog(true);
  };

  const handleSingleDelete = (item: MenuItem) => {
    setDeleteTarget({ type: 'single', item });
    setShowSingleDeleteDialog(true);
  };

  const handleEditCategory = (categoryName: string) => {
    setEditingCategory(categoryName);
    setEditCategoryName(categoryName);
    setShowEditCategoryDialog(true);
  };

  // Edit category mutation
  const editCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string, newName: string }) => {
      // Get all items in the category
      const itemsInCategory = menuItems.filter(item => item.category === oldName);
      
      // Update each item's category
      await Promise.all(itemsInCategory.map(item => 
        apiRequest("PATCH", `/api/menu/${item.id}`, {
          ...item,
          category: newName
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu/categories"] });
      toast({
        title: "Category renamed",
        description: `Category "${editingCategory}" has been renamed to "${editCategoryName}"`,
      });
      setShowEditCategoryDialog(false);
      setEditingCategory("");
      setEditCategoryName("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename category",
        variant: "destructive",
      });
    },
  });

  const executeBulkDelete = (force: boolean = false) => {
    if (deleteTarget.type === 'single' && deleteTarget.item) {
      deleteItemMutation.mutate({ id: deleteTarget.item.id, force }, {
        onError: (error: any) => {
          if (error.code === "FOREIGN_KEY_CONSTRAINT" && !force) {
            const forceDelete = confirm(
              `"${deleteTarget.item!.name}" is used in existing orders. Force delete will remove it from all orders. Continue?`
            );
            if (forceDelete) {
              deleteItemMutation.mutate({ id: deleteTarget.item!.id, force: true });
            }
          }
        },
        onSuccess: () => {
          setShowSingleDeleteDialog(false);
        }
      });
      return;
    }

    bulkDeleteMutation.mutate({
      type: deleteTarget.type as 'all' | 'category',
      category: deleteTarget.category,
      force
    }, {
      onSuccess: (results) => {
        const failedItems = results.filter(r => r.status === 'fulfilled' && !r.value.success);
        const constraintFailures = failedItems.filter(r => 
          r.status === 'fulfilled' && r.value.error?.code === 'FOREIGN_KEY_CONSTRAINT'
        );
        
        if (constraintFailures.length > 0 && !force) {
          const forceDelete = confirm(
            `${constraintFailures.length} items are used in existing orders and couldn't be deleted. Force delete will remove them from all orders. Continue?`
          );
          if (forceDelete) {
            executeBulkDelete(true);
            return;
          }
        }
        setShowDeleteConfirmDialog(false);
      }
    });
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

  // Add uncategorized to categories if there are items without explicit category
  const allCategories = [...categories];
  if (menuItems.some(item => !item.category || item.category === "uncategorized")) {
    if (!allCategories.includes("uncategorized")) {
      allCategories.unshift("uncategorized");
    }
  }

  // Group items by category for display
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const category = item.category || "uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Sort categories and items
  Object.keys(itemsByCategory).forEach(category => {
    itemsByCategory[category].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/manager')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Dashboard</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Menu Management</h1>
            <p className="text-gray-600">Add, edit, and organize your restaurant menu</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCategory}>
                    Add Category
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
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

        <Button 
          variant="destructive" 
          onClick={() => handleBulkDelete('all')}
          disabled={menuItems.length === 0}
        >
          <Trash className="w-4 h-4 mr-2" />
          Delete All Items
        </Button>
        </div>
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
          {allCategories.map((category) => {
            const count = menuItems.filter(item => (item.category || "uncategorized") === category).length;
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === "uncategorized" ? "Uncategorized" : category} ({count})
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
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Tag className="w-5 h-5 mr-2" />
                    {category === "uncategorized" ? "Uncategorized" : category}
                    <Badge variant="outline" className="ml-2">
                      {itemsByCategory[category].length} items
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    {category !== "uncategorized" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                      >
                        <PencilIcon className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleBulkDelete('category', category)}
                      disabled={itemsByCategory[category].length === 0}
                    >
                      <Trash className="w-3 h-3 mr-1" />
                      Delete All
                    </Button>
                  </div>
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
                              variant={item.available ? "secondary" : "default"}
                              onClick={async () => {
                                try {
                                  await apiRequest("PATCH", `/api/menu/${item.id}`, {
                                    ...item,
                                    available: !item.available
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
                                  toast({
                                    title: item.available ? "Item marked unavailable" : "Item marked available",
                                    description: `${item.name} is now ${!item.available ? 'available' : 'unavailable'} for ordering`,
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to update item availability",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              {item.available ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSingleDelete(item)}
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

      {/* Edit Category Dialog */}
      <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editCategoryName">Category Name</Label>
              <Input
                id="editCategoryName"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="Enter new category name"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditCategoryDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!editCategoryName.trim()) {
                    toast({
                      title: "Error",
                      description: "Please enter a category name",
                      variant: "destructive",
                    });
                    return;
                  }
                  editCategoryMutation.mutate({
                    oldName: editingCategory,
                    newName: editCategoryName.trim()
                  });
                }}
                disabled={editCategoryMutation.isPending}
              >
                {editCategoryMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Item Delete Confirmation Dialog */}
      <Dialog open={showSingleDeleteDialog} onOpenChange={setShowSingleDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete "{deleteTarget.item?.name}"? If this item is referenced in existing orders, it cannot be deleted and will be skipped. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSingleDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => executeBulkDelete(false)}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {deleteTarget.type === 'all' 
                ? `Are you sure you want to delete all ${menuItems.length} menu items? Items that are referenced in existing orders cannot be deleted and will be skipped. This action cannot be undone.`
                : `Are you sure you want to delete all ${menuItems.filter(item => item.category === deleteTarget.category).length} items in the "${deleteTarget.category}" category? Items that are referenced in existing orders cannot be deleted and will be skipped. This action cannot be undone.`
              }
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => executeBulkDelete(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}