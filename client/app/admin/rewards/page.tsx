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
  currency: string;
  payoutMethod: string;
  payoutDetails: string | null;
  promoCode: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

type Tab = "rules" | "airtime";

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

interface AirtimeTransaction {
  id: string;
  phone: string;
  network: string | null;
  amount: number;
  currency: string;
  status: string;
  requestId: string | null;
  error: string | null;
  createdAt: string;
}

interface OrderContext {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  status: string;
  rewardQualified: boolean;
  qualifiedRule: {
    id: string;
    name: string;
    rewardType: string;
    rewardValue: string;
    currency?: string;
    payoutMethod?: string;
    promoCode: string | null;
    triggerType: string;
    threshold: number;
    scope: string;
  } | null;
  items: { productName: string; quantity: number; unitPrice?: number }[];
  rewardDispatches?: { id: string; channel: string; status: string }[];
}

// Mobile Airtime removed from this list
const PAYOUT_METHODS = [
  ["TELEBIRR", "Telebirr"],
  ["CBE", "CBE Birr"],
  ["AWASH", "Awash Money"],
  ["CHAPA", "Chapa"],
  ["USD_TRANSFER", "USD Transfer"],
  ["OTHER", "Other"],
] as const;

const money = (n: number, currency = "ETB") =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

export default function RewardsPage() {
  const [tab, setTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [rules, setRules] = useState<RewardRule[]>([]);
  const [vouchers, setVouchers] = useState<AirtimeVoucher[]>([]);
  const [airtimeHistory, setAirtimeHistory] = useState<AirtimeTransaction[]>([]);
  const [voucherForm, setVoucherForm] = useState({
    amount: "",
    network: "Ethio Telecom",
    pins: "",
  });
  const [savingVouchers, setSavingVouchers] = useState(false);
  const [airtimeForm, setAirtimeForm] = useState({ phone: "", amount: "" });
  const [sendingAirtime, setSendingAirtime] = useState(false);
  const [airtimeResult, setAirtimeResult] = useState<{ network: string; phone: string; amount: number } | null>(null);

  const detectNetworkClient = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("251") ? digits.slice(3) : digits.replace(/^0+/, "");
    if (local.startsWith("09") || local.startsWith("07")) return "Ethio Telecom";
    if (local.startsWith("88") || local.startsWith("89")) return "Safaricom";
    return digits.length >= 9 ? "Other" : "";
  };
  const detectedNetwork = detectNetworkClient(airtimeForm.phone);

  // Simplified rule form: payment method, account, amount
  const [ruleForm, setRuleForm] = useState({
    payoutMethod: "TELEBIRR",
    payoutDetails: "",
    amount: "",
  });
  const [savingRule, setSavingRule] = useState(false);

  // ── Order context (from Admin Orders → "Open in Rewards") ──
  const [orderContext, setOrderContext] = useState<OrderContext | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [sendingReward, setSendingReward] = useState(false);
  const [rewardSent, setRewardSent] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [rulesRes, vouchersRes, airtimeRes] = await Promise.all([
        api.get("/api/admin/rewards/rules"),
        api.get("/api/admin/airtime-vouchers"),
        api.get("/api/admin/airtime/history"),
      ]);
      setRules(rulesRes.data.rules || []);
      setVouchers(vouchersRes.data?.vouchers || []);
      setAirtimeHistory(airtimeRes.data?.transactions || []);
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

  // Load order context from ?order=<id> query param
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order");
    if (!orderId) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setLoadingOrder(true);
    }, 0);
    api
      .get("/api/admin/orders")
      .then((res) => {
        if (!active) return;
        const list: OrderContext[] = res.data?.orders || res.data || [];
        const found = list.find((o) => o.id === orderId) || null;
        setOrderContext(found);
        if (!found) setError("Linked order not found.");
      })
      .catch(() => {
        if (active) setError("Could not load linked order.");
      })
      .finally(() => {
        if (active) setLoadingOrder(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const sendOrderReward = async () => {
    if (!orderContext?.qualifiedRule) return;
    setSendingReward(true);
    setError("");
    setNotice("");
    try {
      const res = await api.post("/api/admin/rewards/dispatch", {
        rewardRuleId: orderContext.qualifiedRule.id,
        orderId: orderContext.id,
        channel: "BOTH",
      });
      if (res.data.success) {
        setRewardSent(true);
        setNotice(`Reward sent for order ${orderContext.orderNumber}.`);
      } else {
        setError(res.data.error || "Reward dispatch failed.");
      }
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || "Could not send reward.");
    } finally {
      setSendingReward(false);
    }
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    setError("");
    try {
      const amount = Number(ruleForm.amount);
      const methodLabel =
        PAYOUT_METHODS.find(([val]) => val === ruleForm.payoutMethod)?.[1] ||
        ruleForm.payoutMethod;

      await api.post("/api/admin/rewards/rules", {
        name: `${methodLabel} ${amount} ETB`,
        description: null,
        scope: "ALL_ORDERS",
        productId: null,
        triggerType: "MIN_SPEND",
        threshold: 0,
        minSpend: 0,
        rewardType: "FIXED_CASHBACK",
        rewardValue: String(amount),
        currency: "ETB",
        payoutMethod: ruleForm.payoutMethod,
        payoutDetails: ruleForm.payoutDetails.trim() || null,
        promoCode: null,
        expiresAt: null,
        active: true,
      });
      setRuleForm({ payoutMethod: "TELEBIRR", payoutDetails: "", amount: "" });
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

  const sendAirtime = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingAirtime(true);
    setError("");
    setNotice("");
    setAirtimeResult(null);
    try {
      const res = await api.post("/api/admin/airtime/send", {
        phone: airtimeForm.phone,
        amount: Number(airtimeForm.amount),
      });
      setAirtimeResult({
        network: res.data.network,
        phone: res.data.phone,
        amount: Number(res.data.amount),
      });
      setNotice(`Airtime sent to ${res.data.phone} (${res.data.network}).`);
      setAirtimeForm({ phone: "", amount: "" });
      const hist = await api.get("/api/admin/airtime/history");
      setAirtimeHistory(hist.data?.transactions || []);
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || "Could not send airtime.");
    } finally {
      setSendingAirtime(false);
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
          Manage money reward rules and airtime vouchers.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p>
      )}

      {/* Linked order context (from Admin Orders) */}
      {loadingOrder && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Loading linked order…
        </div>
      )}
      {orderContext && !loadingOrder && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Linked Order</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{orderContext.orderNumber}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {orderContext.customerName} · {orderContext.customerPhone} · {orderContext.customerEmail}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {orderContext.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")} · Total {money(Number(orderContext.total))} · {orderContext.status}
              </p>
            </div>
            {orderContext.rewardQualified && orderContext.qualifiedRule ? (
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Qualified Reward</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{orderContext.qualifiedRule.name}</p>
                <p className="text-xs text-slate-600">
                  {orderContext.qualifiedRule.rewardValue}
                  {["FIXED_CASHBACK", "MOBILE_AIRTIME"].includes(orderContext.qualifiedRule.rewardType) &&
                    ` ${orderContext.qualifiedRule.currency || "ETB"}`}
                  {orderContext.qualifiedRule.promoCode ? ` · Code: ${orderContext.qualifiedRule.promoCode}` : ""}
                  {orderContext.qualifiedRule.payoutMethod && orderContext.qualifiedRule.payoutMethod !== "AUTO" &&
                    ` · via ${orderContext.qualifiedRule.payoutMethod.replace(/_/g, " ")}`}
                </p>
                {(orderContext.rewardDispatches || []).length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Dispatched: {(orderContext.rewardDispatches || []).map((d) => `${d.channel} · ${d.status}`).join(", ")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={sendingReward || rewardSent}
                  onClick={() => void sendOrderReward()}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingReward ? "Sending…" : rewardSent ? "Reward Sent ✓" : "Send Reward (SMS + Email)"}
                </button>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                This order has no qualified reward.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTab("rules")}
          className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-[#cf5427] to-[#f47822] px-4 py-3 text-left shadow-md shadow-orange-500/20 transition hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 transition group-hover:scale-125" />
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">Reward Rules</p>
            <p className="truncate text-xs text-orange-100">
              {rules.length} rule{rules.length === 1 ? "" : "s"} — money rewards
            </p>
          </div>
          <span className="relative shrink-0 rounded-md bg-white px-3 py-1 text-xs font-bold text-[#cf5427] transition group-hover:bg-orange-50">
            Open →
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("airtime")}
          className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] px-4 py-3 text-left shadow-md shadow-sky-500/20 transition hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 transition group-hover:scale-125" />
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><path d="M12 18h.01" />
            </svg>
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">Airtime Vouchers</p>
            <p className="truncate text-xs text-sky-100">
              {vouchers.length} voucher{vouchers.length === 1 ? "" : "s"} — airtime PINs
            </p>
          </div>
          <span className="relative shrink-0 rounded-md bg-white px-3 py-1 text-xs font-bold text-[#0ea5e9] transition group-hover:bg-sky-50">
            Open →
          </span>
        </button>
      </div>

      {tab && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
          onClick={() => setTab(null)}
        >
          <div
            className="w-full max-w-6xl rounded-2xl bg-slate-50 p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                {tab === "rules" ? "Reward Rules" : "Airtime Vouchers"}
              </h2>
              <button
                type="button"
                onClick={() => setTab(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                Close
              </button>
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
                Payment method <span className="text-red-600">*</span>
                <select
                  required
                  className={inputCls}
                  value={ruleForm.payoutMethod}
                  onChange={(e) => setRuleForm({ ...ruleForm, payoutMethod: e.target.value })}
                >
                  {PAYOUT_METHODS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>

              <label className={labelCls}>
                {ruleForm.payoutMethod === "CBE"
                  ? "CBE account number"
                  : ruleForm.payoutMethod === "USD_TRANSFER"
                  ? "Bank / SWIFT details"
                  : ruleForm.payoutMethod === "OTHER"
                  ? "Payout details"
                  : "Account / phone number"}{" "}
                <span className="text-red-600">*</span>
                <input
                  required
                  className={inputCls}
                  value={ruleForm.payoutDetails}
                  onChange={(e) => setRuleForm({ ...ruleForm, payoutDetails: e.target.value })}
                  placeholder={
                    ruleForm.payoutMethod === "CBE"
                      ? "1000xxxxxxxxx"
                      : ruleForm.payoutMethod === "USD_TRANSFER"
                      ? "Bank name, account no, SWIFT"
                      : ruleForm.payoutMethod === "OTHER"
                      ? "Where/how to send the reward"
                      : "09xx xxx xxx"
                  }
                />
              </label>

              <label className={labelCls}>
                Amount (ETB) <span className="text-red-600">*</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  className={inputCls}
                  value={ruleForm.amount}
                  onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })}
                  placeholder="300"
                />
              </label>

              <button
                type="submit"
                disabled={savingRule}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60"
              >
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
                          : ` · spend ≥ ${money(Number(rule.threshold), rule.currency || "ETB")}`}
                      </>
                    ) : rule.triggerType === "MIN_QUANTITY" ? (
                      <>Any order · buy ≥ {Number(rule.threshold)} units total</>
                    ) : Number(rule.threshold ?? rule.minSpend ?? 0) > 0 ? (
                      <>Spend ≥ <strong>{money(Number(rule.threshold ?? rule.minSpend ?? 0), rule.currency || "ETB")}</strong></>
                    ) : (
                      <>Any order</>
                    )}
                    {" → "}
                    <span className="font-semibold text-[#cf5427]">
                      {rule.rewardValue}
                      {["FIXED_CASHBACK", "MOBILE_AIRTIME"].includes(rule.rewardType) && ` ${rule.currency || "ETB"}`}
                    </span>
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {rule.rewardType}
                    </span>
                    {rule.payoutMethod && rule.payoutMethod !== "AUTO" && (
                      <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {rule.payoutMethod.replace(/_/g, " ")}
                      </span>
                    )}
                    {rule.payoutDetails && (
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {rule.payoutDetails}
                      </span>
                    )}
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

      {tab === "airtime" && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="h-fit space-y-4">
          <form onSubmit={sendAirtime}
            className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Send Real Airtime</h2>
            <p className="mt-1 text-xs text-slate-500">
              Top up Ethio Telecom or Safaricom directly to a phone number via Africas Talking.
            </p>
            <div className="mt-4 space-y-3">
              <label className={labelCls}>
                Phone number <span className="text-red-600">*</span>
                <input required type="tel" className={inputCls}
                  value={airtimeForm.phone}
                  onChange={(e) => setAirtimeForm({ ...airtimeForm, phone: e.target.value })}
                  placeholder="0911 234 567" />
              </label>
              {detectedNetwork && (
                <p className="text-xs font-semibold text-sky-700">
                  Detected network: <span className="rounded-full bg-sky-100 px-2 py-0.5">{detectedNetwork}</span>
                </p>
              )}
              <label className={labelCls}>
                Amount (ETB) <span className="text-red-600">*</span>
                <input required type="number" min="1" step="0.01" className={inputCls}
                  value={airtimeForm.amount}
                  onChange={(e) => setAirtimeForm({ ...airtimeForm, amount: e.target.value })}
                  placeholder="e.g. 50" />
              </label>
              {airtimeResult && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                  Sent {money(airtimeResult.amount)} to {airtimeResult.phone} ({airtimeResult.network})
                </p>
              )}
              <button type="submit" disabled={sendingAirtime}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0ea5e9] text-sm font-extrabold text-white transition hover:bg-[#0284c7] disabled:opacity-60">
                {sendingAirtime ? "Sending…" : "Send Airtime"}
              </button>
            </div>
          </form>

          <form onSubmit={addVouchers}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-700 text-sm font-extrabold text-white transition hover:bg-slate-900 disabled:opacity-60">
                {savingVouchers ? "Adding…" : "Add Vouchers"}
              </button>
            </div>
          </form>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Top-up History</h3>
            </div>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Network</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {airtimeHistory.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No airtime sent yet.
                  </td></tr>
                )}
                {airtimeHistory.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{t.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{t.network || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-[#9c3d1a]">{money(Number(t.amount))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        t.status === "SENT"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {t.status}
                      </span>
                      {t.error && <p className="mt-1 max-w-[200px] truncate text-xs text-red-500" title={t.error}>{t.error}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
        </div>
      )}
    </div>
  );
}