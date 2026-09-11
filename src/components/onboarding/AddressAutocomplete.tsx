import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Suggestion {
  placeId: string;
  description: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const newSessionToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Address field with Google Places (New) type-ahead suggestions, served through
 * an authenticated backend function. Free-form typing is still allowed.
 */
export function AddressAutocomplete({ id, value, onChange, placeholder, required }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipNextLookup = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const sessionToken = useRef<string>(newSessionToken());
  const requestSeq = useRef(0);

  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("places-autocomplete", {
          body: {
            action: "autocomplete",
            input: query,
            sessionToken: sessionToken.current,
          },
        });
        if (seq !== requestSeq.current) return;
        if (error) throw error;
        const list = (data?.suggestions ?? []) as Suggestion[];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        if (seq === requestSeq.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = async (s: Suggestion) => {
    skipNextLookup.current = true;
    onChange(s.description);
    setOpen(false);
    setSuggestions([]);
    requestSeq.current++;

    try {
      const { data } = await supabase.functions.invoke("places-autocomplete", {
        body: {
          action: "details",
          placeId: s.placeId,
          sessionToken: sessionToken.current,
        },
      });
      if (data?.formattedAddress) {
        skipNextLookup.current = true;
        onChange(data.formattedAddress as string);
      }
    } catch {
      /* keep the picked description */
    } finally {
      sessionToken.current = newSessionToken();
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="street-address"
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="w-full text-left px-3 py-2 text-sm flex gap-2 items-start hover:bg-accent"
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Start typing and pick your address, or type it in full.
      </p>
    </div>
  );
}
