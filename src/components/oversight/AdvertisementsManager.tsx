import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Megaphone, Plus, Trash2, Pencil } from "lucide-react";
import {
  type AdStatus,
  type AdTone,
  type Advertisement,
  deleteAdvertisement,
  getAdvertisementTargets,
  listAdvertisements,
  saveAdvertisement,
  setAdvertisementStatus,
  setAdvertisementTargets,
} from "@/services/advertisement.service";
import {
  getAdPerformance,
  type AdPerformanceRow,
  type PlatformOrganization,
} from "@/services/platform.service";

const ROLES = ["ADMIN", "FINANCE", "HOD", "EMPLOYEE"];
const ORG_TYPES = ["NGO", "NPO"];

interface Props {
  organizations: PlatformOrganization[];
}

const emptyForm = {
  title: "",
  headline: "",
  body: "",
  image_url: "",
  cta_label: "",
  cta_url: "",
  tone: "primary" as AdTone,
  priority: 0,
  status: "DRAFT" as AdStatus,
  starts_at: "",
  ends_at: "",
  target_all: true,
  target_org_types: [] as string[],
  target_roles: [] as string[],
  orgIds: [] as string[],
};

type FormState = typeof emptyForm;

export function AdvertisementsManager({ organizations }: Props) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [performance, setPerformance] = useState<AdPerformanceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [list, perf] = await Promise.all([listAdvertisements(), getAdPerformance()]);
    setAds(list);
    setPerformance(perf);
  };

  useEffect(() => {
    load();
  }, []);

  const perfById = useMemo(
    () => new Map(performance.map((p) => [p.id, p])),
    [performance],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (ad: Advertisement) => {
    const orgIds = await getAdvertisementTargets(ad.id);
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      headline: ad.headline,
      body: ad.body ?? "",
      image_url: ad.image_url ?? "",
      cta_label: ad.cta_label ?? "",
      cta_url: ad.cta_url ?? "",
      tone: ad.tone,
      priority: ad.priority,
      status: ad.status,
      starts_at: ad.starts_at ? ad.starts_at.slice(0, 10) : "",
      ends_at: ad.ends_at ? ad.ends_at.slice(0, 10) : "",
      target_all: ad.target_all,
      target_org_types: ad.target_org_types ?? [],
      target_roles: ad.target_roles ?? [],
      orgIds,
    });
    setOpen(true);
  };

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = async () => {
    if (!form.title.trim() || !form.headline.trim()) {
      toast.error("Give the advert a title and a headline.");
      return;
    }
    setSaving(true);
    const res = await saveAdvertisement(
      {
        title: form.title.trim(),
        headline: form.headline.trim(),
        body: form.body.trim() || null,
        image_url: form.image_url.trim() || null,
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        tone: form.tone,
        priority: Number(form.priority) || 0,
        status: form.status,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(`${form.ends_at}T23:59:59`).toISOString() : null,
        target_all: form.target_all,
        target_org_types: form.target_all ? [] : form.target_org_types,
        target_roles: form.target_roles,
      },
      editingId ?? undefined,
    );

    if (!res.success) {
      setSaving(false);
      toast.error(res.error || "Could not save the advert.");
      return;
    }

    // Refresh so we can find the id of a newly created advert.
    const list = await listAdvertisements();
    const target =
      editingId ?? list.find((a) => a.title === form.title.trim())?.id ?? null;
    if (target) {
      await setAdvertisementTargets(target, form.target_all ? [] : form.orgIds);
    }

    setSaving(false);
    setOpen(false);
    toast.success(editingId ? "Advert updated." : "Advert created.");
    load();
  };

  const publishToggle = async (ad: Advertisement) => {
    const next: AdStatus = ad.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
    const res = await setAdvertisementStatus(ad.id, next);
    if (!res.success) {
      toast.error(res.error || "Could not change the advert.");
      return;
    }
    toast.success(next === "PUBLISHED" ? "Advert is live." : "Advert taken down.");
    load();
  };

  const remove = async (ad: Advertisement) => {
    const res = await deleteAdvertisement(ad.id);
    if (!res.success) {
      toast.error(res.error || "Could not delete the advert.");
      return;
    }
    toast.success("Advert deleted.");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Advertisements
        </CardTitle>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New advert
        </Button>
      </CardHeader>
      <CardContent>
        {ads.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No adverts yet. Nothing appears on any dashboard until you publish one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advert</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => {
                  const perf = perfById.get(ad.id);
                  return (
                    <TableRow key={ad.id}>
                      <TableCell>
                        <p className="font-medium">{ad.title}</p>
                        <p className="text-xs text-muted-foreground">{ad.headline}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {ad.target_all
                          ? "All organisations"
                          : [
                              ad.target_org_types.join(", "),
                              "selected organisations",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                        {ad.target_roles.length > 0 && (
                          <span className="block text-muted-foreground">
                            {ad.target_roles.join(", ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ad.starts_at ? ad.starts_at.slice(0, 10) : "—"} →{" "}
                        {ad.ends_at ? ad.ends_at.slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ad.status === "PUBLISHED" ? "default" : "secondary"}
                        >
                          {ad.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {perf?.views ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {perf?.clicks ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => publishToggle(ad)}
                          >
                            {ad.status === "PUBLISHED" ? "Take down" : "Publish"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(ad)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(ad)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit advert" : "Create advert"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Internal title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Spring upgrade push"
                />
              </div>
              <div>
                <Label>Headline shown to users</Label>
                <Input
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="Important notice"
                />
              </div>
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                rows={3}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Button label</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  placeholder="Learn more"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Button link</Label>
                <Input
                  value={form.cta_url}
                  onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                  placeholder="/billing or https://..."
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Tone</Label>
                <Select
                  value={form.tone}
                  onValueChange={(v) => setForm({ ...form, tone: v as AdTone })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Blue</SelectItem>
                    <SelectItem value="success">Green</SelectItem>
                    <SelectItem value="warning">Amber</SelectItem>
                    <SelectItem value="destructive">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as AdStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.target_all}
                  onCheckedChange={(v) =>
                    setForm({ ...form, target_all: Boolean(v) })
                  }
                />
                Show to every organisation
              </label>

              {!form.target_all && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Organisation types
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {ORG_TYPES.map((t) => (
                        <label key={t} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={form.target_org_types.includes(t)}
                            onCheckedChange={() =>
                              setForm({
                                ...form,
                                target_org_types: toggleIn(form.target_org_types, t),
                              })
                            }
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Specific organisations
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                      {organizations.map((o) => (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={form.orgIds.includes(o.id)}
                            onCheckedChange={() =>
                              setForm({ ...form, orgIds: toggleIn(form.orgIds, o.id) })
                            }
                          />
                          {o.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Roles (leave empty for everyone)
                </p>
                <div className="flex flex-wrap gap-3">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={form.target_roles.includes(r)}
                        onCheckedChange={() =>
                          setForm({
                            ...form,
                            target_roles: toggleIn(form.target_roles, r),
                          })
                        }
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save advert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
