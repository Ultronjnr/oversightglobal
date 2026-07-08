import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileText,
  Download,
  Eye,
  Plus,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listAttachments,
  getAttachmentSignedUrl,
  deleteAttachment,
  replaceAttachment,
  listAttachmentVersions,
  ATTACHMENT_KIND_LABELS,
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

const ACCEPT = ".pdf,application/pdf,image/jpeg,image/jpg,image/png";

export function AttachmentsPanel({
  filter,
  targets,
  title = "Attachments",
  defaultSupplierName,
  allowedKinds = ["INVOICE", "RECEIPT", "QUOTE", "PURCHASE_ORDER", "SUPPORTING"],
  canDelete = false,
  compact = false,
}: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadKind, setUploadKind] = useState<AttachmentKind | null>(null);
  const [preview, setPreview] = useState<{ att: Attachment; url: string } | null>(null);
  const [versionsFor, setVersionsFor] = useState<Attachment | null>(null);
  const [versions, setVersions] = useState<Attachment[]>([]);
  const [replacing, setReplacing] = useState<Attachment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

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
      setPreview({ att: a, url: res.url });
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

  const onReplacePick = (a: Attachment) => {
    setReplacing(a);
    // slight delay so state is set before the file dialog resolves
    setTimeout(() => replaceInputRef.current?.click(), 0);
  };

  const onReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !replacing) return;
    setBusyId(replacing.id);
    const res = await replaceAttachment(replacing, file);
    setBusyId(null);
    setReplacing(null);
    if (res.success) {
      toast.success("New version uploaded — previous version kept in history");
      refresh();
    } else {
      toast.error(res.error || "Failed to replace file");
    }
  };

  const openVersions = async (a: Attachment) => {
    setVersionsFor(a);
    setVersions([]);
    const res = await listAttachmentVersions(a);
    if (res.success) setVersions(res.data);
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onReplaceFile}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{title}</h4>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {allowedKinds.map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setUploadKind(k)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> {ATTACHMENT_KIND_LABELS[k]}
            </Button>
          ))}
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
                  <Badge variant="outline" className="text-[10px]">{ATTACHMENT_KIND_LABELS[a.kind] ?? a.kind}</Badge>
                  {a.version > 1 && (
                    <Badge variant="secondary" className="text-[10px]">v{a.version}</Badge>
                  )}
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
                {busyId === a.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                <Button size="sm" variant="ghost" onClick={() => openSignedUrl(a, false)} title="Preview">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openSignedUrl(a, true)} title="Download">
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onReplacePick(a)} title="Replace (keeps history)">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {a.version > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => openVersions(a)} title="Version history">
                    <History className="h-4 w-4" />
                  </Button>
                )}
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

      {/* Inline preview (images + PDFs) */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.att.file_name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="w-full h-[70vh] bg-muted rounded-md overflow-auto flex items-center justify-center">
              {preview.att.mime_type.startsWith("image/") ? (
                <img src={preview.url} alt={preview.att.file_name} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.att.file_name} className="w-full h-full rounded-md" />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => preview && openSignedUrl(preview.att, true)} className="gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version history */}
      <Dialog open={!!versionsFor} onOpenChange={(o) => !o && setVersionsFor(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Version history
            </DialogTitle>
          </DialogHeader>
          {versions.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <Badge variant={v.is_current ? "default" : "secondary"} className="text-[10px]">
                    v{v.version}{v.is_current ? " · current" : ""}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{v.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy HH:mm")}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openSignedUrl(v, false)} title="Preview">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openSignedUrl(v, true)} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}