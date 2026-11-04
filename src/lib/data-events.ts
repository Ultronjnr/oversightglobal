import { useEffect, useRef } from "react";

/**
 * Lightweight in-app signal fired after something creates or changes a
 * requisition (e.g. a scanned invoice submitted from the global scan button),
 * so open portal lists can reload without a page refresh.
 */
const EVENT = "ovasyt:requisitions-changed";

export function emitRequisitionsChanged() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useRequisitionsChanged(callback: () => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
}

/** Fired after a payment batch, payment or reimbursement status changes. */
const PAYMENTS_EVENT = "ovasyt:payments-changed";

export function emitPaymentsChanged() {
  window.dispatchEvent(new CustomEvent(PAYMENTS_EVENT));
}

export function usePaymentsChanged(callback: () => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(PAYMENTS_EVENT, handler);
    return () => window.removeEventListener(PAYMENTS_EVENT, handler);
  }, []);
}
