"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  Target,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const impactStats = [
  { value: "5+", label: "about.stat_years", fallback: "Years of Excellence" },
  { value: "30+", label: "about.stat_projects", fallback: "Projects Delivered" },
  { value: "150+", label: "about.stat_students", fallback: "Students Trained" },
  { value: "16+", label: "about.stat_courses", fallback: "Active Courses" },
];

const drivers = [
  {
    title: "about.mission_title",
    titleFallback: "Mission",
    description: "about.mission",
    descriptionFallback:
      "To empower Africa through digital innovation by building world-class products and training the next generation of creators.",
    Icon: Target,
  },
  {
    title: "about.vision_title",
    titleFallback: "Vision",
    description: "about.vision",
    descriptionFallback:
      "To become Africa's leading digital ecosystem — a hub where technology, education, and innovation converge.",
    Icon: Eye,
  },
  {
    title: "about.values_title",
    titleFallback: "Values",
    description: "about.values",
    descriptionFallback:
      "Excellence, integrity, community, and relentless pursuit of innovation in everything we do.",
    Icon: HeartHandshake,
  },
  {
    title: "about.impact_title",
    titleFallback: "Impact",
    description: "about.impact",
    descriptionFallback:
      "Transforming African businesses and empowering thousands of young professionals to compete globally.",
    Icon: Lightbulb,
  },
];

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden bg-[#20283a] px-5 py-20 text-center text-white sm:py-28">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#F47822]/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffad72]">
            {t("about.hero_eyebrow", "About DreamMore")}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            {t("about.hero_title", "We Are a Digital Innovation Ecosystem")}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
            {t(
              "about.hero_description",
              "DreamMore was founded with a bold vision: to bridge the gap between Africa's digital potential and the world-class technology needed to realize it."
            )}
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[#e86b25]">
              {t("about.story_eyebrow", "About DreamMore")}
            </p>
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              {t("about.story_title", "A collaborative team building a digital future")}
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              {t(
                "about.story_description",
                "DreamMore is a collaborative group of dynamic youth and active team members dedicated to education, digital marketing, and a wide range of tech-related services. We prioritize a client-centered approach, supported by our versatile service offerings and an unwavering commitment to quality."
              )}
            </p>
            <p className="mt-5 text-base leading-8 text-slate-600" lang="am">
              {t(
                "about.story_amharic",
                "ድሪም-ሞር የወጣትና የታታሪዎች ስብስብ ሲሆን በሀገራችን ላይ በትምህርቱ ዘርፍ፤ በድጂታል ማርኬቲንግ እና በሌሎች ቴክኖሎጂ ዘርፎች ስራዎች እና ሁለገብ ድጂታል ሃሳቦች ላይ በአንክሮ የሚሰራ ሩቅ አላሚ፤ ቀልጣፋ እና ዘመኑን የዋጁ ስራዎች ላይ የሚያተኩር ለሁሉም ደንበኞቻችን ፍላጎት ዋልታ እና የጋራ መድረክ የሆነ ሃገር በቀል ድርጅት ነው፡፡"
              )}
            </p>
            <p className="mt-5 text-base leading-7 text-slate-600">
              {t(
                "about.mission_statement",
                "Our mission is to deliver outstanding services tailored to the unique needs of each client, ensuring quality, efficiency, and innovation in every aspect of our work."
              )}
            </p>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t(
                "about.commitment",
                "At DreamMore, we are committed to excellence, innovation, and social impact. Our team of skilled professionals works tirelessly to deliver high-quality services that meet the unique needs of our clients."
              )}
            </p>
            <Link
              href="https://www.dreammoredigitals.com/team"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#F47822] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#df6417]"
            >
              {t("about.meet_team", "Meet Our Team")}
              <ArrowUpRight size={17} />
            </Link>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-[#20283a] to-[#35415b] p-7 text-white shadow-xl sm:p-9">
            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F47822]">
              <GraduationCap size={29} />
            </div>
            <h3 className="text-2xl font-bold">
              {t("about.education_title", "Education, technology, and opportunity")}
            </h3>
            <p className="mt-4 leading-7 text-white/70">
              {t(
                "about.education_description",
                "We bring together digital services and practical learning to help businesses grow and equip the next generation of African creators."
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50 px-5 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-7 md:grid-cols-4">
          {impactStats.map((stat) => (
            <div className="text-center" key={stat.label}>
              <p className="text-3xl font-bold text-[#e86b25] sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {t(stat.label, stat.fallback)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[#e86b25]">
              {t("about.drivers_eyebrow", "Our purpose")}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              {t("about.drivers_title", "What Drives Us")}
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {drivers.map(({ title, titleFallback, description, descriptionFallback, Icon }) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                key={title}
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#e86b25]">
                  <Icon size={22} />
                </div>
                <h3 className="text-lg font-bold">
                  {t(title, titleFallback)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {t(description, descriptionFallback)}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 font-semibold text-[#d75e18] transition hover:text-[#a8440d]"
            >
              {t("about.contact_us", "Get in touch")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
