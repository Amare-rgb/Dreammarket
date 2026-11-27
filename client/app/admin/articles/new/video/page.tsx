"use client";

import { ChangeEvent, FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Upload, Video, X, FileText, Scissors, Download, Sparkles } from "lucide-react";
import { api, uploadApi } from "@/lib/api";
import { getVideoSource, isValidHttpUrl } from "@/lib/video";
import { apiErrorText as errorText, useArticleCategories } from "@/lib/articleCategories";
import VideoPlayer from "@/components/VideoPlayer";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]";
const errorBox = "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700";
const chipBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100";
const area = `${inputClass} resize-none`;

const emptyForm = { title: "", description: "", content: "", titleAm: "", descriptionAm: "", contentAm: "" };
type FormKey = keyof typeof emptyForm;

const amFields: { key: FormKey; label: string; placeholder: string; rows?: number; max?: number }[] = [
  { key: "titleAm", label: "የጽሑፉ ርዕስ", placeholder: "Enter Amharic title", max: 180 },
  { key: "descriptionAm", label: "ማጠቃለያ", placeholder: "Enter Amharic description", rows: 2, max: 1000 },
  { key: "contentAm", label: "የጽሑፉ ይዘት", placeholder: "Write the Amharic article content here...", rows: 4 },
];

const exportFiles = ["captions.srt", "captions.vtt", "markers.csv", "markers.edl", "edit-plan.json", "render.sh"] as const;

type SmartEditResult = {
  jobId: string;
  stats: {
    silenceCuts: number; silenceSecondsRemoved: number; keepSegments: number;
    keepSeconds: number; highlights: number; captions: number;
  };
  transcription: { provider: string; segmentCount: number; error: string | null };
  files: Record<string, string>;
};

const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

function Field({ label, required, small, children }: { label: string; required?: boolean; small?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className={`mb-1 block font-semibold ${small ? "text-xs text-slate-600" : "text-sm text-slate-700"}`}>
        {label} {required && <span className="text-[#EB6D3D]">*</span>}
      </label>
      {children}
    </div>
  );
}

const Spinner = ({ size = 16 }: { size?: number }) => <LoaderCircle size={size} className="animate-spin" />;

export default function NewArticleVideoPage() {
  const router = useRouter();
  const { categories } = useArticleCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(emptyForm);
  const [category, setCategory] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // Smart Edit (AI cuts, highlights, captions)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [smartEditLoading, setSmartEditLoading] = useState(false);
  const [smartEditError, setSmartEditError] = useState("");
  const [smartEditResult, setSmartEditResult] = useState<SmartEditResult | null>(null);
  const [cupcutLoading, setCupcutLoading] = useState(false);
  const [cupcutMsg, setCupcutMsg] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);

  const bind = (key: FormKey) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const effectiveCategory = category || categories.find((c) => !c.parentId)?.slug || categories[0]?.slug || "";

  // Top-level categories with their subcategories
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId)
        .map((c) => ({ ...c, children: categories.filter((s) => s.parentId === c.id) })),
    [categories]
  );

  const videoSource = videoUrl.trim() ? getVideoSource(videoUrl) : null;

  // Validate + upload a picked file; returns the uploaded URL (or null after setting an error)
  const pickAndUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    o: {
      valid: (f: File) => boolean; typeErr: string; maxMb: number; sizeErr: string;
      upload: (f: File) => Promise<{ success?: boolean; url?: string }>;
      noUrl: string; fail: string; onFile?: (f: File) => void; onUrl: (url: string) => void;
    }
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!o.valid(file)) return setError(o.typeErr);
    if (file.size > o.maxMb * 1024 * 1024) return setError(o.sizeErr);

    setError("");
    o.onFile?.(file);
    setUploading(true);
    try {
      const res = await o.upload(file);
      if (!res.success || !res.url) throw new Error(o.noUrl);
      o.onUrl(res.url);
    } catch (err) {
      setError(errorText(err, o.fail));
    } finally {
      setUploading(false);
    }
  };

  const handleVideoFile = (e: ChangeEvent<HTMLInputElement>) =>
    pickAndUpload(e, {
      valid: (f) => f.type.startsWith("video/"),
      typeErr: "Choose a video file (mp4, webm, mov, etc.).",
      maxMb: 200,
      sizeErr: "Video size must be 200 MB or less.",
      upload: (f) => uploadApi.uploadArticleVideo(f),
      noUrl: "Video upload did not return a URL.",
      fail: "Failed to upload the video file.",
      onFile: (f) => { setVideoFile(f); setSmartEditResult(null); setSmartEditError(""); },
      onUrl: setVideoUrl,
    });

  const handlePdf = (e: ChangeEvent<HTMLInputElement>) =>
    pickAndUpload(e, {
      valid: (f) => f.type === "application/pdf",
      typeErr: "Choose a PDF file.",
      maxMb: 20,
      sizeErr: "PDF size must be 20 MB or less.",
      upload: (f) => uploadApi.uploadPdf(f),
      noUrl: "PDF upload did not return a file URL.",
      fail: "Failed to upload the PDF file.",
      onUrl: setPdfUrl,
    });

  const runSmartEdit = async () => {
    if (!videoFile) return;
    setSmartEditLoading(true);
    setSmartEditError("");
    setSmartEditResult(null);
    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      const res = await api.post("/api/admin/smart-edit/analyze", formData, {
        timeout: 15 * 60 * 1000,
        transformRequest: [
          (data: FormData, headers: Record<string, unknown>) => {
            if (headers && typeof headers === "object") {
              delete headers["Content-Type"];
              delete headers["content-type"];
            }
            return data;
          },
        ],
      });
      if (res.data?.success) setSmartEditResult(res.data);
      else setSmartEditError(res.data?.error || "Smart analysis failed.");
    } catch (err) {
      setSmartEditError(apiError(err, "Smart analysis failed. Check that ffmpeg is installed on the server."));
    } finally {
      setSmartEditLoading(false);
    }
  };

  const exportToCapCut = async () => {
    if (!smartEditResult) return;
    setCupcutLoading(true);
    setCupcutMsg("");
    try {
      const res = await api.post(`/api/admin/smart-edit/${smartEditResult.jobId}/export/cupcut`);
      setCupcutMsg(
        res.data?.success ? res.data.message || "CapCut draft created." : res.data?.error || "CapCut export failed."
      );
    } catch (err) {
      setCupcutMsg(apiError(err, "CapCut export failed."));
    } finally {
      setCupcutLoading(false);
    }
  };

  const copyVsCodeCommand = async () => {
    if (!videoFile) return;
    const cmd = `node smart-editor/src/cli.js analyze "${videoFile.name}" --out smart-editor/out`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      setCopiedCmd(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!effectiveCategory) return setError("Choose a category first.");
    if (!form.title.trim()) return setError("Enter the article title.");
    if (!form.description.trim()) return setError("Enter a short description.");
    if (!form.content.trim()) return setError("Enter the article content.");

    const url = videoUrl.trim();
    if (!url) return setError("A video URL is required for this form.");
    if (!isValidHttpUrl(url)) return setError("Video URL must start with http:// or https://.");

    setSaving(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await api.post("/api/articles/admin", {
        category: effectiveCategory, ...trimmed, slug: "", note: "", image: "", videoUrl: url, pdfUrl, published,
      });
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      setError(errorText(err, "Failed to save the article video."));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    router.push("/admin/articles");
  };

  if (!isOpen) return null;

  const stats = smartEditResult?.stats;
  const statCards = stats
    ? [[stats.keepSegments, "keep segments"], [stats.silenceCuts, "silence cuts"],
       [stats.captions, "captions"], [stats.highlights, "highlights"]]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EB6D3D]/10 text-[#EB6D3D]">
              <Video size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add article video</h2>
              <p className="text-xs text-slate-500">Upload a local video or attach a YouTube/Vimeo link.</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {error && <p className={errorBox}>{error}</p>}

            <Field label="Article title" required>
              <input {...bind("title")} maxLength={180} placeholder="Enter article title" className={inputClass} />
            </Field>

            <Field label="Description" required>
              <textarea {...bind("description")} maxLength={1000} rows={2} placeholder="Short description for the card..." className={area} />
            </Field>

            <Field label="Category" required>
              <select value={effectiveCategory} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                <option value="" disabled>Select a category</option>
                {categoryOptions.map((c) =>
                  c.children.length > 0 ? (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.slug}>{c.name}</option>
                      {c.children.map((sub) => (
                        <option key={sub.id} value={sub.slug}>{"\u00A0\u00A0\u00A0\u00A0"}{sub.name}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  )
                )}
              </select>
            </Field>

            {/* Video source: upload local file or paste a link */}
            <Field label="Video" required>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                  onChange={(e) => void handleVideoFile(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#EB6D3D] hover:text-[#cf5427] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <Spinner /> : <Upload size={16} />}
                  {uploading ? "Uploading..." : "Upload local video"}
                </button>
                <span className="text-xs text-slate-400">or paste a link below</span>
                {videoFile && (
                  <button
                    type="button"
                    onClick={() => void runSmartEdit()}
                    disabled={smartEditLoading || uploading || saving}
                    className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {smartEditLoading ? <Spinner /> : <Sparkles size={16} />}
                    {smartEditLoading ? "Analyzing…" : "Smart Edit (AI cuts & captions)"}
                  </button>
                )}
              </div>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                maxLength={500}
                placeholder="https://www.youtube.com/watch?v=... or uploaded file URL"
                className={`${inputClass} mt-2`}
              />
              {videoUrl.trim() && !videoSource && <p className="mt-1 text-xs text-red-600">Not a valid video link yet.</p>}
            </Field>

            {videoSource && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <VideoPlayer url={videoUrl} title={form.title || "Video preview"} />
              </div>
            )}

            {/* Smart Edit results */}
            {smartEditError && <p className={errorBox}>{smartEditError}</p>}
            {smartEditResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <Scissors size={16} /> Smart edit plan ready
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-900 sm:grid-cols-4">
                  {statCards.map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-white/70 p-2">
                      <p className="font-bold">{value}</p>
                      <p className="text-emerald-700">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-800">
                  Removed {smartEditResult.stats.silenceSecondsRemoved.toFixed(1)}s of dead air · transcription:{" "}
                  {smartEditResult.transcription.provider}
                  {smartEditResult.transcription.error ? ` (${smartEditResult.transcription.error})` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void exportToCapCut()}
                    disabled={cupcutLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {cupcutLoading ? <Spinner size={12} /> : <Video size={12} />}
                    {cupcutLoading ? "Creating draft…" : "Open in CapCut"}
                  </button>
                  <button type="button" onClick={() => void copyVsCodeCommand()} className={chipBtn}>
                    {copiedCmd ? "Copied!" : "Copy VS Code command"}
                  </button>
                  {exportFiles.map(
                    (name) =>
                      smartEditResult.files[name] && (
                        <a key={name} href={smartEditResult.files[name]} target="_blank" rel="noopener noreferrer" className={chipBtn}>
                          <Download size={12} />
                          {name}
                        </a>
                      )
                  )}
                </div>
                {cupcutMsg && (
                  <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-800">{cupcutMsg}</p>
                )}
                <p className="mt-2 text-[11px] text-emerald-700">
                  <strong>CapCut:</strong> click <em>Open in CapCut</em> — the draft appears in CapCut → Drafts with your
                  smart cuts + captions on the timeline. <strong>VS Code:</strong> copy the command and run it in the
                  integrated terminal, or use <em>Tasks: Run Task → Smart Edit</em>. Fine-tune pacing/audio/visuals
                  there — the source video is never modified.
                </p>
              </div>
            )}

            {/* PDF attachment (Optional) */}
            <Field label="Article PDF (Optional)">
              <input ref={pdfRef} type="file" accept="application/pdf" onChange={(e) => void handlePdf(e)} className="hidden" />
              {pdfUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FileText size={20} className="shrink-0 text-[#EB6D3D]" />
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-[#cf5427] hover:underline"
                  >
                    {pdfUrl.split("/").pop()}
                  </a>
                  <button
                    type="button"
                    onClick={() => setPdfUrl("")}
                    className="rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  disabled={uploading || saving}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 transition hover:border-[#EB6D3D] hover:text-[#EB6D3D] disabled:opacity-60"
                >
                  {uploading ? <Spinner /> : <><FileText size={16} /><span>Upload PDF</span></>}
                </button>
              )}
            </Field>

            <Field label="Article content" required>
              <textarea {...bind("content")} rows={4} placeholder="Write the full article content here..." className={area} />
            </Field>

            {/* Amharic translation (optional) */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-700">
                አማርኛ ትርጉም <span className="font-normal text-slate-400">(optional)</span>
              </p>
              {amFields.map(({ key, label, placeholder, rows, max }) => (
                <Field key={key} label={label} small>
                  {rows ? (
                    <textarea {...bind(key)} maxLength={max} rows={rows} placeholder={placeholder} className={area} />
                  ) : (
                    <input {...bind(key)} maxLength={max} placeholder={placeholder} className={inputClass} />
                  )}
                </Field>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#EB6D3D]"
              />
              <span className="font-semibold">Publish this article immediately</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white p-3">
            <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#EB6D3D] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#cf5427] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}