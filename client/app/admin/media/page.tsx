"use client";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
type Tab = "news" | "videos" | "articles" | "newsletter" | "issues";
type FormState = Record<string, string | number>;
interface NewsItem { id: string; date: string; company: string; headline: string; summary: string | null; url: string | null }
interface VideoRelease { id: string; series: string; episodeNumber: number | null; title: string; summary: string | null; url: string; publishedAt: string }
interface PopularArticle { id: string; title: string; url: string; period: string; rank: number; publishedAt: string | null }
interface Subscriber { id: string; firstName: string; lastName: string; email: string; types: string; status: string; createdAt: string }
interface NewsletterIssue {
  id: string; subject: string; previewText: string | null; body: string; status: string;
  publishedAt: string; sentCount: number; createdAt: string;
}
type Editable = NewsItem | VideoRelease | PopularArticle | NewsletterIssue;
type Field = {
  key: string; label: string; type?: "date" | "number" | "area" | "select"; required?: boolean; ph?: string;
  def?: string; rows?: number; max?: number; blue?: boolean; opts?: [string, string][];
};
type Cfg = { title: string; path: string; fields: Field[]; payload: (f: FormState) => object; ok?: string; fail?: string };
type Col<T> = [header: string, tdClass: string, render: (item: T) => ReactNode];
const BASE = "/api/admin/media";
const inputCls =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20";
const areaCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none";
const filterCls = "h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427]";
const orangeBtn = "bg-[#cf5427] hover:bg-[#9c3d1a]";
const blueBtn = "bg-[#1d4ed8] hover:bg-[#1e40af]";
const ACTIVE_BADGE = "bg-green-100 text-green-700";
const errMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const fmtDate = (s: string) => new Date(s).toLocaleDateString();
const Badge = ({ cls, children }: { cls: string; children: ReactNode }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>
);

// Form fields + payload builder for each editable tab
const cfg: Record<"news" | "videos" | "articles" | "issues", Cfg> = {
  news: {
    title: "News", path: "news",
    fields: [
      { key: "date", label: "Date", type: "date", required: true }, { key: "company", label: "Company", required: true },
      { key: "headline", label: "Headline", required: true }, { key: "summary", label: "Summary", type: "area", rows: 3 },
      { key: "url", label: "URL (optional)", ph: "https://…" },
    ],
    payload: (f) => ({ date: f.date || undefined, company: f.company, headline: f.headline, summary: f.summary || null, url: f.url || null }),
  },
  videos: {
    title: "Video", path: "videos",
    fields: [
      { key: "series", label: "Series", required: true }, { key: "episodeNumber", label: "Episode #", type: "number" },
      { key: "title", label: "Title", required: true }, { key: "summary", label: "Summary", type: "area", rows: 3 },
      { key: "url", label: "URL", required: true, ph: "https://…" }, { key: "publishedAt", label: "Publish date", type: "date" },
    ],
    payload: (f) => ({
      series: f.series, episodeNumber: f.episodeNumber === "" ? null : Number(f.episodeNumber),
      title: f.title, summary: f.summary || null, url: f.url, publishedAt: f.publishedAt || undefined,
    }),
  },
  articles: {
    title: "Article", path: "popular-articles",
    fields: [
      { key: "title", label: "Title", required: true }, { key: "url", label: "URL", required: true, ph: "/articles/slug or https://…" },
      { key: "period", label: "Period", type: "select", def: "LAST_7_DAYS", opts: [["LAST_7_DAYS", "Last 7 Days"], ["LAST_30_DAYS", "Last 30 Days"]] },
      { key: "rank", label: "Rank", type: "number" }, { key: "publishedAt", label: "Published date", type: "date" },
    ],
    payload: (f) => ({ title: f.title, url: f.url, period: f.period, rank: f.rank === "" ? 0 : Number(f.rank), publishedAt: f.publishedAt || null }),
  },
  issues: {
    title: "Issue", path: "newsletter/issues", ok: "Issue saved.", fail: "Failed to save issue.",
    fields: [
      { key: "subject", label: "Subject", required: true, max: 300, ph: "This week in media…" },
      { key: "previewText", label: "Preview text (optional)", ph: "Short teaser shown above the subject" },
      { key: "body", label: "Body", type: "area", required: true, rows: 10, blue: true, ph: "Write the newsletter body here.\n\nSeparate paragraphs with a blank line." },
      { key: "publishedAt", label: "Publish date", type: "date" },
    ],
    payload: (f) => ({ subject: f.subject, previewText: f.previewText || null, body: f.body, publishedAt: f.publishedAt || undefined }),
  },
};
const cfgOf = (t: Tab) => cfg[t === "newsletter" ? "articles" : t];

// Table columns: [header, td classes, cell renderer]
const trunc = "max-w-[280px] truncate text-slate-600";
const newsCols: Col<NewsItem>[] = [
  ["Date", "whitespace-nowrap text-slate-500", (i) => fmtDate(i.date)],
  ["Company", "font-semibold text-slate-800", (i) => i.company],
  ["Headline", trunc, (i) => i.headline],
];
const videoCols: Col<VideoRelease>[] = [
  ["Series", "font-semibold text-slate-800", (i) => i.series],
  ["Ep.", "text-slate-600", (i) => i.episodeNumber ?? "—"],
  ["Title", trunc, (i) => i.title],
  ["Published", "whitespace-nowrap text-slate-500", (i) => fmtDate(i.publishedAt)],
];
const articleCols: Col<PopularArticle>[] = [
  ["Rank", "text-slate-600", (i) => i.rank],
  ["Title", "max-w-[280px] truncate font-semibold text-slate-800", (i) => i.title],
  ["Period", "text-slate-600", (i) => (i.period === "LAST_7_DAYS" ? "7 Days" : "30 Days")],
  ["URL", "max-w-[200px] truncate text-xs text-slate-500", (i) => i.url],
];
const issueCols: Col<NewsletterIssue>[] = [
  ["Subject", "max-w-[260px]", (i) => <p className="truncate font-semibold text-slate-800">{i.subject}</p>],
  ["Preview", "max-w-[220px] truncate text-slate-500", (i) => i.previewText || "—"],
  ["Status", "", (i) => <Badge cls={i.status === "SENT" ? ACTIVE_BADGE : "bg-amber-100 text-amber-700"}>{i.status}</Badge>],
  ["Published", "whitespace-nowrap text-xs text-slate-500", (i) => fmtDate(i.publishedAt)],
  ["Sent", "text-xs text-slate-500", (i) => i.sentCount],
];
const subscriberCols: Col<Subscriber>[] = [
  ["Name", "font-semibold text-slate-800", (s) => `${s.firstName} ${s.lastName}`],
  ["Email", "text-slate-600", (s) => s.email],
  ["Types", "text-slate-600", (s) => s.types],
  ["Status", "", (s) => <Badge cls={s.status === "ACTIVE" ? ACTIVE_BADGE : "bg-slate-200 text-slate-600"}>{s.status}</Badge>],
  ["Subscribed", "text-xs text-slate-500", (s) => fmtDate(s.createdAt)],
];
const blankForm = (fields: Field[]): FormState => Object.fromEntries(fields.map((f) => [f.key, f.def ?? ""]));

// Edit-form values from an existing record (dates trimmed to yyyy-mm-dd)
const formFrom = (fields: Field[], item: object): FormState =>
  Object.fromEntries(
    fields.map((f) => {
      const v = (item as Record<string, unknown>)[f.key];
      if (v == null || v === "") return [f.key, f.def ?? ""];
      return [f.key, f.type === "date" ? String(v).slice(0, 10) : (v as string | number)];
    })
  );

function Fields({ fields, form, setForm }: { fields: Field[]; form: FormState; setForm: (f: FormState) => void }) {
  return (
    <>
      {fields.map((f) => {
        const common = {
          required: f.required, maxLength: f.max, placeholder: f.ph, value: form[f.key] ?? f.def ?? "",
          onChange: (e: { target: { value: string } }) => setForm({ ...form, [f.key]: e.target.value }),
        };
        return (
          <label key={f.key} className="block text-sm font-semibold text-slate-700">
            {f.label}
            {f.type === "area" ? (
              <textarea {...common} rows={f.rows} className={`${areaCls} ${f.blue ? "focus:border-[#1d4ed8]" : "focus:border-[#cf5427]"}`} />
            ) : f.type === "select" ? (
              <select {...common} className={inputCls}>
                {f.opts?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <input {...common} type={f.type} className={inputCls} />
            )}
          </label>
        );
      })}
    </>
  );
}

// Backdrop + card + form with a submit button
function FormModal({ onClose, onSubmit, cls, btnCls, title, sub, busy, label, children }: {
  onClose: () => void; onSubmit: (e: FormEvent) => void; cls: string; btnCls: string; title: string;
  sub?: string; busy: boolean; label: string; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`w-full rounded-2xl bg-white p-6 shadow-xl ${cls}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div><h3 className="text-lg font-bold text-slate-900">{title}</h3>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {children}
          <button type="submit" disabled={busy} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white transition disabled:opacity-60 ${btnCls}`}>
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            {busy ? "Saving…" : label}
          </button>
          {sub && (
            <p className="text-center text-xs text-slate-500">
              After saving, click <strong>Publish</strong> in the list to email all active subscribers.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function DataTable<T extends { id: string }>({ cols, items, min, span, empty, actions }: {
  cols: Col<T>[]; items: T[]; min: number; span: number; empty: string; actions: (item: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {cols.map(([h]) => <th key={h} className="px-4 py-3">{h}</th>)}<th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={span} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr>}
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 last:border-0">
              {cols.map(([h, cls, render]) => <td key={h} className={`px-4 py-3 ${cls}`}>{render(item)}</td>)}
              <td className="px-4 py-3 text-right">{actions(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  const tone = danger ? "hover:bg-red-50 hover:text-red-600" : "mr-1 hover:bg-slate-100 hover:text-slate-700";
  return <button onClick={onClick} className={`rounded-lg p-1.5 text-slate-400 ${tone}`}>{children}</button>;
}

export default function AdminMediaPage() {
  const [tab, setTab] = useState<Tab>("news");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [videos, setVideos] = useState<VideoRelease[]>([]);
  const [articles, setArticles] = useState<PopularArticle[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [nlFilter, setNlFilter] = useState(""), [nlStatus, setNlStatus] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // Shared create/edit modal state (news, videos, articles and newsletter issues)
  const [editing, setEditing] = useState<Editable | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const get = (path: string, params?: object) => api.get(`${BASE}/${path}`, { params }).then((r) => r.data?.items || []);
      const [n, v, a, s, i] = await Promise.all([
        get("news"), get("videos"), get("popular-articles"),
        get("newsletter", { type: nlFilter || undefined, status: nlStatus || undefined }),
        get("newsletter/issues"),
      ]);
      setNews(n); setVideos(v); setArticles(a); setSubscribers(s); setIssues(i);
    } catch {
      setError("Failed to load media data.");
    } finally {
      setLoading(false);
    }
  }, [nlFilter, nlStatus]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const closeForm = () => { setEditing(null); setForm({}); };
  const openCreate = () => { setEditing(null); setForm(blankForm(cfgOf(tab).fields)); };
  const openEdit = (item: Editable) => { setEditing(item); setForm(formFrom(cfgOf(tab).fields, item)); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const c = cfgOf(tab);
    setSaving(true); setError("");
    try {
      const path = `${BASE}/${c.path}`;
      if (editing) await api.put(`${path}/${editing.id}`, c.payload(form));
      else await api.post(path, c.payload(form));
      closeForm();
      setNotice(c.ok || "Saved successfully.");
      await load();
    } catch (err) {
      setError(errMsg(err, c.fail || "Failed to save."));
    } finally {
      setSaving(false);
    }
  };
  // Run a request, refresh the lists, report a fixed message on failure
  const act = async (request: () => Promise<unknown>, failMessage: string) => {
    try { await request(); await load(); } catch { setError(failMessage); }
  };
  const remove = (path: string, id: string, message = "Delete this item?", fail = "Failed to delete.") =>
    confirm(message) && act(() => api.delete(`${BASE}/${path}/${id}`), fail);
  const toggleSubscriber = (s: Subscriber) =>
    act(() => api.put(`${BASE}/newsletter/${s.id}/status`, { status: s.status === "ACTIVE" ? "UNSUBSCRIBED" : "ACTIVE" }), "Failed to update subscriber.");
  const publishIssue = async (item: NewsletterIssue) => {
    if (!confirm(`Publish "${item.subject}" and email all active subscribers?`)) return;
    setPublishingId(item.id); setError("");
    try {
      const res = await api.post(`${BASE}/newsletter/issues/${item.id}/publish`);
      const d = res.data?.delivery;
      setNotice(d ? `Published! Sent to ${d.sent} of ${d.total} subscribers${d.failed ? ` (${d.failed} failed)` : ""}.` : "Published.");
      await load();
    } catch (err) {
      setError(errMsg(err, "Failed to publish issue."));
    } finally {
      setPublishingId(null);
    }
  };
  const tabs: [Tab, string, number][] = [
    ["news", "News", news.length], ["videos", "Videos", videos.length], ["articles", "Popular Articles", articles.length],
    ["newsletter", "Subscribers", subscribers.length], ["issues", "Edit Smarter Issues", issues.length],
  ];
  // Edit + delete buttons for news / videos / articles rows
 const rowActions = (path: string) => {
  const RowActions = (item: Editable) => (
    <>
      <IconBtn onClick={() => openEdit(item)}><Pencil size={15} /></IconBtn>
      <IconBtn danger onClick={() => remove(path, item.id)}><Trash2 size={15} /></IconBtn>
    </>
  );
  RowActions.displayName = "RowActions";
  return RowActions;
};
  const emptyMain = 'Nothing here yet — click "Add New".';
  const mainProps = { min: 720, span: 5, empty: emptyMain };
  const showForm = tab !== "newsletter" && (editing || ["company", "series", "period", "subject"].some((k) => form?.[k] !== undefined));
  const isIssue = tab === "issues";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media &amp; News</h1>
          <p className="mt-1 text-sm text-gray-500">Manage news, video releases, popular articles, and newsletter subscribers. Changes appear on the public pages immediately.</p>
        </div>
        {tab !== "newsletter" && (
          <button type="button" onClick={openCreate} className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition ${orangeBtn}`}>
            <Plus size={16} /> Add New
          </button>
        )}
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" onClick={() => { setTab(key); closeForm(); }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === key ? "bg-[#cf5427] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {label} ({count})
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-[#cf5427]" /></div>
      ) : tab === "issues" ? (
        <DataTable
          cols={issueCols} items={issues} min={720} span={6} empty="No issues yet — click Add New to compose."
          actions={(item) => (
            <>
              {item.status !== "SENT" && (
                <>
                  <button onClick={() => publishIssue(item)} disabled={publishingId === item.id}
                    className={`mr-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-60 ${blueBtn}`}>
                    {publishingId === item.id ? "Publishing…" : "Publish"}
                  </button>
                  <IconBtn onClick={() => openEdit(item)}><Pencil size={15} /></IconBtn>
                </>
              )}
              <IconBtn danger onClick={() => remove(cfg.issues.path, item.id, "Delete this newsletter issue?", "Failed to delete issue.")}><Trash2 size={15} /></IconBtn>
            </>
          )}
        />
      ) : tab === "newsletter" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input value={nlFilter} onChange={(e) => setNlFilter(e.target.value)} placeholder="Filter by type (news, videos…)" className={`${filterCls} w-56`} />
            <select value={nlStatus} onChange={(e) => setNlStatus(e.target.value)} className={filterCls}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNSUBSCRIBED">Unsubscribed</option>
            </select>
          </div>
          <DataTable
            cols={subscriberCols} items={subscribers} min={640} span={6} empty="No subscribers yet."
            actions={(s) => (
              <>
                <button onClick={() => toggleSubscriber(s)} className="mr-2 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{s.status === "ACTIVE" ? "Unsubscribe" : "Reactivate"}</button>
                <IconBtn danger onClick={() => remove("newsletter", s.id)}><Trash2 size={15} /></IconBtn>
              </>
            )}
          />
        </div>
      ) : tab === "videos" ? (
        <DataTable cols={videoCols} items={videos} actions={rowActions(cfg.videos.path)} {...mainProps} />
      ) : tab === "articles" ? (
        <DataTable cols={articleCols} items={articles} actions={rowActions(cfg.articles.path)} {...mainProps} />
      ) : (
        <DataTable cols={newsCols} items={news} actions={rowActions(cfg.news.path)} {...mainProps} />
      )}
      {/* Create/edit modal (also used to compose newsletter issues) */}
      {showForm && (
        <FormModal
          onClose={closeForm}
          onSubmit={save}
          busy={saving}
          cls={isIssue ? "max-h-[90vh] max-w-2xl overflow-y-auto" : "max-w-lg"}
          btnCls={isIssue ? blueBtn : orangeBtn}
          title={isIssue ? (editing ? "Edit Issue" : "Compose Edit Smarter Issue") : `${editing ? "Edit" : "Add"} ${cfgOf(tab).title}`}
          sub={isIssue ? "Blue branded header is added automatically when sent." : undefined}
          label={isIssue ? (editing ? "Update Draft" : "Save Draft") : editing ? "Update" : "Create"}
        >
          <Fields fields={cfgOf(tab).fields} form={form} setForm={setForm} />
        </FormModal>
      )}
    </div>
  );
}