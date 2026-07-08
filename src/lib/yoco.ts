/**
 * Yoco publishable (public) key. Safe to ship in client code.
 * Replace with your live/test public key from the Yoco dashboard once the
 * merchant account is set up. Until then the popup is disabled gracefully.
 */
export const YOCO_PUBLIC_KEY =
  (import.meta.env.VITE_YOCO_PUBLIC_KEY as string | undefined) || "";

const SDK_URL = "https://js.yoco.com/sdk/v1/yoco-sdk-web.js";

let sdkPromise: Promise<any> | null = null;

/** Lazy-load the Yoco Web SDK. Returns a configured SDK instance or null. */
export function loadYoco(): Promise<any> {
  if (!YOCO_PUBLIC_KEY) return Promise.resolve(null);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if ((window as any).YocoSDK) {
      resolve(new (window as any).YocoSDK({ publicKey: YOCO_PUBLIC_KEY }));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => {
      const YocoSDK = (window as any).YocoSDK;
      resolve(YocoSDK ? new YocoSDK({ publicKey: YOCO_PUBLIC_KEY }) : null);
    };
    s.onerror = () => reject(new Error("Failed to load Yoco SDK"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export interface YocoTokenResult {
  id: string;
  card?: { brand?: string; last4?: string; expiryMonth?: number; expiryYear?: number };
  error?: { message: string };
}

/** Opens the Yoco popup and resolves with a card token. */
export function openYocoPopup(amountInCents: number, currency = "ZAR"): Promise<YocoTokenResult> {
  return new Promise(async (resolve, reject) => {
    const yoco = await loadYoco();
    if (!yoco) {
      reject(new Error("Yoco is not configured yet. Add your Yoco public key to enable card capture."));
      return;
    }
    yoco.showPopup({
      amountInCents,
      currency,
      name: "Subscription",
      description: "Save card for monthly billing",
      callback: (result: YocoTokenResult) => {
        if (result.error) reject(new Error(result.error.message));
        else resolve(result);
      },
    });
  });
}
