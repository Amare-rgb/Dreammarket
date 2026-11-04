// app/contact/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Send,
  MessageCircle,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Map URL helpers
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MAP_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3939.9999!2d37.3861!3d11.5936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b8c5e5e5e5e5e%3A0x1234567890abcdef!2sBahir%20Dar%2C%20Ethiopia!5e0!3m2!1sen!2s!4v1700000000000';

function resolveMapUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_MAP_URL;

  const trimmed = raw.trim();

  const iframeMatch = trimmed.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  const candidate = iframeMatch ? iframeMatch[1].trim() : trimmed;

  if (!/^https?:\/\//i.test(candidate)) return DEFAULT_MAP_URL;

  const providers = [
    'google.com/maps',
    'maps.google.com',
    'openstreetmap.org',
    'bing.com/maps',
    'mapbox.com',
    'arcgis.com',
    '/maps/embed',
  ];

  const isMapProvider = providers.some((p) => candidate.includes(p));
  return isMapProvider ? candidate : DEFAULT_MAP_URL;
}

export default function ContactPage() {
  const { loading, error, forceUpdate, refetch } = useSettings();
  const { t } = useLanguage();

  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [isClient, setIsClient] = useState(false);
  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      requestAnimationFrame(() => {
        const savedUser =
          localStorage.getItem('user') || sessionStorage.getItem('user');

        if (savedUser) {
          try {
            const user = JSON.parse(savedUser) as {
              name?: string;
              email?: string;
              phone?: string;
            };
            setFormData((current) => ({
              ...current,
              name: user.name || current.name,
              email: user.email || current.email,
              phone: user.phone || current.phone,
            }));
          } catch (parseError) {
            console.error('Unable to load saved contact details:', parseError);
          }
        }

        setIsClient(true);
      });
    }
  }, []);

  useEffect(() => {
    const handleSettingsChange = () => {
      forceUpdate();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'site_settings' && e.newValue) {
        forceUpdate();
      }
    };

    window.addEventListener('settings-change', handleSettingsChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('settings-change', handleSettingsChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [forceUpdate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Settings loading timeout after 8 seconds - retrying...');
        refetch?.();
      }
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [loading, refetch]);

  const contactEmail = 'suport@dreammoredigitals.com';
  const contactPhone = '+251 993 132 122';
  const contactAddress = 'signal mall 8th floor ,Bahirdar, Ethiopia';
  const mapEmbedUrl = resolveMapUrl(
    'https://maps.google.com/maps?q=Bahirdar%2C%20Ethiopia&output=embed'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setSubmitted(true);
      toast.success(
        t(
          'contact.toast_success',
          'Thank you! Your message has been sent to our support team.'
        )
      );
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (error) {
      console.error('❌ Submit error:', error);
      toast.error(
        t('contact.toast_error', 'Failed to send message. Please try again.')
      );
    } finally {
      setSending(false);
    }
  };

  if (!isClient) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contact information...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {t('contact.error_title', 'Something went wrong')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t(
              'contact.error_desc',
              "We couldn't load the contact information. Please try again."
            )}
          </p>
          <button
            onClick={() => refetch?.()}
            className="px-6 py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
          >
            {t('contact.retry_btn', 'Retry')}
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {t('contact.loading_info', 'Loading contact information...')}
          </p>
          <button
            onClick={() => refetch?.()}
            className="mt-4 text-sm text-yellow-600 hover:text-yellow-700 underline"
          >
            {t('contact.loading_retry', 'Retry loading')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-yellow-700 uppercase tracking-wider bg-yellow-100 px-3 py-1 rounded-full">
            {t('contact.badge', 'Get In Touch')}
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mt-3 mb-2">
            {t('contact.title', "Let's Start a Conversation")}
          </h1>
          <p className="text-gray-600">
            {t(
              'contact.subtitle',
              "Have a project in mind? Want to join the academy? Or just want to say hi? We'd love to hear from you."
            )}
          </p>
        </div>

        {/* Top Section: Contact Details + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Details Card */}
          <div className="bg-gradient-to-br from-[#20283a] to-[#35415b] text-white rounded-2xl p-8 space-y-8 shadow-md">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {t('contact.info_title', 'Contact Information')}
              </h2>
              <p className="text-yellow-200 text-sm">
                {t(
                  'contact.info_subtitle',
                  'Reach out to us through any of the channels below.'
                )}
              </p>
            </div>

            <div className="space-y-6 text-sm">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Mail size={20} className="text-yellow-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">{t('contact.email', 'Email')}</div>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Phone size={20} className="text-yellow-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {t('contact.phone_support', 'Phone')}
                  </div>
                  <a
                    href="tel:+251993132122"
                    className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                  >
                    {contactPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <MessageCircle size={20} className="text-yellow-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">{t('contact.whatsapp', 'WhatsApp')}</div>
                  <a
                    href="https://wa.me/251993132122"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                  >
                    {contactPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Send size={20} className="text-yellow-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">{t('contact.telegram', 'Telegram')}</div>
                  <a
                    href="https://t.me/Dreammore21"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                  >
                    @Dreammore21
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <MapPin size={20} className="text-yellow-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">{t('contact.location', 'Location')}</div>
                  <a
                    href="https://maps.google.com/?q=Bahirdar,Ethiopia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-yellow-100 transition hover:text-yellow-300"
                  >
                    {contactAddress}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-8 border border-gray-200/80 shadow-sm">
            {submitted ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t('contact.success_title', 'Message Received!')}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                  {t(
                    'contact.success_desc',
                    'Thank you for reaching out. Our support team will get back to you shortly.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 bg-yellow-500 text-white rounded-xl text-sm font-semibold hover:bg-yellow-600 transition-colors"
                >
                  {t('contact.send_another', 'Send Another Message')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {t('contact.form_title', 'Send Us a Message')}
                </h2>
                <p className="text-sm text-gray-600">
                  {t(
                    'contact.signin_prompt',
                    'Sign in to prefill your details and send a message faster.'
                  )}{' '}
                  <Link
                    href="/auth/signin?redirectTo=%2Fcontact"
                    className="font-semibold text-[#d75e18] hover:underline"
                  >
                    {t('contact.signin_link', 'Sign in')}
                  </Link>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('contact.full_name', 'Your Full Name *')}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Abebe Kebede"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('contact.email_address', 'Email Address *')}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('contact.phone_number', 'Phone Number')}
                    </label>
                    <input
                      type="tel"
                      placeholder="+251 9XX XXX XXX"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('contact.inquiry_topic', 'Inquiry Topic')}
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none bg-white"
                    >
                      <option value="General Inquiry">
                        {t('contact.topic_general', 'General Inquiry')}
                      </option>
                      <option value="Product or Listing Question">
                        {t(                        'contact.topic_bulk', 'Product or Listing Question')}
                      </option>
                      <option value="Shopping Support">
                        {t('contact.topic_custom', 'Shopping Support')}
                      </option>
                      <option value="Seller & Partner Enquiry">
                        {t(
                          'contact.topic_wholesale',
                          'Seller & Partner Enquiry'
                        )}
                      </option>
                      <option value="Partnerships">
                        {t(
                          'contact.topic_partnerships',
                          'Partnerships'
                        )}
                      </option>
                      <option value="Website Support">
                        {t('contact.topic_technical', 'Website Support')}
                      </option>
                      <option value="Other">
                        {t('contact.topic_other', 'Other')}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t('contact.message', 'Message *')}
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder={t(
                      'contact.message_placeholder',
                      'Tell us how we can help with your marketplace or shopping experience...'
                    )}
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-[#EB6D3D] hover:bg-[#cf5427] text-[#20283a] hover:text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('contact.sending_btn', 'Sending...')}
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {t('contact.send_btn', 'Send Message')}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Google Map Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={20} className="text-yellow-600" />
                {t('contact.map_title', 'Find Us on Map')}
              </h3>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Bahir+Dar+Ethiopia"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-yellow-600 hover:text-yellow-700 hover:underline flex items-center gap-1"
              >
                Open in Google Maps
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
            <div className="relative w-full" style={{ height: '450px' }}>
              <iframe
                src={mapEmbedUrl}
                className="w-full h-full"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map - Our Location"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}