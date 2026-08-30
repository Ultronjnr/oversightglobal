import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, FolderKanban, HeartHandshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listDonors, listProjects, type Donor, type DonationProject } from "@/services/donation.service";
import { useOrgSettings } from "@/hooks/use-org-settings";


export interface ProjectDonorValue {
  projectId: string | null;
  donorId: string | null;
}

interface Props {
  value: ProjectDonorValue;
  onChange: (value: ProjectDonorValue) => void;
  disabled?: boolean;
}

const NONE = "__none__";

/**
 * Project / Donor funding source for a purchase requisition.
 *
 * Only Finance and Admin may set this: tagging a project reserves money against
 * that project's 18A budget. Employees and HODs never see the pickers — if a
 * funding source has already been set by Finance they see it as a read-only label.
 */
export function ProjectDonorSelect({ value, onChange, disabled }: Props) {
  // Who may set the funding source is configurable per organization (Admin > Settings).
  const { canEditFundingSource: canEdit } = useOrgSettings();
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, d] = await Promise.all([listProjects(), listDonors()]);
        if (!active) return;
        setProjects(p.filter((x) => x.status !== "ARCHIVED"));
        setDonors(d.filter((x) => x.is_active));
      } catch {
        // Non-blocking: tagging stays optional if the lists can't be loaded.
        if (active) {
          setProjects([]);
          setDonors([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const projectLabel = useMemo(
    () => projects.find((p) => p.id === value.projectId)?.name ?? "— No project —",
    [projects, value.projectId],
  );
  const donorLabel = useMemo(
    () => donors.find((d) => d.id === value.donorId)?.name ?? "— No donor —",
    [donors, value.donorId],
  );

  // Employees / HODs: never editable. Hidden entirely unless Finance already
  // tagged a funding source, in which case it is shown read-only.
  if (!canEdit) {
    if (!value.projectId && !value.donorId) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReadOnlyField
          label="Project"
          icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
          text={projectLabel}
        />
        <ReadOnlyField
          label="Donor"
          icon={<HeartHandshake className="h-4 w-4 text-muted-foreground" />}
          text={donorLabel}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      <ComboField
        label="Project (optional)"
        icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
        placeholder="Search projects…"
        emptyText={loading ? "Loading projects…" : "No projects found"}
        buttonLabel={projectLabel}
        selectedId={value.projectId}
        options={projects.map((p) => ({
          id: p.id,
          label: p.name,
          hint: p.code ?? undefined,
        }))}
        onSelect={(id) => onChange({ ...value, projectId: id })}
        disabled={disabled}
      />
      <ComboField
        label="Donor (optional)"
        icon={<HeartHandshake className="h-4 w-4 text-muted-foreground" />}
        placeholder="Search donors…"
        emptyText={loading ? "Loading donors…" : "No donors found"}
        buttonLabel={donorLabel}
        selectedId={value.donorId}
        options={donors.map((d) => ({ id: d.id, label: d.name }))}
        onSelect={(id) => onChange({ ...value, donorId: id })}
        disabled={disabled}
      />
    </div>
  );
}

function ComboField({
  label,
  icon,
  placeholder,
  emptyText,
  buttonLabel,
  selectedId,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  emptyText: string;
  buttonLabel: string;
  selectedId: string | null;
  options: { id: string; label: string; hint?: string }[];
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between bg-background/50 font-normal",
              !selectedId && "text-muted-foreground",
            )}
          >
            <span className="truncate">{buttonLabel}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList className="max-h-[220px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={NONE}
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", selectedId ? "opacity-0" : "opacity-100")}
                  />
                  <span className="text-muted-foreground">{label.startsWith("Project") ? "— No project —" : "— No donor —"}</span>
                </CommandItem>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.label} ${o.hint ?? ""}`}
                    onSelect={() => {
                      onSelect(o.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === o.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o.label}</span>
                    {o.hint && (
                      <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ReadOnlyField({
  label,
  icon,
  text,
}: {
  label: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium flex items-center gap-2">
        {icon}
        {label}
      </span>
      <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
        {text}
      </div>
    </div>
  );
}
