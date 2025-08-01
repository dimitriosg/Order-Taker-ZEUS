import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BatchAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waiterId: string | null;
  waiterName: string;
  existingTables: number[];
  assignedTables: number[];
  onSubmit: (tables: number[]) => void;
  isLoading: boolean;
}

export function BatchAssignModal({
  open,
  onOpenChange,
  waiterId,
  waiterName,
  existingTables,
  assignedTables,
  onSubmit,
  isLoading
}: BatchAssignModalProps) {
  const [singleTable, setSingleTable] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [individualTables, setIndividualTables] = useState("");
  const [activeTab, setActiveTab] = useState("single");
  const [currentAssignments, setCurrentAssignments] = useState<number[]>(assignedTables);

  const resetForm = () => {
    setSingleTable("");
    setRangeStart("");
    setRangeEnd("");
    setIndividualTables("");
    setActiveTab("single");
    setCurrentAssignments(assignedTables);
  };

  const parseTableNumbers = (input: string): number[] => {
    return input
      .split(',')
      .map(num => parseInt(num.trim()))
      .filter(num => !isNaN(num) && num > 0 && existingTables.includes(num));
  };

  const generateRange = (start: number, end: number): number[] => {
    const range = [];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    for (let i = min; i <= max; i++) {
      if (existingTables.includes(i)) {
        range.push(i);
      }
    }
    return range;
  };

  const handleAddTables = () => {
    let tablesToAdd: number[] = [];

    switch (activeTab) {
      case "single":
        const tableNum = parseInt(singleTable);
        if (!isNaN(tableNum) && tableNum > 0 && existingTables.includes(tableNum)) {
          tablesToAdd = [tableNum];
        }
        break;
      case "range":
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
          tablesToAdd = generateRange(start, end);
        }
        break;
      case "individual":
        tablesToAdd = parseTableNumbers(individualTables);
        break;
    }

    if (tablesToAdd.length > 0) {
      const newAssignments = Array.from(new Set([...currentAssignments, ...tablesToAdd])).sort((a, b) => a - b);
      setCurrentAssignments(newAssignments);
      setSingleTable("");
      setRangeStart("");
      setRangeEnd("");
      setIndividualTables("");
    }
  };

  const handleRemoveTable = (tableNumber: number) => {
    setCurrentAssignments(prev => prev.filter(t => t !== tableNumber));
  };

  const handleSubmit = () => {
    onSubmit(currentAssignments);
    resetForm();
  };

  const getTablesPreview = (): number[] => {
    let tables: number[] = [];
    
    switch (activeTab) {
      case "single":
        const tableNum = parseInt(singleTable);
        if (!isNaN(tableNum) && tableNum > 0 && existingTables.includes(tableNum)) {
          tables = [tableNum];
        }
        break;
      case "range":
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
          tables = generateRange(start, end);
        }
        break;
      case "individual":
        tables = parseTableNumbers(individualTables);
        break;
    }

    // Only show tables that aren't already assigned
    return tables.filter(table => !currentAssignments.includes(table)).sort((a, b) => a - b);
  };

  const tablesPreview = getTablesPreview();
  const canAddTables = tablesPreview.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Table Assignment - {waiterName}</DialogTitle>
          <DialogDescription>
            Assign tables to this waiter individually or in batches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Assignments */}
          <div>
            <Label className="text-base font-semibold">Currently Assigned Tables ({currentAssignments.length})</Label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg min-h-[60px] max-h-[120px] overflow-y-auto">
              {currentAssignments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentAssignments.map(table => (
                    <div
                      key={table}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      Table {table}
                      <button
                        onClick={() => handleRemoveTable(table)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No tables assigned</p>
              )}
            </div>
          </div>

          {/* Add New Tables */}
          <div>
            <Label className="text-base font-semibold">Add New Tables</Label>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">Single Table</TabsTrigger>
                <TabsTrigger value="range">Range</TabsTrigger>
                <TabsTrigger value="individual">Individual</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div>
                  <Label htmlFor="singleTable">Table Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="singleTable"
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={singleTable}
                      onChange={(e) => setSingleTable(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddTables}
                      disabled={!canAddTables}
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="range" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rangeStart">Start Table</Label>
                    <Input
                      id="rangeStart"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rangeEnd">End Table</Label>
                    <Input
                      id="rangeEnd"
                      type="number"
                      min="1"
                      placeholder="e.g. 15"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    This will assign tables from {rangeStart || "?"} to {rangeEnd || "?"} (existing tables only)
                  </p>
                  <Button
                    onClick={handleAddTables}
                    disabled={!canAddTables}
                    size="sm"
                  >
                    Add Range
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="individual" className="space-y-4">
                <div>
                  <Label htmlFor="individualTables">Table Numbers</Label>
                  <Textarea
                    id="individualTables"
                    placeholder="e.g. 1, 3, 5, 8, 12, 15"
                    value={individualTables}
                    onChange={(e) => setIndividualTables(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-gray-600">
                      Enter table numbers separated by commas (existing tables only)
                    </p>
                    <Button
                      onClick={handleAddTables}
                      disabled={!canAddTables}
                      size="sm"
                    >
                      Add Tables
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {tablesPreview.length > 0 && (
              <div className="bg-green-50 p-3 rounded-lg mt-3">
                <p className="text-sm font-medium text-green-700 mb-2">
                  Ready to add ({tablesPreview.length} table{tablesPreview.length !== 1 ? 's' : ''}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {tablesPreview.map(table => (
                    <span 
                      key={table}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800"
                    >
                      Table {table}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <Label className="text-base font-semibold">Quick Actions</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentAssignments(existingTables)}
              >
                Assign All Tables
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentAssignments([])}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}