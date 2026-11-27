// app/contact/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/hooks/useSettings";

const DEFAULT_MAP_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3939.9999!2d37.3861!3d11.5936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b8c5e5e5e5e5e%3A0x1234567890abcdef!2sBahir%20Dar%2C%20Ethiopia!5e0!3m2!1sen!2s!4v1700000000000";

const MAP_PROVIDERS = [
  "google.com/maps",
  "maps.google.com",
  "openstreetmap.org",
  "bing.com/maps",
  "mapbox.com",
  "arcgis.com",
  "/maps/embed",
];

const CONTACT_INFO = {
  email: "suport@dreammoredigitals.com",
  phone: "+251 993 132 122",
  whatsappUrl: "https://wa.me/251993132122",
  telegramUrl: "https://t.me/Dreammore21",
  telegramHandle: "@Dreammore21",
  address: "signal mall 8th floor ,Bahirdar, Ethiopia",
  mapLinkUrl: "https://www.google.com/maps/search/?api=1&query=Bahir+Dar+Ethiopia",
  mapQueryUrl: "https://maps.google.com/maps?q=Bahirdar%2C%20Ethiopia&output=embed",
};

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  subject: "General Inquiry",
  message: "",
};

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500";

function resolveMapUrl(raw?: string): string {
  if (!raw || typeof raw !== "string") return DEFAULT_MAP_URL;
  const trimmed = raw.trim();
  const match = trimmed.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  const candidate = match ? match[1].trim() : trimmed;
  if (!/^https?:\/\//i.test(candidate)) return DEFAULT_MAP_URL;
  return MAP_PROVIDERS.some((p) => candidate.includes(p)) ? candidate : DEFAULT_MAP_URL;
}

function StatusScreen({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          {icon}
        </div>
        <h2 className="mb-2 text-2xl font-bold text-gray-800">{title}</h2>
        <p className="mb-6 text-gray-600">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-yellow-600"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </main>
  );
}

export default function ContactPage() {
  const { loading, error, forceUpdate, refetch } = useSettings();
  const { t } = useLanguage();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const savedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser) as { name?: string; email?: string; phone?: string };
          setFormData((cur) => ({
            ...cur,
            name: user.name || cur.name,
            email: user.email || cur.email,
            phone: user.phone || cur.phone,
          }));
        } catch (err) {
          console.error("Unable to load saved contact details:", err);
        }
      }
      setIsClient(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const onSettingsChange = () => forceUpdate();
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === "site_settings" && e.newValue) forceUpdate();
    };
    window.addEventListener("settings-change", onSettingsChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener("settings-change", onSettingsChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [forceUpdate]);

  useEffect(() => {
    if (!loading) return;
    const timeoutId = setTimeout(() => refetch?.(), 8000);
    return () => clearTimeout(timeoutId);
  }, [loading, refetch]);

  const updateField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to send message");

      setSubmitted(true);
      setFormData(INITIAL_FORM);
      toast.success(
        t("contact.toast_success", "Thank you! Your message has been sent to our support team.")
      );
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(t("contact.toast_error", "Failed to send message. Please try again."));
    } finally {
      setSending(false);
    }
  };

  if (!isClient || loading) {
    return (
      <StatusScreen
        icon={
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
        }
        title={t("contact.loading_title", "Please wait")}
        description={t("contact.loading_info", "Loading contact information...")}
        actionLabel={loading ? t("contact.loading_retry", "Retry loading") : undefined}
        onAction={loading ? () => refetch?.() : undefined}
      />
    );
  }

  if (error) {
    return (
      <StatusScreen
        icon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={32} />
          </div>
        }
        title={t("contact.error_title", "Something went wrong")}
        description={t(
          "contact.error_desc",
          "We couldn't load the contact information. Please try again."
        )}
        actionLabel={t("contact.retry_btn", "Retry")}
        onAction={() => refetch?.()}
      />
    );
  }

  const channels = [
    {
      icon: <Mail size={20} className="text-yellow-300" />,
      label: t("contact.email", "Email"),
      value: CONTACT_INFO.email,
      href: `mailto:${CONTACT_INFO.email}`,
      external: false,
    },
    {
      icon: <Phone size={20} className="text-yellow-300" />,
      label: t("contact.phone_support", "Phone"),
      value: CONTACT_INFO.phone,
      href: "tel:+251993132122",
      external: false,
    },
    {
      icon: <MessageCircle size={20} className="text-yellow-300" />,
      label: t("contact.whatsapp", "WhatsApp"),
      value: CONTACT_INFO.phone,
      href: CONTACT_INFO.whatsappUrl,
      external: true,
    },
    {
      icon: <Send size={20} className="text-yellow-300" />,
      label: t("contact.telegram", "Telegram"),
      value: CONTACT_INFO.telegramHandle,
      href: CONTACT_INFO.telegramUrl,
      external: true,
    },
    {
      icon: <MapPin size={20} className="text-yellow-300" />,
      label: t("contact.location", "Location"),
      value: CONTACT_INFO.address,
      href: CONTACT_INFO.mapLinkUrl,
      external: true,
    },
  ];

  const topics = [
    { value: "General Inquiry", label: t("contact.topic_general", "General Inquiry") },
    {
      value: "Product or Listing Question",
      label: t("contact.topic_bulk", "Product or Listing Question"),
    },
    { value: "Shopping Support", label: t("contact.topic_custom", "Shopping Support") },
    {
      value: "Seller & Partner Enquiry",
      label: t("contact.topic_wholesale", "Seller & Partner Enquiry"),
    },
    { value: "Partnerships", label: t("contact.topic_partnerships", "Partnerships") },
    { value: "Website Support", label: t("contact.topic_technical", "Website Support") },
    { value: "Other", label: t("contact.topic_other", "Other") },
  ];

  const mapEmbedUrl = resolveMapUrl(CONTACT_INFO.mapQueryUrl);

  return (
    <main className="min-h-screen bg-gray-50 py-12 pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-700">
            {t("contact.badge", "Get In Touch")}
          </span>
          <h1 className="mb-2 mt-3 text-4xl font-bold text-gray-900">
            {t("contact.title", "Let's Start a Conversation")}
          </h1>
          <p className="text-gray-600">
            {t(
              "contact.subtitle",
              "Have a project in mind? Want to join the academy? Or just want to say hi? We'd love to hear from you."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <aside className="space-y-8 rounded-2xl bg-gradient-to-br from-[#20283a] to-[#35415b] p-8 text-white shadow-md">
            <div>
              <h2 className="mb-2 text-2xl font-bold">
                {t("contact.info_title", "Contact Information")}
              </h2>
              <p className="text-sm text-yellow-200">
                {t("contact.info_subtitle", "Reach out to us through any of the channels below.")}
              </p>
            </div>

            <div className="space-y-6 text-sm">
              {channels.map((ch) => (
                <div key={ch.label} className="flex items-start gap-4">
                  <div className="rounded-xl bg-white/10 p-2.5">{ch.icon}</div>
                  <div>
                    <div className="font-semibold text-white">{ch.label}</div>
                    <a
                      href={ch.href}
                      {...(ch.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                    >
                      {ch.value}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm lg:col-span-2">
            {submitted ? (
              <div className="space-y-4 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t("contact.success_title", "Message Received!")}
                </h3>
                <p className="mx-auto max-w-md text-sm text-gray-500">
                  {t(
                    "contact.success_desc",
                    "Thank you for reaching out. Our support team will get back to you shortly."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-yellow-600"
                >
                  {t("contact.send_another", "Send Another Message")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {t("contact.form_title", "Send Us a Message")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {t(
                      "contact.signin_prompt",
                      "Sign in to prefill your details and send a message faster."
                    )}{" "}
                    <Link
                      href="/auth/signin?redirectTo=%2Fcontact"
                      className="font-semibold text-[#d75e18] hover:underline"
                    >
                      {t("contact.signin_link", "Sign in")}
                    </Link>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {t("contact.full_name", "Your Full Name *")}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Abebe Kebede"
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {t("contact.email_address", "Email Address *")}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {t("contact.phone_number", "Phone Number")}
                    </label>
                    <input
                      type="tel"
                      placeholder="+251 9XX XXX XXX"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {t("contact.inquiry_topic", "Inquiry Topic")}
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => updateField("subject", e.target.value)}
                      className={`${INPUT_CLASS} bg-white`}
                    >
                      {topics.map((tp) => (
                        <option key={tp.value} value={tp.value}>
                          {tp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    {t("contact.message", "Message *")}
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder={t(
                      "contact.message_placeholder",
                      "Tell us how we can help with your marketplace or shopping experience..."
                    )}
                    value={formData.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#EB6D3D] px-8 py-3 text-sm font-bold text-[#20283a] shadow-md transition-all hover:bg-[#cf5427] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t("contact.sending_btn", "Sending...")}
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {t("contact.send_btn", "Send Message")}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <MapPin size={20} className="text-yellow-600" />
              {t("contact.map_title", "Find Us on Map")}
            </h3>
            <a
              href={CONTACT_INFO.mapLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700 hover:underline"
            >
              Open in Google Maps
              <ExternalLink size={16} />
            </a>
          </div>
          <div className="relative h-[450px] w-full">
            <iframe
              src={mapEmbedUrl}
              className="h-full w-full"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map - Our Location"
            />
          </div>
        </div>
      </div>
    </main>
  );
}