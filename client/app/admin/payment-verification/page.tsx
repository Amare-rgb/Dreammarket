"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface TicketMessage {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  transactionRef: string;
  receiptUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    total: number;
    paymentStatus: string | null;
    customerName: string;
    customerEmail: string;
  };
  user: { name: string; email: string };
  _count?: { messages: number };
  messages?: TicketMessage[];
}

const money = (n: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(n);

export default function AdminPaymentVerificationPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/admin/payments/verification-requests", {
        params: filter ? { status: filter } : {},
      });
      if (res.data?.success) setTickets(res.data.requests || []);
    } catch {
      setError("Failed to load verification requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openTicket = async (ticket: Ticket) => {
    try {
      const res = await api.get(
        `/api/payments/verification-requests/${ticket.id}`
      );
      if (res.data?.success) setSelected(res.data.request);
    } catch {
      setSelected(ticket);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    try {
      await api.post(
        `/api/admin/payments/verification-requests/${selected.id}/messages`,
        { body: reply.trim() }
      );
      setReply("");
      const res = await api.get(
        `/api/payments/verification-requests/${selected.id}`
      );
      if (res.data?.success) setSelected(res.data.request);
    } finally {
      setSending(false);
    }
  };

  const resolve = async (status: "APPROVED" | "REJECTED") => {
    if (!selected || resolving) return;
    setResolving(true);
    try {
      await api.patch(
        `/api/admin/payments/verification-requests/${selected.id}`,
        { status, adminNote: adminNote.trim() || undefined }
      );
      const res = await api.get(
        `/api/payments/verification-requests/${selected.id}`
      );
      if (res.data?.success) setSelected(res.data.request);
      await load();
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Payment Verification Requests
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review escalated payment checks, chat with customers, and approve or
          reject manually.
        </p>
      </div>

      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", ""].map((s) => (
          <button
            key={s || "ALL"}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              filter === s
                ? "bg-[#cf5427] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Ticket list */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoaderCircle className="h-8 w-8 animate-spin text-[#cf5427]" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              No {filter ? filter.toLowerCase() : ""} verification requests.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTicket(t)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${
                      selected?.id === t.id ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">
                        {t.order.orderNumber}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : t.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {t.user.name} · ref{" "}
                      <span className="font-mono">{t.transactionRef}</span> ·{" "}
                      {money(Number(t.order.total))}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {new Date(t.createdAt).toLocaleString()}
                      {t._count ? ` · ${t._count.messages} messages` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail + chat */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              Select a request to review.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Order {selected.order.orderNumber}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selected.user.name} ({selected.user.email}) ·{" "}
                    {selected.order.customerName} ·{" "}
                    {money(Number(selected.order.total))}
                  </p>
                  <p className="mt-1 text-xs">
                    Ref:{" "}
                    <span className="font-mono font-semibold">
                      {selected.transactionRef}
                    </span>{" "}
                    · Order payment:{" "}
                    <span className="font-semibold">
                      {selected.order.paymentStatus || "UNVERIFIED"}
                    </span>
                  </p>
                  {selected.receiptUrl && (
                    <a
                      href={selected.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-[#cf5427] underline"
                    >
                      View receipt
                    </a>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    selected.status === "PENDING"
                      ? "bg-amber-100 text-amber-800"
                      : selected.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              {/* Messages */}
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
                {(selected.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      m.senderRole === "ADMIN"
                        ? "ml-8 bg-[#1d4ed8]/10 border border-[#1d4ed8]/20"
                        : m.senderRole === "SYSTEM"
                        ? "bg-white border border-gray-200 text-gray-500 text-xs"
                        : "mr-8 bg-[#EB6D3D]/15"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {m.senderRole === "USER"
                        ? "Customer"
                        : m.senderRole === "ADMIN"
                        ? "You (Admin)"
                        : "System"}
                    </p>
                    {m.body}
                  </div>
                ))}
              </div>

              {/* Reply */}
              {selected.status === "PENDING" && (
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !sending) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                    placeholder="Reply to customer…"
                    maxLength={2000}
                    className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#EB6D3D]"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={sending || !reply.trim()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1d4ed8] px-4 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Send size={14} /> Send
                  </button>
                </div>
              )}

              {/* Resolve */}
              {selected.status === "PENDING" && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <input
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Admin note (optional)"
                    maxLength={2000}
                    className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#EB6D3D]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void resolve("APPROVED")}
                      disabled={resolving}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} /> Approve & Mark PAID
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolve("REJECTED")}
                      disabled={resolving}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                  <p className="flex items-center gap-1 text-[11px] text-gray-400">
                    <MessageSquare size={11} />
                    Approving marks the order PAID and credits any affiliate
                    commission.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
