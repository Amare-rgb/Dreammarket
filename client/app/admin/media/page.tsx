"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

type Tab = "news" | "videos" | "articles" | "newsletter" | "issues";

interface NewsItem {
  id: string;
  date: string;
  company: string;
  headline: string;
  summary: string | null;
  url: string | null;
}
interface VideoRelease {
  id: string;
  series: string;
  episodeNumber: number | null;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;
}
interface PopularArticle {
  id: string;
  title: string;
  url: string;
  period: string;
  rank: number;
  publishedAt: string | null;
}
interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  types: string;
  status: string;
  createdAt: string;
}
interface NewsletterIssue {
  id: string;
  subject: string;
  previewText: string | null;
  body: string;
  status: string;
  publishedAt: string;
  sentCount: number;
  createdAt: string;
}

const inputCls =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20";
const labelCls = "block text-sm font-semibold text-slate-700";

const emptyNews = { date: "", company: "", headline: "", summary: "", url: "" };
const emptyVideo = { series: "", episodeNumber: "", title: "", summary: "", url: "", publishedAt: "" };
const emptyArticle = { title: "", url: "", period: "LAST_7_DAYS", rank: "", publishedAt: "" };
const emptyIssue = { subject: "", previewText: "", body: "", publishedAt: "" };

export default function AdminMediaPage() {
  const [tab, setTab] = useState<Tab>("news");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [news, setNews] = useState<NewsItem[]>([]);
  const [videos, setVideos] = useState<VideoRelease[]>([]);
  const [articles, setArticles] = useState<PopularArticle[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [nlFilter, setNlFilter] = useState("");
  const [nlStatus, setNlStatus] = useState("");

  // Newsletter issues (Edit Smarter editions)
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueEditing, setIssueEditing] = useState<NewsletterIssue | null>(null);
  const [issueForm, setIssueForm] = useState<Record<string, string>>({ ...emptyIssue });
  const [issueSaving, setIssueSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Modal form state
  const [editing, setEditing] = useState<NewsItem | VideoRelease | PopularArticle | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [n, v, a, s, i] = await Promise.all([
        api.get("/api/admin/media/news"),
        api.get("/api/admin/media/videos"),
        api.get("/api/admin/media/popular-articles"),
        api.get("/api/admin/media/newsletter", {
          params: { type: nlFilter || undefined, status: nlStatus || undefined },
        }),
        api.get("/api/admin/media/newsletter/issues"),
      ]);
      setNews(n.data?.items || []);
      setVideos(v.data?.items || []);
      setArticles(a.data?.items || []);
      setSubscribers(s.data?.items || []);
      setIssues(i.data?.items || []);
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

  const openCreate = () => {
    setEditing(null);
    setForm(
      tab === "news" ? { ...emptyNews } :
      tab === "videos" ? { ...emptyVideo } :
      { ...emptyArticle }
    );
  };

  const openEdit = (item: NewsItem | VideoRelease | PopularArticle) => {
    setEditing(item);
    if (tab === "news") {
      const n = item as NewsItem;
      setForm({
        date: n.date ? n.date.slice(0, 10) : "",
        company: n.company || "",
        headline: n.headline || "",
        summary: n.summary || "",
        url: n.url || "",
      });
    } else if (tab === "videos") {
      const v = item as VideoRelease;
      setForm({
        series: v.series || "",
        episodeNumber: v.episodeNumber ?? "",
        title: v.title || "",
        summary: v.summary || "",
        url: v.url || "",
        publishedAt: v.publishedAt ? v.publishedAt.slice(0, 10) : "",
      });
    } else {
      const a = item as PopularArticle;
      setForm({
        title: a.title || "",
        url: a.url || "",
        period: a.period || "LAST_7_DAYS",
        rank: a.rank ?? "",
        publishedAt: a.publishedAt ? a.publishedAt.slice(0, 10) : "",
      });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const base = "/api/admin/media";
      if (tab === "news") {
        const payload = {
          date: form.date || undefined,
          company: form.company,
          headline: form.headline,
          summary: form.summary || null,
          url: form.url || null,
        };
        if (editing) await api.put(`${base}/news/${editing.id}`, payload);
        else await api.post(`${base}/news`, payload);
      } else if (tab === "videos") {
        const payload = {
          series: form.series,
          episodeNumber: form.episodeNumber === "" ? null : Number(form.episodeNumber),
          title: form.title,
          summary: form.summary || null,
          url: form.url,
          publishedAt: form.publishedAt || undefined,
        };
        if (editing) await api.put(`${base}/videos/${editing.id}`, payload);
        else await api.post(`${base}/videos`, payload);
      } else {
        const payload = {
          title: form.title,
          url: form.url,
          period: form.period,
          rank: form.rank === "" ? 0 : Number(form.rank),
          publishedAt: form.publishedAt || null,
        };
        if (editing) await api.put(`${base}/popular-articles/${editing.id}`, payload);
        else await api.post(`${base}/popular-articles`, payload);
      }
      setEditing(null);
      setForm({});
      setNotice("Saved successfully.");
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: Tab, id: string) => {
    if (!confirm("Delete this item?")) return;
    try {
      const path =
        kind === "news" ? `/api/admin/media/news/${id}` :
        kind === "videos" ? `/api/admin/media/videos/${id}` :
        kind === "articles" ? `/api/admin/media/popular-articles/${id}` :
        `/api/admin/media/newsletter/${id}`;
      if (kind === "newsletter") {
        await api.delete(path);
      } else {
        await api.delete(path);
      }
      await load();
    } catch {
      setError("Failed to delete.");
    }
  };

  const toggleSubscriber = async (s: Subscriber) => {
    const status = s.status === "ACTIVE" ? "UNSUBSCRIBED" : "ACTIVE";
    try {
      await api.put(`/api/admin/media/newsletter/${s.id}/status`, { status });
      await load();
    } catch {
      setError("Failed to update subscriber.");
    }
  };

  const openIssueCreate = () => {
    setIssueEditing(null);
    setIssueForm({ ...emptyIssue });
    setIssueModalOpen(true);
  };

  const openIssueEdit = (item: NewsletterIssue) => {
    setIssueEditing(item);
    setIssueForm({
      subject: item.subject || "",
      previewText: item.previewText || "",
      body: item.body || "",
      publishedAt: item.publishedAt ? item.publishedAt.slice(0, 10) : "",
    });
    setIssueModalOpen(true);
  };

  const saveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueSaving(true);
    setError("");
    try {
      const payload = {
        subject: issueForm.subject,
        previewText: issueForm.previewText || null,
        body: issueForm.body,
        publishedAt: issueForm.publishedAt || undefined,
      };
      if (issueEditing) {
        await api.put(`/api/admin/media/newsletter/issues/${issueEditing.id}`, payload);
      } else {
        await api.post("/api/admin/media/newsletter/issues", payload);
      }
      setIssueModalOpen(false);
      setIssueEditing(null);
      setIssueForm({ ...emptyIssue });
      setNotice("Issue saved.");
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || "Failed to save issue.");
    } finally {
      setIssueSaving(false);
    }
  };

  const publishIssue = async (item: NewsletterIssue) => {
    if (!confirm(`Publish "${item.subject}" and email all active subscribers?`)) return;
    setPublishingId(item.id);
    setError("");
    try {
      const res = await api.post(`/api/admin/media/newsletter/issues/${item.id}/publish`);
      const d = res.data?.delivery;
      setNotice(
        d
          ? `Published! Sent to ${d.sent} of ${d.total} subscribers${d.failed ? ` (${d.failed} failed)` : ""}.`
          : "Published."
      );
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || "Failed to publish issue.");
    } finally {
      setPublishingId(null);
    }
  };

  const removeIssue = async (id: string) => {
    if (!confirm("Delete this newsletter issue?")) return;
    try {
      await api.delete(`/api/admin/media/newsletter/issues/${id}`);
      await load();
    } catch {
      setError("Failed to delete issue.");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "news", label: `News (${news.length})` },
    { key: "videos", label: `Videos (${videos.length})` },
    { key: "articles", label: `Popular Articles (${articles.length})` },
    { key: "newsletter", label: `Subscribers (${subscribers.length})` },
    { key: "issues", label: `Edit Smarter Issues (${issues.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media &amp; News</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage news, video releases, popular articles, and newsletter subscribers.
            Changes appear on the public pages immediately.
          </p>
        </div>
        {tab !== "newsletter" && (
          <button
            type="button"
            onClick={tab === "issues" ? openIssueCreate : openCreate}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#cf5427] px-4 text-sm font-bold text-white transition hover:bg-[#9c3d1a]"
          >
            <Plus size={16} /> Add New
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setEditing(null); setForm({}); }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === t.key
                ? "bg-[#cf5427] text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-[#cf5427]" />
        </div>
      ) : tab === "issues" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No issues yet — click Add New to compose.</td></tr>
              )}
              {issues.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 max-w-[260px]">
                    <p className="truncate font-semibold text-slate-800">{item.subject}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[220px] truncate text-slate-500">{item.previewText || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "SENT" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {new Date(item.publishedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.sentCount}</td>
                  <td className="px-4 py-3 text-right">
                    {item.status !== "SENT" && (
                      <button
                        onClick={() => publishIssue(item)}
                        disabled={publishingId === item.id}
                        className="mr-2 rounded-lg bg-[#1d4ed8] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
                      >
                        {publishingId === item.id ? "Publishing…" : "Publish"}
                      </button>
                    )}
                    {item.status !== "SENT" && (
                      <button onClick={() => openIssueEdit(item)} className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                    )}
                    <button onClick={() => removeIssue(item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "newsletter" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              value={nlFilter}
              onChange={(e) => setNlFilter(e.target.value)}
              placeholder="Filter by type (news, videos…)"
              className="h-10 w-56 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427]"
            />
            <select
              value={nlStatus}
              onChange={(e) => setNlStatus(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427]"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNSUBSCRIBED">Unsubscribed</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Types</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Subscribed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No subscribers yet.</td></tr>
                )}
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-slate-600">{s.email}</td>
                    <td className="px-4 py-3 text-slate-600">{s.types}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleSubscriber(s)}
                        className="mr-2 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
                        {s.status === "ACTIVE" ? "Unsubscribe" : "Reactivate"}
                      </button>
                      <button onClick={() => remove("newsletter", s.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                {tab === "news" && (<>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Headline</th>
                </>)}
                {tab === "videos" && (<>
                  <th className="px-4 py-3">Series</th>
                  <th className="px-4 py-3">Ep.</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Published</th>
                </>)}
                {tab === "articles" && (<>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">URL</th>
                </>)}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tab === "news" && news.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.company}</td>
                  <td className="px-4 py-3 max-w-[280px] truncate text-slate-600">{item.headline}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                    <button onClick={() => remove("news", item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {tab === "videos" && videos.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.series}</td>
                  <td className="px-4 py-3 text-slate-600">{item.episodeNumber ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[280px] truncate text-slate-600">{item.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                    <button onClick={() => remove("videos", item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {tab === "articles" && articles.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{item.rank}</td>
                  <td className="px-4 py-3 max-w-[280px] truncate font-semibold text-slate-800">{item.title}</td>
                  <td className="px-4 py-3 text-slate-600">{item.period === "LAST_7_DAYS" ? "7 Days" : "30 Days"}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-xs text-slate-500">{item.url}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                    <button onClick={() => remove("articles", item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {(tab === "news" && news.length === 0) ||
               (tab === "videos" && videos.length === 0) ||
               (tab === "articles" && articles.length === 0) ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{'Nothing here yet — click "Add New".'}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {tab !== "newsletter" && (editing || form?.company !== undefined || form?.series !== undefined || form?.period !== undefined) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEditing(null); setForm({}); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? "Edit" : "Add"} {tab === "news" ? "News" : tab === "videos" ? "Video" : "Article"}
              </h3>
              <button onClick={() => { setEditing(null); setForm({}); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              {tab === "news" && (<>
                <label className={labelCls}>Date<input type="date" required className={inputCls} value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                <label className={labelCls}>Company<input required className={inputCls} value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
                <label className={labelCls}>Headline<input required className={inputCls} value={form.headline || ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></label>
                <label className={labelCls}>Summary<textarea rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cf5427]" value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
                <label className={labelCls}>URL (optional)<input className={inputCls} value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
              </>)}
              {tab === "videos" && (<>
                <label className={labelCls}>Series<input required className={inputCls} value={form.series || ""} onChange={(e) => setForm({ ...form, series: e.target.value })} /></label>
                <label className={labelCls}>Episode #<input type="number" className={inputCls} value={form.episodeNumber ?? ""} onChange={(e) => setForm({ ...form, episodeNumber: e.target.value })} /></label>
                <label className={labelCls}>Title<input required className={inputCls} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label className={labelCls}>Summary<textarea rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cf5427]" value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
                <label className={labelCls}>URL<input required className={inputCls} value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
                <label className={labelCls}>Publish date<input type="date" className={inputCls} value={form.publishedAt || ""} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} /></label>
              </>)}
              {tab === "articles" && (<>
                <label className={labelCls}>Title<input required className={inputCls} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label className={labelCls}>URL<input required className={inputCls} value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="/articles/slug or https://…" /></label>
                <label className={labelCls}>Period
                  <select className={inputCls} value={form.period || "LAST_7_DAYS"} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                  </select>
                </label>
                <label className={labelCls}>Rank<input type="number" className={inputCls} value={form.rank ?? ""} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></label>
                <label className={labelCls}>Published date<input type="date" className={inputCls} value={form.publishedAt || ""} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} /></label>
              </>)}
              <button type="submit" disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Newsletter issue compose modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setIssueModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {issueEditing ? "Edit Issue" : "Compose Edit Smarter Issue"}
                </h3>
                <p className="text-xs text-slate-500">Blue branded header is added automatically when sent.</p>
              </div>
              <button onClick={() => setIssueModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={saveIssue} className="space-y-3">
              <label className={labelCls}>Subject<input required maxLength={300} className={inputCls} value={issueForm.subject} onChange={(e) => setIssueForm({ ...issueForm, subject: e.target.value })} placeholder="This week in media…" /></label>
              <label className={labelCls}>Preview text (optional)<input className={inputCls} value={issueForm.previewText} onChange={(e) => setIssueForm({ ...issueForm, previewText: e.target.value })} placeholder="Short teaser shown above the subject" /></label>
              <label className={labelCls}>Body<textarea required rows={10} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1d4ed8]" value={issueForm.body} onChange={(e) => setIssueForm({ ...issueForm, body: e.target.value })} placeholder={"Write the newsletter body here.\n\nSeparate paragraphs with a blank line."} /></label>
              <label className={labelCls}>Publish date<input type="date" className={inputCls} value={issueForm.publishedAt} onChange={(e) => setIssueForm({ ...issueForm, publishedAt: e.target.value })} /></label>
              <button type="submit" disabled={issueSaving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] text-sm font-extrabold text-white transition hover:bg-[#1e40af] disabled:opacity-60">
                {issueSaving && <LoaderCircle size={15} className="animate-spin" />}
                {issueSaving ? "Saving…" : issueEditing ? "Update Draft" : "Save Draft"}
              </button>
              <p className="text-center text-xs text-slate-500">
                After saving, click <strong>Publish</strong> in the list to email all active subscribers.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
