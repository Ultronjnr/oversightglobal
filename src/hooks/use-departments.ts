import { useEffect, useState } from "react";
import {
  getActiveDepartments,
  type Department,
} from "@/services/department.service";

/**
 * Loads the organization's ACTIVE cost centers / departments.
 * Shared across forms that require a department selection.
 */
export function useActiveDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getActiveDepartments();
      if (mounted && result.success) setDepartments(result.data);
      if (mounted) setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { departments, isLoading };
}