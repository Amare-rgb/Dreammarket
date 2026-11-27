"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, LoaderCircle, MessageSquare, Star, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/app/providers";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { name: string; avatar: string | null };
}

interface UserReview {
  id: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  status: string;
  reply: string | null;
  createdAt: string;
}

interface ProductFeedbackProps {
  productId: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          className={onChange ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
        >
          <Star size={20} className={star <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
        </button>
      ))}
    </div>
  );
}

function AdminReply({ reply }: { reply: string | null }) {
  if (!reply) return null;
  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="mb-1 text-xs font-semibold text-blue-900">Admin Reply:</p>
      <p className="text-sm text-blue-800">{reply}</p>
    </div>
  );
}

export default function ProductFeedback({ productId }: ProductFeedbackProps) {
  const { status } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rewardEarned, setRewardEarned] = useState<{ amount: number; currency: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const loadFeedback = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await api.get(`/api/feedback/products/${productId}`);
      setReviews(res.data?.reviews || []);
      setUserReview(res.data?.userReview || null);
      setHasPurchased(Boolean(res.data?.hasPurchased));
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadFeedback(true), 0);
    return () => clearTimeout(timer);
  }, [loadFeedback]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please upload an image file");
    if (file.size > MAX_IMAGE_BYTES) return setError("Image must be less than 10MB");

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/api/upload/feedback", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) setImageUrl(res.data.url);
      else setError(res.data?.error || "Failed to upload image");
    } catch (err) {
      setError(errMsg(err, "Failed to upload image"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && !imageUrl) return setError("Please write a comment or attach an image");

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/api/feedback/products/${productId}`, {
        rating,
        comment: comment.trim() || null,
        imageUrl,
      });
      if (res.data?.success) {
        setSuccess("Thank you! Your feedback has been submitted for review.");
        if (res.data?.reward?.earned) {
          setRewardEarned({ amount: res.data.reward.amount, currency: res.data.reward.currency || "ETB" });
        }
        setShowForm(false);
        setComment("");
        setImageUrl(null);
        setRating(5);
        await loadFeedback();
      }
    } catch (err) {
      setError(errMsg(err, "Failed to submit feedback"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      await api.delete(`/api/feedback/products/${productId}`);
      setUserReview(null);
      setSuccess("Your review has been deleted.");
      await loadFeedback();
    } catch (err) {
      setError(errMsg(err, "Failed to delete review"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#EB6D3D]" />
      </div>
    );
  }

  return (
    <section className="mt-12 border-t border-gray-200 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <MessageSquare className="h-6 w-6 text-[#EB6D3D]" /> Customer Feedback
        </h2>
        {status === "authenticated" && !userReview && !showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-[#EB6D3D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#cf5427]">
            Write a Review
          </button>
        )}
      </div>

      {userReview && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-sm font-semibold text-blue-900">Your Review</p>
              <div className="mb-2 flex items-center gap-2">
                <Stars value={userReview.rating} />
                <span className="text-xs text-blue-600">({userReview.status})</span>
              </div>
              {userReview.comment && <p className="mb-2 text-sm text-blue-800">{userReview.comment}</p>}
              {userReview.imageUrl && (
                <Image src={userReview.imageUrl} alt="Your review" width={200} height={150} loading="eager" className="mb-2 h-auto w-auto rounded-lg object-cover" />
              )}
              <AdminReply reply={userReview.reply} />
            </div>
            <button type="button" onClick={handleDeleteReview} className="text-sm font-medium text-red-600 hover:text-red-800">
              Delete
            </button>
          </div>
        </div>
      )}

      {showForm && status === "authenticated" && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Write Your Review</h3>
          {!hasPurchased && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              You can leave feedback for this product. Your review will be reviewed by our team.
            </div>
          )}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Rating</label>
            <Stars value={rating} onChange={setRating} />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Your Feedback <span className="text-gray-400">(optional)</span>
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience with this product..." rows={4} maxLength={2000} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-[#EB6D3D]" />
            <p className="mt-1 text-xs text-gray-500">{comment.length}/2000</p>
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Attach Screenshot <span className="text-gray-400">(optional)</span>
            </label>
            {imageUrl ? (
              <div className="relative inline-block">
                <Image src={imageUrl} alt="Preview" width={200} height={150} loading="eager" className="h-auto w-auto rounded-lg border border-gray-300 object-cover" />
                <button type="button" onClick={() => setImageUrl(null)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-[#EB6D3D]">
                {uploading ? (
                  <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#EB6D3D]" />
                ) : (
                  <>
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-600">Click to upload image</p>
                    <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 10MB</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting || uploading} className="rounded-lg bg-[#EB6D3D] px-6 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#cf5427]">
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-700 hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      {rewardEarned && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <Star size={18} className="fill-emerald-500 text-emerald-500" />
          Reward earned! {rewardEarned.amount} {rewardEarned.currency} added to your wallet.
        </div>
      )}

      {status !== "authenticated" && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            Please <a href="/auth/signin" className="font-medium text-[#EB6D3D] hover:underline">sign in</a> to leave feedback
          </p>
        </div>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                    {review.user.avatar ? (
                      <Image src={review.user.avatar} alt={review.user.name} width={40} height={40} unoptimized={review.user.avatar.includes("googleusercontent.com")} className="rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">{review.user.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{review.user.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(review.createdAt)}</p>
                  </div>
                </div>
                <Stars value={review.rating} />
              </div>
              {review.comment && <p className="mb-3 whitespace-pre-wrap text-gray-700">{review.comment}</p>}
              {review.imageUrl && (
                <Image src={review.imageUrl} alt="Review attachment" width={300} height={200} loading="eager" className="mb-3 h-auto w-auto rounded-lg border border-gray-200 object-cover" />
              )}
              <AdminReply reply={review.reply} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}