import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Users, Download, Calendar, Package, Archive } from "lucide-react";
import { format } from "date-fns";

interface SalesReportItem {
  date: string;
  orderId: string;
  tableId: number;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  waiterName: string;
}

interface ItemsSalesReportItem {
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
  averagePrice: number;
}

interface StaffPerformanceItem {
  username: string;
  totalSales: number;
  dateRange: string;
}

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDateRange, setIsDateRange] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', isDateRange ? endDate : startDate);
    return params.toString();
  };

  // Sales Report Query
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery<SalesReportItem[]>({
    queryKey: ["/api/reports/sales", startDate, endDate, isDateRange],
    queryFn: async () => {
      const response = await fetch(`/api/reports/sales?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch sales report');
      return response.json();
    },
  });

  // Items Sales Report Query
  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } = useQuery<ItemsSalesReportItem[]>({
    queryKey: ["/api/reports/items-sales", startDate, endDate, isDateRange],
    queryFn: async () => {
      const response = await fetch(`/api/reports/items-sales?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch items sales report');
      return response.json();
    },
  });

  // Staff Performance Report Query
  const { data: staffData, isLoading: staffLoading, refetch: refetchStaff } = useQuery<StaffPerformanceItem[]>({
    queryKey: ["/api/reports/staff-performance", startDate, endDate, isDateRange],
    queryFn: async () => {
      const response = await fetch(`/api/reports/staff-performance?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch staff performance report');
      return response.json();
    },
  });

  const handleDateChange = () => {
    refetchSales();
    refetchItems();
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

  const getDateRangeText = () => {
    if (!isDateRange || startDate === endDate) {
      return formatDate(startDate);
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
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
    a.download = `${filename}.csv`;
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
    const filename = `sales-report-${isDateRange ? `${startDate}_to_${endDate}` : startDate}`;
    exportToCSV(exportData, filename, headers);
  };

  const exportItemsReport = () => {
    if (!itemsData) return;
    const headers = ['Item Name', 'Total Quantity', 'Total Revenue', 'Average Price'];
    const exportData = itemsData.map(item => ({
      itemname: item.itemName,
      totalquantity: item.totalQuantity,
      totalrevenue: `€${item.totalRevenue.toFixed(2)}`,
      averageprice: `€${item.averagePrice.toFixed(2)}`
    }));
    const filename = `items-sales-report-${isDateRange ? `${startDate}_to_${endDate}` : startDate}`;
    exportToCSV(exportData, filename, headers);
  };

  const exportStaffReport = () => {
    if (!staffData) return;
    const headers = ['Username', 'Total Sales', 'Date Range'];
    const exportData = staffData.map(item => ({
      username: item.username,
      totalsales: `€${item.totalSales.toFixed(2)}`,
      daterange: item.dateRange
    }));
    const filename = `staff-performance-report-${isDateRange ? `${startDate}_to_${endDate}` : startDate}`;
    exportToCSV(exportData, filename, headers);
  };

  const exportAllReports = () => {
    exportSalesReport();
    exportItemsReport();
    exportStaffReport();
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
              Report Period
            </CardTitle>
            <CardDescription>
              Select single date or date range for generating reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="date-range"
                  checked={isDateRange}
                  onCheckedChange={(checked) => setIsDateRange(checked as boolean)}
                />
                <Label htmlFor="date-range">Use date range</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="start-date">{isDateRange ? "Start Date" : "Date"}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                {isDateRange && (
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
                
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setStartDate(today);
                      setEndDate(today);
                      handleDateChange();
                    }}
                    variant="outline"
                  >
                    Today
                  </Button>
                  <Button 
                    onClick={handleDateChange}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Generate Reports
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Report Period:</strong> {getDateRangeText()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export All Button */}
        <div className="flex justify-center mb-6">
          <Button 
            onClick={exportAllReports}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
            disabled={!salesData && !itemsData && !staffData}
          >
            <Archive className="mr-2 h-5 w-5" />
            Download All Reports
          </Button>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="total-sales" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="total-sales" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Sales Report
            </TabsTrigger>
            <TabsTrigger value="items-sales" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items Sales Report
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Staff Performance
            </TabsTrigger>
          </TabsList>

          {/* Total Sales Report */}
          <TabsContent value="total-sales">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Total Sales Report</CardTitle>
                    <CardDescription>
                      All orders for {getDateRangeText()}
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
                    No sales data found for {getDateRangeText()}
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

          {/* Items Sales Report */}
          <TabsContent value="items-sales">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Items Sales Report</CardTitle>
                    <CardDescription>
                      Items sold for {getDateRangeText()}
                    </CardDescription>
                  </div>
                  <Button onClick={exportItemsReport} variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="text-center py-8">Loading items sales report...</div>
                ) : !itemsData || itemsData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No items sales data found for {getDateRangeText()}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Total Quantity Sold</TableHead>
                          <TableHead>Total Revenue</TableHead>
                          <TableHead>Average Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell>{item.totalQuantity}</TableCell>
                            <TableCell className="font-semibold">€{item.totalRevenue.toFixed(2)}</TableCell>
                            <TableCell>€{item.averagePrice.toFixed(2)}</TableCell>
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
                      Sales performance for {getDateRangeText()}
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
                    No staff performance data found for {getDateRangeText()}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Total Sales</TableHead>
                          <TableHead>Date Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffData
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .map((staff) => (
                          <TableRow key={staff.username}>
                            <TableCell className="font-medium">{staff.username}</TableCell>
                            <TableCell className="font-semibold">€{staff.totalSales.toFixed(2)}</TableCell>
                            <TableCell>{staff.dateRange}</TableCell>
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