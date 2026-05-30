import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { Building2, Plus, Pencil, Power, Loader2 } from "lucide-react";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  setDepartmentActive,
  type Department,
} from "@/services/department.service";
import { getOrganizationUsers, type UserProfile } from "@/services/admin.service";
import { formatCurrency } from "@/lib/utils";

const NO_MANAGER = "__none__";

export function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [managerId, setManagerId] = useState<string>(NO_MANAGER);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [deptResult, usersResult] = await Promise.all([
      getDepartments(),
      getOrganizationUsers(),
    ]);
    if (deptResult.success) setDepartments(deptResult.data);
    else toast.error(deptResult.error || "Failed to load cost centers");
    if (usersResult.success) setUsers(usersResult.data);
    setIsLoading(false);
  };

  const managerName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((user) => user.id === id);
    return u ? `${u.name} ${u.surname || ""}`.trim() : "—";
  };

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setBudgetLimit("");
    setManagerId(NO_MANAGER);
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code || "");
    setBudgetLimit(dept.budget_limit != null ? String(dept.budget_limit) : "");
    setManagerId(dept.manager_user_id || NO_MANAGER);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Cost Center / Department name is required");
      return;
    }

    const parsedBudget = budgetLimit.trim() ? Number(budgetLimit) : null;
    if (parsedBudget != null && (isNaN(parsedBudget) || parsedBudget < 0)) {
      toast.error("Budget limit must be a valid positive number");
      return;
    }

    const payload = {
      name,
      code: code.trim() || null,
      budget_limit: parsedBudget,
      manager_user_id: managerId === NO_MANAGER ? null : managerId,
    };

    setIsSaving(true);
    const result = editing
      ? await updateDepartment(editing.id, payload)
      : await createDepartment(payload);
    setIsSaving(false);

    if (result.success) {
      toast.success(
        editing
          ? "Cost Center / Department updated"
          : "Cost Center / Department added"
      );
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(result.error || "Failed to save cost center");
    }
  };

  const handleToggleActive = async (dept: Department) => {
    const result = await setDepartmentActive(dept.id, !dept.is_active);
    if (result.success) {
      toast.success(
        dept.is_active
          ? "Cost Center / Department deactivated"
          : "Cost Center / Department reactivated"
      );
      loadData();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Cost Centers / Departments
          </CardTitle>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Center / Department
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              No Cost Centers / Departments Yet
            </h3>
            <p className="text-sm text-muted-foreground">
              No departments yet — add your first cost center to start tracking
              expenditure
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Cost Center / Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Budget Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-mono text-sm">
                      {dept.code || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{managerName(dept.manager_user_id)}</TableCell>
                    <TableCell>
                      {dept.budget_limit != null
                        ? formatCurrency(dept.budget_limit)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {dept.is_active ? (
                        <Badge className="bg-success/20 text-success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(dept)}
                          title="Edit cost center / department"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(dept)}
                          className={
                            dept.is_active
                              ? "text-destructive hover:text-destructive"
                              : "text-success hover:text-success"
                          }
                          title={
                            dept.is_active
                              ? "Deactivate cost center / department"
                              : "Reactivate cost center / department"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Edit Cost Center / Department"
                : "Add Cost Center / Department"}
            </DialogTitle>
            <DialogDescription>
              Cost Centers / Departments are used to track expenditure across the
              organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">
                Cost Center / Department Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Finance, IT, Operations"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-code">Cost Center Code (Optional)</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CC-001, FIN-01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-budget">Budget Limit (Optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R
                </span>
                <Input
                  id="dept-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cost Center / Department Manager (Optional)</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.surname || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editing
                ? "Save Changes"
                : "Add Cost Center / Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}