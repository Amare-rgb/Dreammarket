// components/layout/Footer.tsx
"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/context/LanguageContext";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export const Footer = () => {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") || false;
  const { settings } = useSettings();
  const { t } = useLanguage();

  // Brand defaults
  const CONTACT_EMAIL = "suport@dreammoredigitals.com";
  const CONTACT_PHONE = "+251 993 132 122";
  const DEFAULT_ADDRESS = "Bahir Dar, Ethiopia";
  const DEFAULT_SITE_NAME = "Dream More Affiliate Market";
  const DEFAULT_SITE_DESCRIPTION = "RIGHT WORK AT RIGHT TIME";

  const mounted = useMounted();

  // Only use settings values after client-side mount
  const contactEmail = CONTACT_EMAIL;
  const contactPhone = CONTACT_PHONE;
  const contactAddress = mounted
    ? settings?.contactAddress || DEFAULT_ADDRESS
    : DEFAULT_ADDRESS;
  const siteName = mounted
    ? settings?.siteName || DEFAULT_SITE_NAME
    : DEFAULT_SITE_NAME;
  const siteDescription = mounted
    ? settings?.siteDescription || DEFAULT_SITE_DESCRIPTION
    : DEFAULT_SITE_DESCRIPTION;
  const enableWhatsApp = mounted ? settings?.enableWhatsApp || false : false;
  const whatsAppNumber = mounted ? settings?.whatsAppNumber || "" : "";

  if (isAdminRoute) {
    return null;
  }

  const currentYear = 2026;

  const renderContent = () => {
    const showDescription = mounted && siteDescription;

    return (
      <footer className="bg-[#20283a] text-white">
        <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] grid-cols-[2fr_1fr_1.4fr_1fr] gap-11 py-16 max-lg:grid-cols-3 max-sm:grid-cols-2">
          <div className="max-sm:col-span-2">
            <Link href="/" className="mb-5 flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white shadow-sm flex-shrink-0">
                <Image
                  src="/banners/photo.jpg"
                  alt={siteName}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </div>

              <span className="grid gap-[3px] leading-none">
                <strong className="text-[16px] tracking-[0.12em] font-serif text-white">
                  {siteName.toUpperCase()}
                </strong>
                {showDescription && (
                  <small className="text-[8px] tracking-[0.18em] text-white/60 line-clamp-1">
                    {siteDescription.toUpperCase()}
                  </small>
                )}
              </span>
            </Link>

            <p className="text-[11px] leading-[1.8] text-white/60">
              {t("footer.tagline_1", "Discover more. Shop with confidence.")}
              <br />
              {t(
                "footer.tagline_2",
                "A simpler way to find products from across the marketplace."
              )}
            </p>
          </div>

          {/* Explore column */}
          <div className="grid content-start gap-2">
            <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#F47822]">
              {t("footer.explore", "Explore")}
            </h4>

            <Link
              href="/#products"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {t("footer.our_products", "Our Products")}
            </Link>

            <Link
              href="/#facility"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {t("footer.our_facility", "Our Facility")}
            </Link>

            <Link
              href="/about"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {t("footer.about_us", "About Us")}
            </Link>

            <Link
              href="/shop"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {t("footer.shop", "Shop")}
            </Link>

            <Link
              href="/articles"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {t("nav.articles", "Articles")}
            </Link>
          </div>

          {/* Contact column */}
          <div className="grid content-start gap-2">
            <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#F47822]">
              {t("footer.contact", "Contact")}
            </h4>

            <a
              href={`mailto:${contactEmail}`}
              className="text-[11px] text-white/60 transition hover:text-white break-all"
            >
              {contactEmail}
            </a>

            <a
              href={`tel:${contactPhone.replace(/\s/g, "")}`}
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              {contactPhone}
            </a>

            {enableWhatsApp && whatsAppNumber && (
              <a
                href={`https://wa.me/${whatsAppNumber.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#e0a83c] transition hover:underline"
              >
                {t("footer.whatsapp_support", "WhatsApp Support ↗")}
              </a>
            )}

            <span className="text-[11px] text-white/60">
              {contactAddress}
            </span>
          </div>

          {/* Social column */}
          <div className="grid content-start gap-2">
            <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#e0a83c]">
              {t("footer.follow", "Follow")}
            </h4>

            <a
              href="#"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              Facebook
            </a>

            <a
              href="#"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              Instagram
            </a>

            <a
              href="#"
              className="text-[11px] text-white/60 transition hover:text-white"
            >
              Telegram
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mx-auto flex w-[min(1180px,calc(100%-48px))] justify-between border-t border-white/10 py-5 text-[9px] text-white/30 max-sm:flex-col max-sm:gap-2">
          <span>
            © {currentYear} {siteName}.{" "}
            {t("footer.all_rights_reserved", "All rights reserved.")}
          </span>

          <span>
            {t("footer.built_around", "A digital marketplace for discovering products.")}
          </span>
        </div>
      </footer>
    );
  };

  return renderContent();
};

export default Footer;