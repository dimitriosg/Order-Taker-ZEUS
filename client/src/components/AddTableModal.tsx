import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTables: number[];
}

export function AddTableModal({ open, onOpenChange, existingTables }: AddTableModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tableNumber, setTableNumber] = useState("");

  const createTableMutation = useMutation({
    mutationFn: async (number: number) => {
      const response = await apiRequest("POST", "/api/tables", { number });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Table created",
        description: "New table has been added successfully",
      });
      onOpenChange(false);
      setTableNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create table",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const number = parseInt(tableNumber);
    if (isNaN(number) || number <= 0) {
      toast({
        title: "Invalid table number",
        description: "Please enter a valid table number",
        variant: "destructive",
      });
      return;
    }

    if (existingTables.includes(number)) {
      toast({
        title: "Table already exists",
        description: `Table ${number} already exists`,
        variant: "destructive",
      });
      return;
    }

    createTableMutation.mutate(number);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tableNumber">Table Number</Label>
            <Input
              id="tableNumber"
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Enter table number"
              min="1"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createTableMutation.isPending}
            >
              {createTableMutation.isPending ? "Creating..." : "Create Table"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}