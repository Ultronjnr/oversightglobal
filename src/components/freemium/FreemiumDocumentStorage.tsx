import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FreemiumDoc {
  id: string;
  file_path: string;
  file_name: string;
  description: string | null;
  upload_date: string;
}

const TOTAL_LIMIT = 50;
const DAILY_LIMIT = 3;
const LIMIT_MSG = "Upload limit reached. Upgrade to continue.";

export function FreemiumDocumentStorage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<FreemiumDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("freemium_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("upload_date", { ascending: false });
    if (error) toast.error("Failed to load documents");
    else setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const todayCount = docs.filter(
    (d) => new Date(d.upload_date).getTime() > Date.now() - 24 * 60 * 60 * 1000
  ).length;
  const totalCount = docs.length;
  const limitReached = totalCount >= TOTAL_LIMIT || todayCount >= DAILY_LIMIT;

  const handleUpload = async () => {
    if (!user || !file) return;
    if (limitReached) {
      toast.error(LIMIT_MSG);
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("freemium-documents")
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("freemium_documents").insert({
        user_id: user.id,
        file_path: path,
        file_name: file.name,
        description: description.trim() || null,
      });

      if (insErr) {
        // Roll back the storage upload if DB insert fails (e.g. limit trigger)
        await supabase.storage.from("freemium-documents").remove([path]);
        if (insErr.message?.toLowerCase().includes("upload limit")) {
          toast.error(LIMIT_MSG);
        } else {
          toast.error(insErr.message);
        }
        return;
      }

      toast.success("Document uploaded");
      setFile(null);
      setDescription("");
      const input = document.getElementById("freemium-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: FreemiumDoc) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    const { error: stErr } = await supabase.storage
      .from("freemium-documents")
      .remove([doc.file_path]);
    if (stErr) {
      toast.error("Failed to delete file");
      return;
    }
    const { error: dbErr } = await supabase
      .from("freemium_documents")
      .delete()
      .eq("id", doc.id);
    if (dbErr) {
      toast.error("Failed to delete record");
      return;
    }
    toast.success("Deleted");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Document Storage
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">
              {totalCount}/{TOTAL_LIMIT} total
            </Badge>
            <Badge variant="outline">
              {todayCount}/{DAILY_LIMIT} today
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload form */}
        <div className="border-2 border-dashed border-border rounded-xl p-6 space-y-4">
          <div>
            <Label htmlFor="freemium-file-input">File</Label>
            <Input
              id="freemium-file-input"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={uploading || limitReached}
            />
          </div>
          <div>
            <Label htmlFor="freemium-description">Description (optional)</Label>
            <Textarea
              id="freemium-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this document?"
              rows={2}
              disabled={uploading || limitReached}
            />
          </div>
          {limitReached && (
            <p className="text-sm text-destructive font-medium">{LIMIT_MSG}</p>
          )}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || limitReached}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
        </div>

        {/* Doc list */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Your Documents
          </h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.file_name}</p>
                      {d.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {d.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(d.upload_date), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(d)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
