"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Video,
} from "lucide-react";
import { api, uploadApi } from "@/lib/api";
import { getVideoSource, isValidHttpUrl } from "@/lib/video";
import {
  apiErrorText as errorText,
  categoryLabel,
  useArticleCategories,
} from "@/lib/articleCategories";
import VideoPlayer from "@/components/VideoPlayer";

interface ArticleDraft {
  category: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  image: string;
  videoUrl: string;
  note: string;
  published: boolean;
}

const emptyDraft: ArticleDraft = {
  category: "",
  title: "",
  slug: "",
  description: "",
  content: "",
  image: "",
  videoUrl: "",
  note: "",
  published: false,
};

const STEPS = [
  { key: "details", label: "Details" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "note", label: "Note" },
  { key: "publish", label: "Publish" },
] as const;

const LAST_STEP = STEPS.length - 1;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20";

function StepCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export default function ArticleForm({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { categories, loading: categoriesLoading, create: createCategory } =
    useArticleCategories();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [savedId, setSavedId] = useState(articleId);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [telegram, setTelegram] = useState<{
    sent: boolean;
    message: string;
  } | null>(null);

  // New category (inline)
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Falls back to the first category until the admin picks one.
  const category = draft.category || categories[0]?.slug || "";

  const update = <K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!articleId) return;
    let active = true;
    api
      .get(`/api/articles/admin/${articleId}`)
      .then((res) => {
        const a = res.data?.article;
        if (!a) throw new Error("Article not found.");
        if (active) {
          setDraft({
            category: a.category || "",
            title: a.title || "",
            slug: a.slug || "",
            description: a.description || "",
            content: a.content || "",
            image: a.image || "",
            videoUrl: a.videoUrl || "",
            note: a.note || "",
            published: Boolean(a.published),
          });
        }
      })
      .catch((e: unknown) => {
        if (active) setError(errorText(e, "Failed to load article."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError("");
    setCreatingCategory(true);
    try {
      const created = await createCategory(name);
      update("category", created.slug);
      setNewCategoryName("");
      setNewCategoryOpen(false);
    } catch (e) {
      setError(errorText(e, "Could not create the category."));
    } finally {
      setCreatingCategory(false);
    }
  };

  const validateDetails = () => {
    if (!category) {
      setError("Choose a category, or create a new one.");
      return false;
    }
    if (!draft.title.trim()) {
      setError("Enter the article title.");
      return false;
    }
    if (!draft.description.trim()) {
      setError("Enter a short description.");
      return false;
    }
    if (!draft.content.trim()) {
      setError("Enter the article content.");
      return false;
    }
    return true;
  };

  const validateVideo = () => {
    const value = draft.videoUrl.trim();
    if (value && !isValidHttpUrl(value)) {
      setError(
        "Enter a valid video URL starting with http:// or https://, or leave it empty."
      );
      return false;
    }
    return true;
  };

  const validateStep = (index: number) => {
    setError("");
    if (index === 0) return validateDetails();
    if (index === 2) return validateVideo();
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const goTo = (index: number) => {
    if (index === step) return;
    if (index < step) {
      setError("");
      setStep(index);
      return;
    }
    if (!validateDetails()) {
      setStep(0);
      return;
    }
    setError("");
    setStep(index);
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const res = await uploadApi.uploadArticleImage(file);
      if (!res.success || !res.url) {
        throw new Error("Image upload did not return an image URL.");
      }
      update("image", res.url);
    } catch (e) {
      setError(errorText(e, "Failed to upload article image."));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < LAST_STEP) {
      goNext();
      return;
    }

    setError("");
    setTelegram(null);

    if (!validateDetails()) {
      setStep(0);
      return;
    }
    if (!validateVideo()) {
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...draft, category, videoUrl: draft.videoUrl.trim() };
      const res = savedId
        ? await api.put(`/api/articles/admin/${savedId}`, payload)
        : await api.post("/api/articles/admin", payload);

      const id = res.data?.article?.id || savedId;
      if (!id) {
        throw new Error("The article was saved, but its ID was not returned.");
      }
      setSavedId(id);

      const t = res.data?.telegram as
        | { sent: boolean; error?: string; warning?: string }
        | undefined;
      if (t && !t.sent) {
        setTelegram({
          sent: false,
          message:
            t.error ||
            "The article was saved, but its Telegram announcement failed.",
        });
        return;
      }

      router.push("/admin/articles");
      router.refresh();
    } catch (e) {
      setError(errorText(e, "Failed to save article."));
    } finally {
      setSaving(false);
    }
  };

  const retryTelegram = async () => {
    if (!savedId) return;
    setRetrying(true);
    try {
      const res = await api.post(`/api/articles/admin/${savedId}/telegram`);
      const t = res.data?.telegram;
      setTelegram({
        sent: Boolean(t?.sent),
        message: t?.sent
          ? t.warning
            ? `Article text was sent, but its image could not be sent: ${t.warning}`
            : "Article image and content sent to Telegram."
          : t?.error || "The Telegram announcement could not be sent.",
      });
    } catch (e) {
      setTelegram({
        sent: false,
        message: errorText(e, "The Telegram announcement could not be sent."),
      });
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
      </div>
    );
  }

  const videoSource = draft.videoUrl.trim() ? getVideoSource(draft.videoUrl) : null;
  const busy = saving || uploading || creatingCategory;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to articles
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {savedId ? "Edit article" : "Add an article"}
        </h1>
      </header>

      {/* Step indicator */}
      <nav aria-label="Article steps" className="overflow-x-auto">
        <ol className="flex min-w-max items-center gap-2">
          {STEPS.map((s, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    current
                      ? "bg-[#20283a] text-white"
                      : done
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      current
                        ? "bg-white/20"
                        : done
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100"
                    }`}
                  >
                    {done ? <Check size={12} /> : index + 1}
                  </span>
                  {s.label}
                </button>
                {index < LAST_STEP && <span className="h-px w-4 bg-slate-200" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {telegram && (
        <div
          role={telegram.sent ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm ${
            telegram.sent
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p>{telegram.message}</p>
          {!telegram.sent && savedId && draft.published && (
            <button
              type="button"
              onClick={() => void retryTelegram()}
              disabled={retrying}
              className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-60"
            >
              {retrying ? "Sending..." : "Retry Telegram send"}
            </button>
          )}
        </div>
      )}

      {/* Step 1: Category and details */}
      {step === 0 && (
        <StepCard title="Category and details" hint="Choose a category or create a new one, then write the article.">
          <div>
            <span className="block text-sm font-semibold text-slate-700">Category *</span>

            {categoriesLoading ? (
              <p className="mt-2 text-sm text-slate-500">Loading categories...</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update("category", c.slug)}
                    aria-pressed={category === c.slug}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      category === c.slug
                        ? "bg-[#EB6D3D] text-[#20283a]"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {!newCategoryOpen && (
                  <button
                    type="button"
                    onClick={() => setNewCategoryOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#EB6D3D] px-4 py-1.5 text-sm font-semibold text-[#9c3d1a] transition hover:bg-[#EB6D3D]/10"
                  >
                    <Plus size={14} /> New category
                  </button>
                )}
              </div>
            )}

            {newCategoryOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateCategory();
                    }
                  }}
                  maxLength={40}
                  placeholder="Category name"
                  aria-label="New category name"
                  autoFocus
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCategory()}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingCategory ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryOpen(false);
                    setNewCategoryName("");
                  }}
                  className="h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Article title *
              <input
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                maxLength={180}
                className={`${inputClass} h-11`}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              URL slug (optional)
              <input
                value={draft.slug}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="generated-from-title"
                maxLength={100}
                className={`${inputClass} h-11`}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Short description *
            <textarea
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              maxLength={1000}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Article content *
            <textarea
              value={draft.content}
              onChange={(e) => update("content", e.target.value)}
              rows={10}
              className={`${inputClass} py-2 leading-6`}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Paragraph breaks are preserved on the public article page.
            </span>
          </label>
        </StepCard>
      )}

      {/* Step 2: Image */}
      {step === 1 && (
        <StepCard title="Cover image" hint="Optional. Shown on the article card and the article page.">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            className="sr-only"
          />
          <div className="flex flex-wrap items-center gap-4">
            {draft.image ? (
              <Image
                src={draft.image}
                alt="Article cover preview"
                width={320}
                height={200}
                unoptimized
                className="h-36 w-56 rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-36 w-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <ImagePlus size={28} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-[#EB6D3D]/40 px-4 py-2 text-sm font-semibold text-[#9c3d1a] transition hover:bg-[#EB6D3D]/10 disabled:opacity-60"
              >
                {uploading
                  ? "Uploading image..."
                  : draft.image
                    ? "Change image"
                    : "Upload image"}
              </button>
              {draft.image && (
                <button
                  type="button"
                  onClick={() => update("image", "")}
                  className="text-left text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remove image
                </button>
              )}
              <p className="text-xs text-slate-500">Image files up to 10 MB.</p>
            </div>
          </div>
        </StepCard>
      )}

      {/* Step 3: Video */}
      {step === 2 && (
        <StepCard title="Video" hint="Optional. YouTube, Vimeo or a direct video link.">
          <div className="flex h-11 items-center rounded-xl border border-slate-300 focus-within:border-[#EB6D3D] focus-within:ring-2 focus-within:ring-[#EB6D3D]/20">
            <span className="px-3 text-slate-500">
              <Video size={16} />
            </span>
            <input
              type="url"
              maxLength={500}
              value={draft.videoUrl}
              onChange={(e) => update("videoUrl", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-label="Video URL"
              className="h-full min-w-0 flex-1 rounded-r-xl border-0 bg-transparent pr-3 outline-none"
            />
          </div>
          {draft.videoUrl.trim() &&
            (videoSource ? (
              <div className="max-w-2xl">
                <VideoPlayer
                  url={draft.videoUrl}
                  title={draft.title || "Article video preview"}
                />
              </div>
            ) : (
              <p className="text-xs text-red-600">
                This is not a valid video link yet. Use a full link starting with
                http:// or https://.
              </p>
            ))}
        </StepCard>
      )}

      {/* Step 4: Note */}
      {step === 3 && (
        <StepCard title="Additional note" hint="Optional. Shown together with the published article.">
          <textarea
            value={draft.note}
            onChange={(e) => update("note", e.target.value)}
            rows={5}
            aria-label="Additional note"
            className={`${inputClass} py-2`}
          />
        </StepCard>
      )}

      {/* Step 5: Review and publish */}
      {step === 4 && (
        <StepCard title="Review and publish" hint="Check the summary, then save the article.">
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {[
              { label: "Category", value: categoryLabel(categories, category), step: 0 },
              { label: "Title", value: draft.title, step: 0 },
              { label: "Description", value: draft.description, step: 0 },
              { label: "Image", value: draft.image ? "Added" : "None", step: 1 },
              { label: "Video", value: draft.videoUrl.trim() ? "Added" : "None", step: 2 },
              { label: "Note", value: draft.note.trim() ? "Added" : "None", step: 3 },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3 px-4 py-2.5">
                <dt className="w-24 shrink-0 font-semibold text-slate-500">{row.label}</dt>
                <dd className="min-w-0 flex-1 break-words text-slate-900">{row.value}</dd>
                <button
                  type="button"
                  onClick={() => goTo(row.step)}
                  className="text-xs font-semibold text-[#9c3d1a] hover:underline"
                >
                  Edit
                </button>
              </div>
            ))}
          </dl>

          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => update("published", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#EB6D3D]"
            />
            <span>
              <span className="block font-semibold">Publish article</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Published articles are visible on the public Articles page.
                Leave unchecked to save as a draft.
              </span>
            </span>
          </label>
        </StepCard>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pb-6">
        {step === 0 ? (
          <Link
            href="/admin/articles"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {step < LAST_STEP ? (
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving..." : savedId ? "Save changes" : "Create article"}
          </button>
        )}
      </div>
    </form>
  );
}