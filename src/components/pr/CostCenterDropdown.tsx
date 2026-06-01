import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useActiveDepartments } from "@/hooks/use-departments";

interface CostCenterDropdownProps {
  /** Currently selected cost center name */
  value: string;
  /** Called with the selected cost center name */
  onChange: (value: string) => void;
  /** Optional error message to display below the field */
  error?: string;
  /** Whether the field is required (adds asterisk) */
  required?: boolean;
  /** Optional id for the trigger / label association */
  id?: string;
  /** Optional label text override */
  label?: string;
}

/**
 * Reusable Cost Center / Department selector.
 * Populates options from the organization's ACTIVE cost centers
 * (created in the Admin portal) via the department service.
 */
export function CostCenterDropdown({
  value,
  onChange,
  error,
  required = true,
  id = "cost-center",
  label = "Cost Center / Department",
}: CostCenterDropdownProps) {
  const { departments, isLoading } = useActiveDepartments();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && "*"}
      </Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger id={id} className="bg-background/50">
          <SelectValue
            placeholder={
              isLoading
                ? "Loading..."
                : departments.length === 0
                ? "No cost centers available"
                : "Select a cost center / department"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.name}>
              {dept.code ? `${dept.code} — ${dept.name}` : dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}