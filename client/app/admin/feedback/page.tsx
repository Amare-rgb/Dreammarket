"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MessageSquare,
  Star,
  Trash2,
  LoaderCircle,
  AlertCircle,
  User,
  ExternalLink,
  CheckCircle,
  Eye,
  EyeOff,
  Reply,
  Filter,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/publicArticles";

interface FeedbackItem {
  id: string;
  type: "review" | "comment";
  rating?: number;
  comment?: string | null;
  message?: string;
  name?: string;
  imageUrl?: string | null;
  status: string;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  };
  article?: {
    id: string;
    title: string;
    slug: string;
  };
}

interface FeedbackResponse {
  success: boolean;
  reviews: FeedbackItem[];
  articleComments: FeedbackItem[];
  totalReviews: number;
  totalArticleComments: number;
  pagination: {
    page: number;
    limit: number;
    totalReviews: number;
    totalArticleComments: number;
  };
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "comment">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showReplyForm, setShowReplyForm] = useState<Record<string, boolean>>({});

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "20");
      if (filter !== "all") params.append("type", filter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await api.get(`/api/feedback/admin/all?${params.toString()}`);
      const data: FeedbackResponse = res.data;
      
      // Combine reviews and comments
      const allItems = [...(data.reviews || []), ...(data.articleComments || [])];
      // Sort by createdAt descending
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFeedback(allItems);
      setTotalPages(Math.ceil((data.totalReviews + data.totalArticleComments) / 20));
      setError("");
    } catch {
      setError("Failed to load feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, filter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchFeedback();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFeedback]);

  const handleStatusChange = async (id: string, type: "review" | "comment", newStatus: string) => {
    setActionLoading(id);
    try {
      const endpoint = type === "review" 
        ? `/api/feedback/admin/reviews/${id}/status`
        : `/api/feedback/admin/comments/${id}/status`;
      
      await api.patch(endpoint, { status: newStatus });
      await fetchFeedback();
    } catch {
      alert("Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, type: "review" | "comment") => {
    if (!confirm("Are you sure you want to delete this? This cannot be undone.")) return;
    
    setActionLoading(id);
    try {
      const endpoint = type === "review"
        ? `/api/feedback/admin/reviews/${id}`
        : `/api/feedback/admin/comments/${id}`;
      
      await api.delete(endpoint);
      await fetchFeedback();
    } catch {
      alert("Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReply = async (id: string, type: "review" | "comment") => {
    const reply = replyText[id]?.trim();
    if (!reply) {
      alert("Please enter a reply");
      return;
    }

    setActionLoading(id);
    try {
      const endpoint = type === "review"
        ? `/api/feedback/admin/reviews/${id}/reply`
        : `/api/feedback/admin/comments/${id}/reply`;
      
      await api.post(endpoint, { reply });
      setReplyText((prev) => ({ ...prev, [id]: "" }));
      setShowReplyForm((prev) => ({ ...prev, [id]: false }));
      await fetchFeedback();
    } catch {
      alert("Failed to send reply");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Approved</span>;
      case "HIDDEN":
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Hidden</span>;
      case "PENDING":
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Pending</span>;
    }
  };

  const getTypeBadge = (type: "review" | "comment") => {
    return type === "review" ? (
      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
        <Star size={12} /> Review
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full flex items-center gap-1">
        <MessageSquare size={12} /> Comment
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#EB6D3D]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#EB6D3D]" />
            Feedback & Comments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage product reviews and article comments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchFeedback}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as "all" | "review" | "comment");
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EB6D3D]"
          >
            <option value="all">All Types</option>
            <option value="review">Product Reviews</option>
            <option value="comment">Article Comments</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EB6D3D]"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Feedback List */}
      {feedback.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800">No feedback yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            When users leave reviews or comments, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {feedback.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 transition hover:shadow-md"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left Side: Content */}
                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3">
                    {getTypeBadge(item.type)}
                    {getStatusBadge(item.status)}
                    {item.type === "review" && item.rating && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            className={
                              star <= item.rating!
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }
                          />
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                  </div>

                  {/* User Info */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      {item.user?.avatar ? (
                        <Image
                          src={item.user.avatar}
                          alt={item.user.name}
                          width={32}
                          height={32}
                          unoptimized={item.user.avatar.includes('googleusercontent.com')}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {item.user?.name || item.name || "Anonymous"}
                      </p>
                      {item.user?.email && (
                        <p className="text-xs text-gray-500">{item.user.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Associated Product/Article */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-400">
                      {item.type === "review" ? "Product:" : "Article:"}
                    </span>
                    {item.type === "review" && item.product ? (
                      <Link
                        href={`/shop/${item.product.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[#cf5427] hover:underline font-medium"
                      >
                        {item.product.name}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : item.article ? (
                      <Link
                        href={`/articles/${item.article.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[#cf5427] hover:underline font-medium"
                      >
                        {item.article.title}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : null}
                  </div>

                  {/* Content */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap break-words border border-gray-100">
                    {item.type === "review" ? item.comment : item.message}
                  </div>

                  {/* Image */}
                  {item.imageUrl && (
                    <div className="mt-2">
                      <Image
                        src={item.imageUrl}
                        alt="Attachment"
                        width={300}
                        height={200}
                        className="rounded-lg object-cover border border-gray-200"
                      />
                    </div>
                  )}

                  {/* Existing Reply */}
                  {item.reply && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Admin Reply:</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{item.reply}</p>
                      {item.repliedAt && (
                        <p className="text-xs text-blue-600 mt-1">
                          Replied on {formatDate(item.repliedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reply Form */}
                  {showReplyForm[item.id] && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <textarea
                        value={replyText[item.id] || ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Type your reply..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EB6D3D]"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleReply(item.id, item.type)}
                          disabled={actionLoading === item.id}
                          className="px-4 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] disabled:opacity-50 text-sm font-medium"
                        >
                          {actionLoading === item.id ? "Sending..." : "Send Reply"}
                        </button>
                        <button
                          onClick={() => setShowReplyForm((prev) => ({ ...prev, [item.id]: false }))}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Actions */}
                <div className="shrink-0 flex flex-col gap-2">
                  {/* Status Actions */}
                  <div className="flex flex-wrap gap-2">
                    {item.status !== "APPROVED" && (
                      <button
                        onClick={() => handleStatusChange(item.id, item.type, "APPROVED")}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}
                    {item.status !== "HIDDEN" && (
                      <button
                        onClick={() => handleStatusChange(item.id, item.type, "HIDDEN")}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide
                      </button>
                    )}
                    {item.status === "HIDDEN" && (
                      <button
                        onClick={() => handleStatusChange(item.id, item.type, "APPROVED")}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Show
                      </button>
                    )}
                  </div>

                  {/* Reply Button */}
                  {!item.reply && !showReplyForm[item.id] && (
                    <button
                      onClick={() => setShowReplyForm((prev) => ({ ...prev, [item.id]: true }))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      Reply
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(item.id, item.type)}
                    disabled={actionLoading === item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                  >
                    {actionLoading === item.id ? (
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
