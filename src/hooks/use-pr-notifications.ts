import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PRStatus = Database['public']['Enums']['pr_status'];

const STATUS_LABELS: Record<PRStatus, string> = {
  PENDING_HOD_APPROVAL: 'awaiting HOD approval',
  HOD_APPROVED: 'approved by HOD',
  HOD_DECLINED: 'declined by HOD',
  PENDING_FINANCE_APPROVAL: 'awaiting Finance review',
  FINANCE_APPROVED: 'fully approved',
  FINANCE_DECLINED: 'declined by Finance',
  SPLIT: 'split into multiple requests',
  FULFILLED: 'fulfilled',
  CLOSED: 'closed',
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
  const prChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const quoteChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to PR changes
    const prChannel = supabase
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
            const message = `PR #${transactionId} is now ${statusLabel}`;
            showNotification(message, style, 'Your Purchase Requisition');
            return;
          }

          // Notify HOD about new PRs pending their approval
          if (role === 'HOD' && newStatus === 'PENDING_HOD_APPROVAL') {
            const message = `${requesterName} submitted PR #${transactionId} for your review`;
            showNotification(message, 'info', 'New Approval Request');
            return;
          }

          // Notify Finance about PRs ready for their review
          if (role === 'FINANCE' && newStatus === 'PENDING_FINANCE_APPROVAL') {
            const message = `PR #${transactionId} has been approved by HOD and needs Finance review`;
            showNotification(message, 'info', 'Ready for Finance Review');
            return;
          }

          // Notify Admin about all status changes
          if (role === 'ADMIN') {
            const message = `PR #${transactionId} is now ${statusLabel}`;
            showNotification(message, style, 'Status Update');
          }
        }
      )
      .subscribe();

    prChannelRef.current = prChannel;

    // Subscribe to new chat messages on any PR in the org (RLS scopes visibility)
    const messageChannel = supabase
      .channel('pr-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pr_messages',
        },
        (payload) => {
          const msg = payload.new as {
            sender_id?: string;
            sender_name?: string;
            is_system_note?: boolean;
            message?: string | null;
          };

          // Ignore system notes and the user's own messages
          if (msg.is_system_note) return;
          if (msg.sender_id === user.id) return;

          const sender = msg.sender_name || 'Someone';
          const preview = (msg.message || '').trim();
          const description = preview
            ? `${sender}: ${preview.length > 80 ? preview.slice(0, 80) + '…' : preview}`
            : `${sender} sent an attachment`;
          showNotification(description, 'info', 'New chat message');
        }
      )
      .subscribe();

    messageChannelRef.current = messageChannel;

    // Subscribe to quote request changes for Finance role
    if (role === 'FINANCE') {
      const quoteChannel = supabase
        .channel('quote-request-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quote_requests',
          },
          (payload) => {
            const oldRecord = payload.old as { status?: string };
            const newRecord = payload.new as { status?: string; pr_id?: string };

            // Only notify on status changes to ACCEPTED
            if (oldRecord.status === newRecord.status) return;
            
            if (newRecord.status === 'ACCEPTED') {
              showNotification(
                'A supplier accepted your quote request and will submit their quote shortly',
                'success',
                'Quote Request Accepted'
              );
            } else if (newRecord.status === 'DECLINED') {
              showNotification(
                'A supplier declined your quote request. Consider reaching out to other suppliers.',
                'warning',
                'Quote Request Declined'
              );
            }
          }
        )
        .subscribe();

      quoteChannelRef.current = quoteChannel;

      // Also subscribe to submitted quotes for Finance
      const submittedQuotesChannel = supabase
        .channel('finance-quote-submissions')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'quotes',
          },
          () => {
            showNotification(
              'A supplier has submitted a new quote for your review',
              'info',
              'New Quote Received'
            );
          }
        )
        .subscribe();

      // Subscribe to invoice uploads
      const invoiceChannel = supabase
        .channel('finance-invoice-uploads')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'invoices',
          },
          () => {
            showNotification(
              'A supplier has uploaded an invoice. Review it in the Invoices tab.',
              'success',
              'Invoice Uploaded'
            );
          }
        )
        .subscribe();
    }

    return () => {
      if (prChannelRef.current) {
        supabase.removeChannel(prChannelRef.current);
      }
      if (quoteChannelRef.current) {
        supabase.removeChannel(quoteChannelRef.current);
      }
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
      }
    };
  }, [user, role]);
}

function showNotification(
  message: string,
  style: 'success' | 'error' | 'info' | 'warning',
  title?: string
) {
  const options = { 
    duration: 6000,
    description: message,
  };

  switch (style) {
    case 'success':
      toast.success(title || 'Success', options);
      break;
    case 'error':
      toast.error(title || 'Error', options);
      break;
    case 'warning':
      toast.warning(title || 'Warning', options);
      break;
    default:
      toast.info(title || 'Info', options);
  }
}
