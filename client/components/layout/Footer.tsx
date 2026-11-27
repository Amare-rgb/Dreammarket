"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/context/LanguageContext";

const CONTACT_EMAIL = "suport@dreammoredigitals.com";
const CONTACT_PHONE = "+251 993 132 122";
const DEFAULT_ADDRESS = "Bahir Dar, Ethiopia";
const DEFAULT_SITE_NAME = "Dream More Affiliate Market";
const DEFAULT_SITE_DESCRIPTION = "RIGHT WORK AT RIGHT TIME";
const LINK_CLS = "text-[11px] text-white/60 transition hover:text-white";

const EXPLORE_LINKS = [
  { href: "/#products", key: "footer.our_products", fallback: "Our Products" },
  { href: "/#facility", key: "footer.our_facility", fallback: "Our Facility" },
  { href: "/about", key: "footer.about_us", fallback: "About Us" },
  { href: "/shop", key: "footer.shop", fallback: "Shop" },
  { href: "/articles", key: "nav.articles", fallback: "Articles" },
] as const;

const SOCIAL_LINKS = ["Facebook", "Instagram", "Telegram"] as const;

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export function Footer() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { t } = useLanguage();
  const mounted = useMounted();

  if (pathname?.startsWith("/admin")) return null;

  const siteName = mounted ? settings?.siteName || DEFAULT_SITE_NAME : DEFAULT_SITE_NAME;
  const siteDescription = mounted ? settings?.siteDescription || DEFAULT_SITE_DESCRIPTION : DEFAULT_SITE_DESCRIPTION;
  const contactAddress = mounted ? settings?.contactAddress || DEFAULT_ADDRESS : DEFAULT_ADDRESS;
  const whatsAppDigits = mounted && settings?.enableWhatsApp && settings?.whatsAppNumber
    ? settings.whatsAppNumber.replace(/[^0-9]/g, "")
    : "";

  return (
    <footer className="bg-[#20283a] text-white">
      <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] grid-cols-[2fr_1fr_1.4fr_1fr] gap-11 py-16 max-lg:grid-cols-3 max-sm:grid-cols-2">
        <div className="max-sm:col-span-2">
          <Link href="/" className="mb-5 flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white shadow-sm">
              <Image src="/banners/photo.jpg" alt={siteName} width={48} height={48} className="h-full w-full object-contain" />
            </div>
            <span className="grid gap-[3px] leading-none">
              <strong className="font-serif text-[16px] tracking-[0.12em] text-white">{siteName.toUpperCase()}</strong>
              {mounted && siteDescription && (
                <small className="line-clamp-1 text-[8px] tracking-[0.18em] text-white/60">{siteDescription.toUpperCase()}</small>
              )}
            </span>
          </Link>
          <p className="text-[11px] leading-[1.8] text-white/60">
            {t("footer.tagline_1", "Discover more. Shop with confidence.")}
            <br />
            {t("footer.tagline_2", "A simpler way to find products from across the marketplace.")}
          </p>
        </div>

        <div className="grid content-start gap-2">
          <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#F47822]">
            {t("footer.explore", "Explore")}
          </h4>
          {EXPLORE_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={LINK_CLS}>
              {t(item.key, item.fallback)}
            </Link>
          ))}
        </div>

        <div className="grid content-start gap-2">
          <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#F47822]">
            {t("footer.contact", "Contact")}
          </h4>
          <a href={`mailto:${CONTACT_EMAIL}`} className={`${LINK_CLS} break-all`}>
            {CONTACT_EMAIL}
          </a>
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`} className={LINK_CLS}>
            {CONTACT_PHONE}
          </a>
          {whatsAppDigits && (
            <a href={`https://wa.me/${whatsAppDigits}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#e0a83c] transition hover:underline">
              {t("footer.whatsapp_support", "WhatsApp Support ↗")}
            </a>
          )}
          <span className="text-[11px] text-white/60">{contactAddress}</span>
        </div>

        <div className="grid content-start gap-2">
          <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#e0a83c]">
            {t("footer.follow", "Follow")}
          </h4>
          {SOCIAL_LINKS.map((label) => (
            <a key={label} href="#" className={LINK_CLS}>
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-[min(1180px,calc(100%-48px))] justify-between border-t border-white/10 py-5 text-[9px] text-white/30 max-sm:flex-col max-sm:gap-2">
        <span>
          © 2026 {siteName}. {t("footer.all_rights_reserved", "All rights reserved.")}
        </span>
        <span>{t("footer.built_around", "A digital marketplace for discovering products.")}</span>
      </div>
    </footer>
  );
}

export default Footer;