// Rewards & Loyalty admin page
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface RewardRule {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  productId: string | null;
  product?: { id: string; name: string; slug: string } | null;
  triggerType: string;
  threshold: number;
  minSpend: number | null;
  rewardType: string;
  rewardValue: string;
  promoCode: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

interface ProductOption {
  id: string;
  name: string;
}

interface EligibleReward {
  id: string;
  name: string;
  minSpend: number;
  rewardType: string;
  rewardValue: string;
}

interface ProgressUser {
  userId: string | null;
  email: string;
  name: string;
  phone: string | null;
  totalSpend: number;
  eligibleRewards: EligibleReward[];
}

interface Dispatch {
  id: string;
  channel: string;
  status: string;
  message: string | null;
  sentAt: string | null;
  createdAt: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  rewardRule: { id: string; name: string; rewardValue: string } | null;
}

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderTotal: number | null;
  active: boolean;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
}

type Tab = "rules" | "progress" | "promos" | "airtime";

interface AirtimeVoucher {
  id: string;
  amount: number;
  pinCode: string;
  network: string | null;
  status: string;
  assignedOrderId: string | null;
  usedAt: string | null;
  createdAt: string;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(n);

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    SENT: "bg-green-100 text-green-700",
    PENDING: "bg-amber-100 text-amber-700",
    FAILED: "bg-red-100 text-red-700",
    REDEEMED: "bg-blue-100 text-blue-700",
  };
  return map[status] || "bg-slate-100 text-slate-600";
};

export default function RewardsPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [rules, setRules] = useState<RewardRule[]>([]);
  const [users, setUsers] = useState<ProgressUser[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [vouchers, setVouchers] = useState<AirtimeVoucher[]>([]);
  const [voucherForm, setVoucherForm] = useState({
    amount: "",
    network: "Ethio Telecom",
    pins: "",
  });
  const [savingVouchers, setSavingVouchers] = useState(false);

  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    scope: "ALL_ORDERS",
    productId: "",
    triggerType: "MIN_SPEND",
    threshold: "",
    rewardType: "FIXED_CASHBACK",
    rewardValue: "",
    promoCode: "",
    expiresAt: "",
    active: true,
  });
  const [savingRule, setSavingRule] = useState(false);

  const [promoForm, setPromoForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "",
    minOrderTotal: "",
    expiresAt: "",
    usageLimit: "",
    active: true,
  });
  const [savingPromo, setSavingPromo] = useState(false);

  const [dispatchForm, setDispatchForm] = useState({
    rewardRuleId: "",
    userId: "",
    orderId: "",
    recipientEmail: "",
    recipientPhone: "",
    channel: "BOTH",
    customMessage: "",
  });
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [rulesRes, progressRes, promosRes, productsRes, vouchersRes] = await Promise.all([
        api.get("/api/admin/rewards/rules"),
        api.get("/api/admin/rewards/progress"),
        api.get("/api/admin/promo-codes"),
        api.get("/api/products/admin/all", { params: { limit: 200 } }),
        api.get("/api/admin/airtime-vouchers"),
      ]);
      setRules(rulesRes.data.rules || []);
      setUsers(progressRes.data.users || []);
      setDispatches(progressRes.data.dispatches || []);
      setPromos(promosRes.data.codes || []);
      setVouchers(vouchersRes.data?.vouchers || []);
      const plist = productsRes.data?.products || productsRes.data || [];
      setProducts(
        (Array.isArray(plist) ? plist : [])
          .map((p: { id?: unknown; name?: unknown }) => ({
            id: String(p.id ?? ""),
            name: String(p.name ?? ""),
          }))
          .filter((p) => p.id && p.name)
      );
    } catch {
      setError("Failed to load rewards data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    setError("");
    try {
      await api.post("/api/admin/rewards/rules", {
        name: ruleForm.name,
        description: ruleForm.description || null,
        scope: ruleForm.scope,
        productId: ruleForm.scope === "PRODUCT" ? ruleForm.productId : null,
        triggerType: ruleForm.triggerType,
        threshold: Number(ruleForm.threshold),
        minSpend:
          ruleForm.triggerType === "MIN_SPEND"
            ? Number(ruleForm.threshold)
            : null,
        rewardType: ruleForm.rewardType,
        rewardValue: ruleForm.rewardValue,
        promoCode: ruleForm.promoCode || null,
        expiresAt: ruleForm.expiresAt || null,
        active: ruleForm.active,
      });
      setRuleForm({
        name: "", description: "", scope: "ALL_ORDERS", productId: "",
        triggerType: "MIN_SPEND", threshold: "", rewardType: "FIXED_CASHBACK",
        rewardValue: "", promoCode: "", expiresAt: "", active: true,
      });
      setNotice("Reward rule created.");
      await loadAll();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || "Could not create rule.");
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRule = async (rule: RewardRule) => {
    try {
      await api.patch(`/api/admin/rewards/rules/${rule.id}`, { active: !rule.active });
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    } catch {
      setError("Could not update rule.");
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this reward rule?")) return;
    try {
      await api.delete(`/api/admin/rewards/rules/${id}`);
      setRules((rs) => rs.filter((r) => r.id !== id));
    } catch {
      setError("Could not delete rule.");
    }
  };

  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    setError("");
    try {
      await api.post("/api/admin/promo-codes", {
        ...promoForm,
        discountValue: Number(promoForm.discountValue),
        minOrderTotal: promoForm.minOrderTotal ? Number(promoForm.minOrderTotal) : null,
        expiresAt: promoForm.expiresAt || null,
        usageLimit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null,
      });
      setPromoForm({ code: "", description: "", discountType: "PERCENT", discountValue: "", minOrderTotal: "", expiresAt: "", usageLimit: "", active: true });
      setNotice("Promo code created.");
      await loadAll();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || "Could not create promo code.");
    } finally {
      setSavingPromo(false);
    }
  };

  const togglePromo = async (p: PromoCode) => {
    try {
      await api.patch(`/api/admin/promo-codes/${p.id}`, { active: !p.active });
      setPromos((ps) => ps.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    } catch {
      setError("Could not update promo code.");
    }
  };

  const deletePromo = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      await api.delete(`/api/admin/promo-codes/${id}`);
      setPromos((ps) => ps.filter((p) => p.id !== id));
    } catch {
      setError("Could not delete promo code.");
    }
  };

  const sendReward = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setNotice("");
    try {
      const res = await api.post("/api/admin/rewards/dispatch", dispatchForm);
      setNotice(res.data.success ? "Reward dispatched successfully." : "Dispatch failed — check audit log.");
      if (res.data.dispatch) setDispatches((ds) => [res.data.dispatch, ...ds]);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || "Could not send reward.");
    } finally {
      setSending(false);
    }
  };

  const addVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVouchers(true);
    setError("");
    setNotice("");
    try {
      const res = await api.post("/api/admin/airtime-vouchers/bulk", {
        amount: Number(voucherForm.amount),
        network: voucherForm.network || null,
        pins: voucherForm.pins,
      });
      setNotice(`Added ${res.data.created ?? 0} airtime voucher(s).`);
      setVoucherForm({ amount: "", network: "Ethio Telecom", pins: "" });
      await loadAll();
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || "Could not add vouchers.");
    } finally {
      setSavingVouchers(false);
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm("Delete this airtime voucher?")) return;
    try {
      await api.delete(`/api/admin/airtime-vouchers/${id}`);
      setVouchers((vs) => vs.filter((v) => v.id !== id));
    } catch {
      setError("Could not delete voucher.");
    }
  };

  const markRedeemed = async (id: string) => {
    try {
      await api.patch(`/api/admin/rewards/dispatch/${id}`, { status: "REDEEMED" });
      setDispatches((ds) => ds.map((d) => (d.id === id ? { ...d, status: "REDEEMED" } : d)));
    } catch {
      setError("Could not update dispatch status.");
    }
  };

  const inputCls =
    "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20";
  const labelCls = "block text-sm font-semibold text-slate-700";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Loading rewards…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rewards & Loyalty</h1>
        <p className="text-sm text-slate-500">
          Manage reward rules, track customer spend, and dispatch rewards via SMS/Email.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["rules", "Reward Rules"],
            ["progress", "Customer Progress"],
            ["promos", "Promo Codes"],
            ["airtime", "Airtime Vouchers"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === key
                ? "border-[#cf5427] text-[#cf5427]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={createRule}
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-900">New Reward Rule</h2>
            <div className="space-y-3">
              <label className={labelCls}>
                Campaign / rule title <span className="text-red-600">*</span>
                <input required className={inputCls} value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder='e.g. "Buy 2+ Running Shoes & Get 300 ETB Bonus"' />
              </label>
              <label className={labelCls}>
                Description
                <input className={inputCls} value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Optional details shown to admin" />
              </label>

              <div>
                <span className={labelCls}>Applies to</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["ALL_ORDERS", "All Store Orders"],
                      ["PRODUCT", "Specific Product"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() =>
                        setRuleForm({ ...ruleForm, scope: val, productId: "" })
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        ruleForm.scope === val
                          ? "border-[#cf5427] bg-[#cf5427]/10 text-[#cf5427]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {ruleForm.scope === "PRODUCT" && (
                <label className={labelCls}>
                  Product <span className="text-red-600">*</span>
                  <select required className={inputCls} value={ruleForm.productId}
                    onChange={(e) => setRuleForm({ ...ruleForm, productId: e.target.value })}>
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <div>
                <span className={labelCls}>Trigger condition</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["MIN_QUANTITY", "Min. quantity bought"],
                      ["MIN_SPEND", "Min. amount spent"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRuleForm({ ...ruleForm, triggerType: val })}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        ruleForm.triggerType === val
                          ? "border-[#cf5427] bg-[#cf5427]/10 text-[#cf5427]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className={labelCls}>
                {ruleForm.triggerType === "MIN_QUANTITY"
                  ? "Minimum quantity"
                  : "Minimum amount (ETB)"}{" "}
                <span className="text-red-600">*</span>
                <input required type="number" min="0" step={ruleForm.triggerType === "MIN_QUANTITY" ? "1" : "0.01"} className={inputCls}
                  value={ruleForm.threshold}
                  onChange={(e) => setRuleForm({ ...ruleForm, threshold: e.target.value })}
                  placeholder={ruleForm.triggerType === "MIN_QUANTITY" ? "3" : "5000"} />
              </label>

              <label className={labelCls}>
                Reward type
                <select className={inputCls} value={ruleForm.rewardType}
                  onChange={(e) => setRuleForm({ ...ruleForm, rewardType: e.target.value })}>
                  <option value="FIXED_CASHBACK">Fixed Cashback / Voucher (ETB)</option>
                  <option value="PERCENT_DISCOUNT">Percentage Discount (%)</option>
                  <option value="FREE_ITEM">Free Bonus Item / Gift</option>
                  <option value="CUSTOM">Custom Reward</option>
                  <option value="MOBILE_AIRTIME">Mobile Airtime / Phone Card (ETB)</option>
                </select>
              </label>

              <label className={labelCls}>
                {ruleForm.rewardType === "PERCENT_DISCOUNT"
                  ? "Discount percent (%)"
                  : ruleForm.rewardType === "FREE_ITEM"
                  ? "Free item / gift name"
                  : ruleForm.rewardType === "CUSTOM"
                  ? "Reward description"
                  : ruleForm.rewardType === "MOBILE_AIRTIME"
                  ? "Airtime amount (ETB)"
                  : "Reward value (ETB)"}{" "}
                <span className="text-red-600">*</span>
                <input required className={inputCls} value={ruleForm.rewardValue}
                  onChange={(e) => setRuleForm({ ...ruleForm, rewardValue: e.target.value })}
                  placeholder={
                    ruleForm.rewardType === "PERCENT_DISCOUNT"
                      ? "15"
                      : ruleForm.rewardType === "FREE_ITEM"
                      ? "Free Cotton Socks"
                      : ruleForm.rewardType === "CUSTOM"
                      ? "Free delivery on next order"
                      : ruleForm.rewardType === "MOBILE_AIRTIME"
                      ? "50"
                      : "300"
                  } />
              </label>

              {(ruleForm.rewardType === "FIXED_CASHBACK" ||
                ruleForm.rewardType === "PERCENT_DISCOUNT") && (
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelCls}>
                    Promo code
                    <input className={inputCls} value={ruleForm.promoCode}
                      onChange={(e) =>
                        setRuleForm({ ...ruleForm, promoCode: e.target.value.toUpperCase() })
                      }
                      placeholder="REWARD300" />
                  </label>
                  <label className={labelCls}>
                    Code expiry
                    <input type="date" className={inputCls} value={ruleForm.expiresAt}
                      onChange={(e) => setRuleForm({ ...ruleForm, expiresAt: e.target.value })} />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={ruleForm.active}
                  onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })}
                  className="h-4 w-4 accent-[#cf5427]" />
                Active immediately
              </label>
              <button type="submit" disabled={savingRule}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60">
                {savingRule ? "Creating…" : "Create Rule"}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {rules.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No reward rules yet. Create one to start rewarding loyal customers.
              </p>
            )}
            {rules.map((rule) => (
              <div key={rule.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm ${
                  rule.active ? "border-slate-200" : "border-slate-200 opacity-60"
                }`}>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{rule.name}</p>
                  {rule.description && <p className="text-xs text-slate-500">{rule.description}</p>}
                  <p className="mt-1 text-sm text-slate-600">
                    {rule.scope === "PRODUCT" ? (
                      <>
                        <strong>{rule.product?.name || "Product"}</strong>
                        {rule.triggerType === "MIN_QUANTITY"
                          ? ` · buy ≥ ${Number(rule.threshold)} units`
                          : ` · spend ≥ ${money(Number(rule.threshold))}`}
                      </>
                    ) : rule.triggerType === "MIN_QUANTITY" ? (
                      <>Any order · buy ≥ {Number(rule.threshold)} units total</>
                    ) : (
                      <>Spend ≥ <strong>{money(Number(rule.threshold ?? rule.minSpend ?? 0))}</strong></>
                    )}
                    {" → "}
                    <span className="font-semibold text-[#cf5427]">{rule.rewardValue}</span>
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {rule.rewardType}
                    </span>
                    {rule.promoCode && (
                      <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                        {rule.promoCode}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleRule(rule)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
                    {rule.active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => deleteRule(rule.id)}
                    className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div className="space-y-6">
          <form onSubmit={sendReward}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Send Reward</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelCls}>
                Reward rule
                <select className={inputCls} value={dispatchForm.rewardRuleId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, rewardRuleId: e.target.value })}>
                  <option value="">— Custom message —</option>
                  {rules.filter((r) => r.active).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.rewardValue})</option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                Customer email
                <input type="email" className={inputCls} value={dispatchForm.recipientEmail}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, recipientEmail: e.target.value })} />
              </label>
              <label className={labelCls}>
                Customer phone
                <input className={inputCls} value={dispatchForm.recipientPhone}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, recipientPhone: e.target.value })}
                  placeholder="+251..." />
              </label>
              <label className={labelCls}>
                Channel
                <select className={inputCls} value={dispatchForm.channel}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, channel: e.target.value })}>
                  <option value="BOTH">SMS + Email</option>
                  <option value="SMS">SMS only</option>
                  <option value="EMAIL">Email only</option>
                </select>
              </label>
              <label className={`${labelCls} sm:col-span-2`}>
                Custom message (optional)
                <input className={inputCls} value={dispatchForm.customMessage}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, customMessage: e.target.value })}
                  placeholder="Overrides rule text" />
              </label>
            </div>
            <button type="submit" disabled={sending}
              className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-[#20283a] px-6 text-sm font-extrabold text-white transition hover:bg-[#cf5427] disabled:opacity-60">
              {sending ? "Sending…" : "Send Reward"}
            </button>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total Spend</th>
                  <th className="px-4 py-3">Eligible Rewards</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No customer spend data yet.
                  </td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.userId || u.email} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(u.totalSpend)}</td>
                    <td className="px-4 py-3">
                      {u.eligibleRewards.length === 0 ? (
                        <span className="text-xs text-slate-400">None yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.eligibleRewards.map((r) => (
                            <span key={r.id}
                              className="rounded-full bg-[#cf5427]/10 px-2.5 py-1 text-xs font-semibold text-[#cf5427]">
                              {r.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.eligibleRewards.length > 0 ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                          Eligible
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                          In progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-5 py-4 text-lg font-bold text-slate-900">
              Dispatch Audit Log
            </h2>
            <div className="divide-y divide-slate-100">
              {dispatches.length === 0 && (
                <p className="px-5 py-6 text-sm text-slate-500">No rewards dispatched yet.</p>
              )}
              {dispatches.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {d.rewardRule?.name || "Custom reward"}
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{d.channel}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {d.recipientEmail || "—"} {d.recipientPhone ? `· ${d.recipientPhone}` : ""}
                      {" · "}{new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge(d.status)}`}>
                      {d.status}
                    </span>
                    {d.status === "SENT" && (
                      <button onClick={() => markRedeemed(d.id)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">
                        Mark Redeemed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "promos" && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={createPromo}
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">New Promo Code</h2>
            <div className="space-y-3">
              <label className={labelCls}>
                Code <span className="text-red-600">*</span>
                <input required className={inputCls} value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE10" />
              </label>
              <label className={labelCls}>
                Description
                <input className={inputCls} value={promoForm.description}
                  onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  Type
                  <select className={inputCls} value={promoForm.discountType}
                    onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}>
                    <option value="PERCENT">Percent %</option>
                    <option value="FIXED">Fixed ETB</option>
                  </select>
                </label>
                <label className={labelCls}>
                  Value <span className="text-red-600">*</span>
                  <input required type="number" min="0" step="0.01" className={inputCls}
                    value={promoForm.discountValue}
                    onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })} />
                </label>
              </div>
              <label className={labelCls}>
                Min. order total (optional)
                <input type="number" min="0" step="0.01" className={inputCls}
                  value={promoForm.minOrderTotal}
                  onChange={(e) => setPromoForm({ ...promoForm, minOrderTotal: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  Expires at
                  <input type="date" className={inputCls} value={promoForm.expiresAt}
                    onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })} />
                </label>
                <label className={labelCls}>
                  Usage limit
                  <input type="number" min="1" className={inputCls} value={promoForm.usageLimit}
                    onChange={(e) => setPromoForm({ ...promoForm, usageLimit: e.target.value })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={promoForm.active}
                  onChange={(e) => setPromoForm({ ...promoForm, active: e.target.checked })}
                  className="h-4 w-4 accent-[#cf5427]" />
                Active
              </label>
              <button type="submit" disabled={savingPromo}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60">
                {savingPromo ? "Creating…" : "Create Promo Code"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {promos.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No promo codes yet.</td></tr>
                )}
                {promos.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{p.code}</p>
                      {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {p.discountType === "PERCENT" ? `${p.discountValue}%` : money(Number(p.discountValue))}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.usedCount}{p.usageLimit ? ` / ${p.usageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePromo(p)}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          p.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                        }`}>
                        {p.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deletePromo(p.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "airtime" && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={addVouchers}
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Add Airtime PINs</h2>
            <p className="mt-1 text-xs text-slate-500">
              Bulk-paste recharge PIN codes. When a MOBILE_AIRTIME reward is dispatched,
              an AVAILABLE PIN matching the amount is sent to the customer automatically.
            </p>
            <div className="mt-4 space-y-3">
              <label className={labelCls}>
                Amount per PIN (ETB) <span className="text-red-600">*</span>
                <input required type="number" min="1" step="0.01" className={inputCls}
                  value={voucherForm.amount}
                  onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })}
                  placeholder="e.g. 50" />
              </label>
              <label className={labelCls}>
                Network
                <select className={inputCls} value={voucherForm.network}
                  onChange={(e) => setVoucherForm({ ...voucherForm, network: e.target.value })}>
                  <option>Ethio Telecom</option>
                  <option>Safaricom</option>
                  <option>Telebirr</option>
                  <option>Other</option>
                </select>
              </label>
              <label className={`${labelCls} sm:col-span-2`}>
                PIN codes <span className="text-red-600">*</span>
                <textarea required rows={6} className={inputCls}
                  value={voucherForm.pins}
                  onChange={(e) => setVoucherForm({ ...voucherForm, pins: e.target.value })}
                  placeholder={"Paste PINs — one per line or comma-separated:\n123456789012\n987654321098"} />
              </label>
              <button type="submit" disabled={savingVouchers}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60">
                {savingVouchers ? "Adding…" : "Add Vouchers"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">PIN Code</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Network</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No airtime vouchers yet. Add PINs to enable MOBILE_AIRTIME rewards.
                  </td></tr>
                )}
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{v.pinCode}</td>
                    <td className="px-4 py-3 font-semibold text-[#9c3d1a]">{money(Number(v.amount))}</td>
                    <td className="px-4 py-3 text-slate-600">{v.network || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        v.status === "AVAILABLE"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.status === "AVAILABLE" && (
                        <button onClick={() => deleteVoucher(v.id)}
                          className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-600">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
