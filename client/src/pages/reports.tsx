import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Users, Download, Calendar } from "lucide-react";
import { format } from "date-fns";

interface SalesReportItem {
  date: string;
  orderId: string;
  tableId: number;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  waiterName: string;
}

interface StaffPerformanceItem {
  username: string;
  totalSales: number;
  date: string;
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Sales Report Query
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery<SalesReportItem[]>({
    queryKey: ["/api/reports/sales", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/reports/sales?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch sales report');
      return response.json();
    },
  });

  // Staff Performance Report Query
  const { data: staffData, isLoading: staffLoading, refetch: refetchStaff } = useQuery<StaffPerformanceItem[]>({
    queryKey: ["/api/reports/staff-performance", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/reports/staff-performance?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch staff performance report');
      return response.json();
    },
  });

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    refetchSales();
    refetchStaff();
  };

  const formatItemsList = (items: Array<{ name: string; quantity: number }>) => {
    return items.map(item => `${item.quantity} ${item.name}`).join(', ');
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yy');
    } catch {
      return dateStr;
    }
  };

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        if (header === 'items' && Array.isArray(row.items)) {
          return `"${formatItemsList(row.items)}"`;
        }
        return `"${row[header.toLowerCase().replace(' ', '')] || ''}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportSalesReport = () => {
    if (!salesData) return;
    const headers = ['Date', 'Order ID', 'Table ID', 'Items', 'Total', 'Waiter'];
    const exportData = salesData.map(item => ({
      date: formatDate(item.date),
      orderid: item.orderId,
      tableid: item.tableId,
      items: item.items,
      total: `€${item.total.toFixed(2)}`,
      waiter: item.waiterName
    }));
    exportToCSV(exportData, 'sales-report', headers);
  };

  const exportStaffReport = () => {
    if (!staffData) return;
    const headers = ['Username', 'Total Sales', 'Date'];
    const exportData = staffData.map(item => ({
      username: item.username,
      totalsales: `€${item.totalSales.toFixed(2)}`,
      date: formatDate(item.date)
    }));
    exportToCSV(exportData, 'staff-performance-report', headers);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600">Sales and staff performance analytics</p>
        </div>

        {/* Date Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Report Date
            </CardTitle>
            <CardDescription>
              Select the date for generating reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="report-date">Date</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button 
                onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
                variant="outline"
              >
                Today
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sales Report
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Staff Performance
            </TabsTrigger>
          </TabsList>

          {/* Sales Report */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Sales Report</CardTitle>
                    <CardDescription>
                      All orders for {formatDate(selectedDate)}
                    </CardDescription>
                  </div>
                  <Button onClick={exportSalesReport} variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="text-center py-8">Loading sales report...</div>
                ) : !salesData || salesData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No sales data found for {formatDate(selectedDate)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Table</TableHead>
                          <TableHead>Items & Quantity</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Waiter</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesData.map((sale) => (
                          <TableRow key={sale.orderId}>
                            <TableCell>{formatDate(sale.date)}</TableCell>
                            <TableCell className="font-mono">{sale.orderId}</TableCell>
                            <TableCell>Table {sale.tableId}</TableCell>
                            <TableCell className="max-w-xs">
                              {formatItemsList(sale.items)}
                            </TableCell>
                            <TableCell className="font-semibold">€{sale.total.toFixed(2)}</TableCell>
                            <TableCell>{sale.waiterName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Performance Report */}
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Staff Performance Report</CardTitle>
                    <CardDescription>
                      Sales performance for {formatDate(selectedDate)}
                    </CardDescription>
                  </div>
                  <Button onClick={exportStaffReport} variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {staffLoading ? (
                  <div className="text-center py-8">Loading staff performance report...</div>
                ) : !staffData || staffData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No staff performance data found for {formatDate(selectedDate)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Total Sales</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffData
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .map((staff) => (
                          <TableRow key={staff.username}>
                            <TableCell className="font-medium">{staff.username}</TableCell>
                            <TableCell className="font-semibold">€{staff.totalSales.toFixed(2)}</TableCell>
                            <TableCell>{formatDate(staff.date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}