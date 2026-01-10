import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PRStatus = Database['public']['Enums']['pr_status'];

const STATUS_LABELS: Record<PRStatus, string> = {
  PENDING_HOD_APPROVAL: 'Pending HOD Approval',
  HOD_APPROVED: 'HOD Approved',
  HOD_DECLINED: 'HOD Declined',
  PENDING_FINANCE_APPROVAL: 'Pending Finance Approval',
  FINANCE_APPROVED: 'Finance Approved',
  FINANCE_DECLINED: 'Finance Declined',
  SPLIT: 'Split',
};

const getStatusStyle = (status: PRStatus): 'success' | 'error' | 'info' | 'warning' => {
  switch (status) {
    case 'HOD_APPROVED':
    case 'FINANCE_APPROVED':
      return 'success';
    case 'HOD_DECLINED':
    case 'FINANCE_DECLINED':
      return 'error';
    case 'PENDING_HOD_APPROVAL':
    case 'PENDING_FINANCE_APPROVAL':
      return 'info';
    case 'SPLIT':
      return 'warning';
    default:
      return 'info';
  }
};

export function usePRNotifications() {
  const { user, role } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to PR changes
    const channel = supabase
      .channel('pr-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchase_requisitions',
        },
        (payload) => {
          const oldRecord = payload.old as { status?: PRStatus; requested_by?: string; transaction_id?: string };
          const newRecord = payload.new as { status?: PRStatus; requested_by?: string; transaction_id?: string; requested_by_name?: string };

          // Only notify if status actually changed
          if (oldRecord.status === newRecord.status) return;

          const newStatus = newRecord.status as PRStatus;
          const transactionId = newRecord.transaction_id || 'Unknown';
          const requesterName = newRecord.requested_by_name || 'Unknown';
          const statusLabel = STATUS_LABELS[newStatus] || newStatus;
          const style = getStatusStyle(newStatus);

          // Notify the requester about their own PR
          if (newRecord.requested_by === user.id) {
            const message = `Your PR #${transactionId} status changed to: ${statusLabel}`;
            showNotification(message, style);
            return;
          }

          // Notify HOD about new PRs pending their approval
          if (role === 'HOD' && newStatus === 'PENDING_HOD_APPROVAL') {
            const message = `New PR #${transactionId} from ${requesterName} requires your approval`;
            showNotification(message, 'info');
            return;
          }

          // Notify Finance about PRs ready for their review
          if (role === 'FINANCE' && newStatus === 'PENDING_FINANCE_APPROVAL') {
            const message = `PR #${transactionId} is ready for finance review`;
            showNotification(message, 'info');
            return;
          }

          // Notify Admin about all status changes
          if (role === 'ADMIN') {
            const message = `PR #${transactionId} status changed to: ${statusLabel}`;
            showNotification(message, style);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, role]);
}

function showNotification(message: string, style: 'success' | 'error' | 'info' | 'warning') {
  switch (style) {
    case 'success':
      toast.success(message, { duration: 5000 });
      break;
    case 'error':
      toast.error(message, { duration: 5000 });
      break;
    case 'warning':
      toast.warning(message, { duration: 5000 });
      break;
    default:
      toast.info(message, { duration: 5000 });
  }
}
