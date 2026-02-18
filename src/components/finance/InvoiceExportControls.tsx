import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  getInvoicesByDateRange,
  generateInvoiceCsv,
  type InvoiceExportRow,
} from "@/services/invoice-export.service";

interface InvoiceExportControlsProps {
  /** Called when the date range filter produces results — parent rerenders the invoice list */
  onFilteredInvoices: (invoices: InvoiceExportRow[] | null) => void;
}

export function InvoiceExportControls({ onFilteredInvoices }: InvoiceExportControlsProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isFiltering, setIsFiltering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState(false);

  const hasRange = !!startDate && !!endDate;

  const handleApplyFilter = async () => {
    if (!startDate || !endDate) {
      toast.error("Select both a start date and end date.");
      return;
    }
    setIsFiltering(true);
    try {
      const result = await getInvoicesByDateRange({ startDate, endDate });
      if (result.success) {
        onFilteredInvoices(result.data);
        setActiveFilter(true);
        toast.success(`Showing ${result.data.length} invoice(s) in range.`);
      } else {
        toast.error(result.error ?? "Failed to filter invoices.");
      }
    } finally {
      setIsFiltering(false);
    }
  };

  const handleClearFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setActiveFilter(false);
    onFilteredInvoices(null); // null → parent shows all invoices
    toast.info("Filter cleared — showing all invoices.");
  };

  const handleExportCsv = async () => {
    if (!startDate || !endDate) {
      toast.error("Select a date range before exporting.");
      return;
    }
    setIsExporting(true);
    try {
      const result = await generateInvoiceCsv({ startDate, endDate });
      if (result.success && result.downloadUrl) {
        const fileName = `invoices_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.csv`;
        const link = document.createElement("a");
        link.href = result.downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(result.downloadUrl);
        toast.success(`Exported ${result.count} invoice(s) to CSV.`);
      } else {
        toast.error(result.error ?? "Export failed. Please try again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 mb-4">
      {/* Start date picker */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground font-medium">From</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
              {startDate ? format(startDate, "dd MMM yyyy") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              disabled={(d) => !!endDate && d > endDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* End date picker */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground font-medium">To</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
              {endDate ? format(endDate, "dd MMM yyyy") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              disabled={(d) => !!startDate && d < startDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Apply filter */}
      <Button
        size="sm"
        variant="outline"
        disabled={!hasRange || isFiltering}
        onClick={handleApplyFilter}
        className="gap-2 self-end"
      >
        {isFiltering ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Filter
      </Button>

      {/* Clear filter */}
      {activeFilter && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClearFilter}
          className="gap-2 self-end text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}

      {/* Active filter badge */}
      {activeFilter && (
        <Badge variant="secondary" className="self-end">
          Filtered
        </Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export CSV */}
      <Button
        size="sm"
        variant="outline"
        disabled={!hasRange || isExporting}
        onClick={handleExportCsv}
        className="gap-2 self-end"
        title="Download invoices for selected date range as CSV"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download CSV for Range
      </Button>
    </div>
  );
}
