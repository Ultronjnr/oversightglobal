import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getDashboard,
  listDonors,
  listReceipts,
  listDonations,
  type DonationDashboard,
  type Donor,
  type DonationReceipt,
  type Donation,
} from "@/services/donation.service";
import { Users, HandCoins, Receipt, Clock, Wallet, PieChart, Search } from "lucide-react";
import { Card } from "@/components/ui/card";

export function DonationDashboardTab() {
  const { format } = useCurrency();
  const [data, setData] = useState<DonationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [donors, setDonors] = useState<Donor[]>([]);
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [d, dn, rc, dt] = await Promise.all([
          getDashboard(),
          listDonors(),
          listReceipts(),
          listDonations(),
        ]);
        setData(d);
        setDonors(dn);
        setReceipts(rc);
        setDonations(dt);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = query.trim().toLowerCase();
  const donorMatches = q ? donors.filter((d) => d.name.toLowerCase().includes(q)) : [];
  const receiptMatches = q ? receipts.filter((r) => r.receipt_number.toLowerCase().includes(q)) : [];
  const donationMatches = q
    ? donations.filter((d) => (d.description || "").toLowerCase().includes(q))
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total Donors" value={data?.totalDonors ?? 0} isLoading={loading} icon={<Users />} valueColor="primary" />
        <StatCard label="Total Donations" value={data ? format(data.totalDonations) : "-"} isLoading={loading} icon={<HandCoins />} valueColor="success" />
        <StatCard label="Receipts Issued" value={data?.receiptsIssued ?? 0} isLoading={loading} icon={<Receipt />} />
        <StatCard label="Pending Receipts" value={Math.max(data?.pendingReceipts ?? 0, 0)} isLoading={loading} icon={<Clock />} valueColor="warning" />
        <StatCard label="Available Funding" value={data ? format(data.availableFunding) : "-"} isLoading={loading} icon={<Wallet />} valueColor="primary" />
        <StatCard label="Allocated Funding" value={data ? format(data.allocatedFunding) : "-"} isLoading={loading} icon={<PieChart />} />
      </div>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search donors, receipts, donations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-1">Donors ({donorMatches.length})</p>
              {donorMatches.slice(0, 5).map((d) => (
                <div key={d.id} className="text-muted-foreground">{d.name}</div>
              ))}
            </div>
            <div>
              <p className="font-semibold mb-1">Receipts ({receiptMatches.length})</p>
              {receiptMatches.slice(0, 5).map((r) => (
                <div key={r.id} className="text-muted-foreground">{r.receipt_number} — {r.status}</div>
              ))}
            </div>
            <div>
              <p className="font-semibold mb-1">Donations ({donationMatches.length})</p>
              {donationMatches.slice(0, 5).map((d) => (
                <div key={d.id} className="text-muted-foreground">{format(Number(d.amount))} — {d.description || "Donation"}</div>
              ))}
            </div>
          </div>
        )}
        {!q && <p className="text-sm text-muted-foreground">Type to search across donors, receipts and donations.</p>}
      </Card>
    </div>
  );
}