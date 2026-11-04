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
