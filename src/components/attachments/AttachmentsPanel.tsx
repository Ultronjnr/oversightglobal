import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Eye, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listAttachments,
  getAttachmentSignedUrl,
  deleteAttachment,
  type Attachment,
  type AttachmentFilter,
  type AttachmentKind,
} from "@/services/attachment.service";
import {
  AttachmentUploadModal,
  type AttachmentTargets,
} from "./AttachmentUploadModal";

interface Props {
  filter: AttachmentFilter;
  targets: AttachmentTargets;
  title?: string;
  defaultSupplierName?: string;
  allowedKinds?: AttachmentKind[];
  canDelete?: boolean;
  compact?: boolean;
}

export function AttachmentsPanel({
  filter,
  targets,
  title = "Attachments",
  defaultSupplierName,
  allowedKinds = ["INVOICE", "RECEIPT"],
  canDelete = false,
  compact = false,
}: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadKind, setUploadKind] = useState<AttachmentKind | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listAttachments(filter);
    setLoading(false);
    if (res.success) setItems(res.data);
  }, [JSON.stringify(filter)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openSignedUrl = async (a: Attachment, download = false) => {
    const res = await getAttachmentSignedUrl(a.file_path);
    if (!res.success || !res.url) {
      toast.error(res.error || "Failed to load file");
      return;
    }
    if (download) {
      const link = document.createElement("a");
      link.href = res.url;
      link.download = a.file_name;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      window.open(res.url, "_blank", "noopener");
    }
  };

  const onDelete = async (a: Attachment) => {
    if (!confirm(`Delete "${a.file_name}"?`)) return;
    const res = await deleteAttachment(a);
    if (res.success) {
      toast.success("Attachment deleted");
      refresh();
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{title}</h4>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {allowedKinds.includes("INVOICE") && (
            <Button size="sm" variant="outline" onClick={() => setUploadKind("INVOICE")} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Upload Invoice
            </Button>
          )}
          {allowedKinds.includes("RECEIPT") && (
            <Button size="sm" variant="outline" onClick={() => setUploadKind("RECEIPT")} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Upload Receipt
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No attachments yet.</p>
      ) : (
        <div className="border rounded-md divide-y">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 text-sm">
              <div className="shrink-0 p-1.5 rounded bg-muted">
                {a.mime_type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{a.file_name}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">{a.kind}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {a.invoice_number && <span>#{a.invoice_number}</span>}
                  {a.supplier_name && <span>{a.supplier_name}</span>}
                  {a.invoice_date && <span>{format(new Date(a.invoice_date), "dd MMM yyyy")}</span>}
                  {a.vat_number && <span>VAT {a.vat_number}</span>}
                  <span>· {format(new Date(a.created_at), "dd MMM yyyy")}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openSignedUrl(a, false)} title="Preview">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openSignedUrl(a, true)} title="Download">
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(a)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadKind && (
        <AttachmentUploadModal
          open={!!uploadKind}
          onOpenChange={(o) => !o && setUploadKind(null)}
          kind={uploadKind}
          targets={targets}
          defaultSupplierName={defaultSupplierName}
          onUploaded={refresh}
        />
      )}
    </div>
  );
}