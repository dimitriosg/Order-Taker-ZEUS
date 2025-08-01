import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BatchTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (tables: number[]) => void;
  isLoading: boolean;
  title: string;
  description: string;
  existingTables: number[];
  mode: 'add' | 'remove';
}

export function BatchTableModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  title,
  description,
  existingTables,
  mode
}: BatchTableModalProps) {
  const [singleTable, setSingleTable] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [individualTables, setIndividualTables] = useState("");
  const [activeTab, setActiveTab] = useState("single");

  const resetForm = () => {
    setSingleTable("");
    setRangeStart("");
    setRangeEnd("");
    setIndividualTables("");
    setActiveTab("single");
  };

  const parseTableNumbers = (input: string): number[] => {
    return input
      .split(',')
      .map(num => parseInt(num.trim()))
      .filter(num => !isNaN(num) && num > 0);
  };

  const generateRange = (start: number, end: number): number[] => {
    const range = [];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    for (let i = min; i <= max; i++) {
      range.push(i);
    }
    return range;
  };

  const handleSubmit = () => {
    let tables: number[] = [];

    switch (activeTab) {
      case "single":
        const tableNum = parseInt(singleTable);
        if (!isNaN(tableNum) && tableNum > 0) {
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

    if (tables.length === 0) {
      return;
    }

    // Filter based on mode
    if (mode === 'add') {
      // Remove existing tables from the list
      tables = tables.filter(table => !existingTables.includes(table));
    } else if (mode === 'remove') {
      // Only include existing tables
      tables = tables.filter(table => existingTables.includes(table));
    }

    if (tables.length > 0) {
      onSubmit(tables);
      resetForm();
    }
  };

  const getTablesPreview = (): number[] => {
    let tables: number[] = [];
    
    switch (activeTab) {
      case "single":
        const tableNum = parseInt(singleTable);
        if (!isNaN(tableNum) && tableNum > 0) {
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

    // Filter based on mode and existing tables
    if (mode === 'add') {
      tables = tables.filter(table => !existingTables.includes(table));
    } else if (mode === 'remove') {
      tables = tables.filter(table => existingTables.includes(table));
    }

    return tables.sort((a, b) => a - b);
  };

  const tablesPreview = getTablesPreview();
  const isValid = tablesPreview.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">Single Table</TabsTrigger>
            <TabsTrigger value="range">Range</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div>
              <Label htmlFor="singleTable">Table Number</Label>
              <Input
                id="singleTable"
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={singleTable}
                onChange={(e) => setSingleTable(e.target.value)}
              />
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
            <p className="text-sm text-gray-600">
              This will {mode} tables from {rangeStart || "?"} to {rangeEnd || "?"} (inclusive)
            </p>
          </TabsContent>

          <TabsContent value="individual" className="space-y-4">
            <div>
              <Label htmlFor="individualTables">Table Numbers</Label>
              <Textarea
                id="individualTables"
                placeholder="e.g. 1, 3, 5, 8, 12, 15"
                value={individualTables}
                onChange={(e) => setIndividualTables(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-sm text-gray-600 mt-2">
                Enter table numbers separated by commas
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {tablesPreview.length > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Preview ({tablesPreview.length} table{tablesPreview.length !== 1 ? 's' : ''}):
            </p>
            <div className="flex flex-wrap gap-1">
              {tablesPreview.map(table => (
                <span 
                  key={table}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                >
                  Table {table}
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === 'add' && tablesPreview.length === 0 && (singleTable || rangeStart || individualTables) && (
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              All specified tables already exist. Please choose different table numbers.
            </p>
          </div>
        )}

        {mode === 'remove' && tablesPreview.length === 0 && (singleTable || rangeStart || individualTables) && (
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-sm text-red-800">
              None of the specified tables exist. Please choose existing table numbers.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
          >
            {isLoading ? "Processing..." : `${mode === 'add' ? 'Add' : 'Remove'} Tables`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}