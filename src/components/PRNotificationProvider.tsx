import { usePRNotifications } from '@/hooks/use-pr-notifications';

export function PRNotificationProvider({ children }: { children: React.ReactNode }) {
  usePRNotifications();
  return <>{children}</>;
}
