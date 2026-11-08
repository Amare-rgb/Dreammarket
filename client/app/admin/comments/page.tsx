// app/admin/comments/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  MessageSquare, 
  Trash2, 
  LoaderCircle, 
  AlertCircle, 
  User, 
  ExternalLink 
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/publicArticles";

interface AdminComment {
  id: string;
  name: string;
  message: string;
  createdAt: string;
  article: {
    title: string;
    slug: string;
  };
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch comments
  useEffect(() => {
    let active = true;
    
    // ✅ Corrected route to match backend
    api.get("/api/articles/admin/comments")
      .then((res) => {
        if (active) setComments(res.data?.comments || []);
      })
      .catch(() => {
        if (active) setError("Failed to load comments. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this comment? This cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    try {
      // ✅ Corrected route to match backend
      await api.delete(`/api/articles/admin/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert("Failed to delete comment. Please try again.");
    } finally {
      setDeletingId(null);
    }
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
            Comments Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review, manage, and delete comments left by users on your articles.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-medium text-gray-700">
          Total Comments: <span className="text-[#EB6D3D] font-bold">{comments.length}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800">No comments yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            When users leave comments on your articles, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {comments.map((comment) => (
            <div 
              key={comment.id} 
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 transition hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                
                {/* Left Side: Comment Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{comment.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(comment.createdAt)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap break-words border border-gray-100">
                    {comment.message}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-400">On article:</span>
                    <Link 
                      href={`/articles/${comment.article.slug}`} 
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[#cf5427] hover:underline font-medium"
                    >
                      {comment.article.title}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="shrink-0 flex md:flex-col gap-2">
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                  >
                    {deletingId === comment.id ? (
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
    </div>
  );
}