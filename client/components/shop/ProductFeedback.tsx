"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Star, X, LoaderCircle, MessageSquare, ImageIcon } from "lucide-react";
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
  user: {
    name: string;
    avatar: string | null;
  };
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

export default function ProductFeedback({ productId }: ProductFeedbackProps) {
  const { status } = useAuth();
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
  
  // Form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/feedback/products/${productId}`);
        setReviews(res.data?.reviews || []);
        setUserReview(res.data?.userReview || null);
        setHasPurchased(res.data?.hasPurchased || false);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(() => {
      void fetchReviews();
    }, 0);
    return () => clearTimeout(timer);
  }, [productId]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await api.post("/api/upload/feedback", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        setImageUrl(res.data.url);
        setImagePreview(res.data.url);
      } else {
        setError(res.data?.error || "Failed to upload image");
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove image
  const removeImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  // Submit review
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && !imageUrl) {
      setError("Please write a comment or attach an image");
      return;
    }

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
          setRewardEarned({
            amount: res.data.reward.amount,
            currency: res.data.reward.currency || "ETB",
          });
        }
        setShowForm(false);
        setComment("");
        setImageUrl(null);
        setImagePreview(null);
        setRating(5);
        // Refresh reviews
        const reviewsRes = await api.get(`/api/feedback/products/${productId}`);
        setReviews(reviewsRes.data?.reviews || []);
        setUserReview(reviewsRes.data?.userReview || null);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete review
  const handleDeleteReview = async () => {
    if (!confirm("Are you sure you want to delete your review?")) return;

    try {
      await api.delete(`/api/feedback/products/${productId}`);
      setUserReview(null);
      setSuccess("Your review has been deleted.");
      // Refresh reviews
      const reviewsRes = await api.get(`/api/feedback/products/${productId}`);
      setReviews(reviewsRes.data?.reviews || []);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to delete review");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderStars = (rating: number, interactive = false, onRate?: (r: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRate?.(star)}
            disabled={!interactive}
            className={`transition-colors ${
              interactive ? "cursor-pointer hover:scale-110" : "cursor-default"
            }`}
          >
            <Star
              size={20}
              className={
                star <= rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }
            />
          </button>
        ))}
      </div>
    );
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#EB6D3D]" />
          Customer Feedback
        </h2>
        {status === "authenticated" && !userReview && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] transition-colors text-sm font-medium"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* User's existing review */}
      {userReview && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Your Review</p>
              <div className="flex items-center gap-2 mb-2">
                {renderStars(userReview.rating)}
                <span className="text-xs text-blue-600">({userReview.status})</span>
              </div>
              {userReview.comment && (
                <p className="text-sm text-blue-800 mb-2">{userReview.comment}</p>
              )}
              {userReview.imageUrl && (
                <div className="mb-2">
                  <Image
                    src={userReview.imageUrl}
                    alt="Your review"
                    width={200}
                    height={150}
                    loading="eager"
                    className="rounded-lg object-cover w-auto h-auto"
                  />
                </div>
              )}
              {userReview.reply && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Admin Reply:</p>
                  <p className="text-sm text-blue-800">{userReview.reply}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleDeleteReview}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Review form */}
      {showForm && status === "authenticated" && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Write Your Review</h3>
          
          {/* Purchase status message */}
          {!hasPurchased && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              You can leave feedback for this product. Your review will be reviewed by our team.
            </div>
          )}
          
          {/* Rating */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            {renderStars(rating, true, setRating)}
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Feedback <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this product..."
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EB6D3D] focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{comment.length}/2000</p>
          </div>

          {/* Image upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Screenshot <span className="text-gray-400">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative inline-block">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={200}
                  height={150}
                  loading="eager"
                  className="rounded-lg object-cover border border-gray-300 w-auto h-auto"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#EB6D3D] transition-colors"
              >
                {uploading ? (
                  <LoaderCircle className="h-8 w-8 animate-spin text-[#EB6D3D] mx-auto" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload image</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}
          {/* Submit buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-6 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reward earned confirmation */}
      {rewardEarned && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-sm font-semibold">
          <Star size={18} className="fill-emerald-500 text-emerald-500" />
          Reward earned! {rewardEarned.amount} {rewardEarned.currency} added to your wallet.
        </div>
      )}

      {/* Login prompt for non-authenticated users */}
      {status !== "authenticated" && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-sm text-gray-600">
            Please <a href="/auth/signin" className="text-[#EB6D3D] font-medium hover:underline">sign in</a> to leave feedback
          </p>
        </div>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {review.user.avatar ? (
                      <Image
                        src={review.user.avatar}
                        alt={review.user.name}
                        width={40}
                        height={40}
                        unoptimized={review.user.avatar.includes('googleusercontent.com')}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">
                        {review.user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{review.user.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(review.createdAt)}</p>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>

              {review.comment && (
                <p className="text-gray-700 mb-3 whitespace-pre-wrap">{review.comment}</p>
              )}

              {review.imageUrl && (
                <div className="mb-3">
                  <Image
                    src={review.imageUrl}
                    alt="Review attachment"
                    width={300}
                    height={200}
                    loading="eager"
                    className="rounded-lg object-cover border border-gray-200 w-auto h-auto"
                  />
                </div>
              )}

              {review.reply && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Admin Reply:</p>
                  <p className="text-sm text-blue-800">{review.reply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
