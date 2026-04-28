import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { xtOutlineBtn, xtPrimaryBtn } from "./brandTheme";

type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

type LegalItem = {
  label: string;
  value: string;
  subtext?: string;
};

function Icon({
  name,
}: {
  name: "people" | "store" | "map" | "shield" | "case" | "chat";
}) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "people":
      return (
        <svg {...common}>
          <path {...stroke} d="M16 11a4 4 0 1 0-8 0" />
          <path {...stroke} d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
          <path {...stroke} d="M8 11a4 4 0 1 1 8 0" opacity="0.18" />
        </svg>
      );
    case "store":
      return (
        <svg {...common}>
          <path {...stroke} d="M3 10l2-6h14l2 6" />
          <path {...stroke} d="M5 10v10h14V10" />
          <path {...stroke} d="M9 20v-6h6v6" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 21s7-5 7-11a7 7 0 0 0-14 0c0 6 7 11 7 11Z" />
          <path {...stroke} d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3l8 4v6c0 5-3.4 9.1-8 10-4.6-.9-8-5-8-10V7l8-4Z" />
          <path {...stroke} d="M9 12l2 2 4-5" />
        </svg>
      );
    case "case":
      return (
        <svg {...common}>
          <path {...stroke} d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
          <path {...stroke} d="M4 7h16v13H4V7Z" />
          <path {...stroke} d="M4 12h16" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path {...stroke} d="M21 14a4 4 0 0 1-4 4H9l-4 3v-3a4 4 0 0 1-2-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z" />
          <path {...stroke} d="M7.5 9.5h9" />
          <path {...stroke} d="M7.5 12.5h6.5" />
        </svg>
      );
  }
}

function SectionTitle({ kicker, title, desc }: { kicker?: string; title: string; desc?: string }) {
  return (
    <div className="xt-about-title">
      {kicker ? <div className="xt-about-kicker">{kicker}</div> : null}
      <h2 className="xt-about-h2">{title}</h2>
      {desc ? <p className="xt-about-desc">{desc}</p> : null}
    </div>
  );
}

function StatCard({ item, icon }: { item: StatItem; icon: ReactNode }) {
  return (
    <div className="xt-about-card xt-about-card--stat">
      <div className="xt-about-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="xt-about-card__value">{item.value}</div>
      <div className="xt-about-card__label">{item.label}</div>
      {item.hint ? <div className="xt-about-card__hint">{item.hint}</div> : null}
    </div>
  );
}

function LegalRow({ item }: { item: LegalItem }) {
  return (
    <div className="xt-about-legal-row">
      <div className="xt-about-legal-row__label">{item.label}</div>
      <div className="xt-about-legal-row__value">
        <div>{item.value}</div>
        {item.subtext ? <div className="xt-about-legal-row__sub">{item.subtext}</div> : null}
      </div>
    </div>
  );
}

function AnchorNav({
  items,
  onJump,
}: {
  items: Array<{ id: string; label: string }>;
  onJump: (id: string) => void;
}) {
  return (
    <nav className="xt-about-nav" aria-label="About page navigation">
      <div className="xt-about-nav__inner">
        {items.map((it) => (
          <a
            key={it.id}
            className="xt-about-nav__link"
            href={`#${it.id}`}
            onClick={(e) => {
              e.preventDefault();
              onJump(it.id);
            }}
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function AboutUsPage() {
  const navItems = useMemo(
    () => [
      { id: "company", label: "Company" },
      { id: "values", label: "Mission & Values" },
      { id: "credentials", label: "Credentials" },
      { id: "cases", label: "Cases" },
      { id: "contact", label: "Contact" },
      { id: "pdpa", label: "PDPA" },
    ],
    [],
  );

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.history.replaceState(null, "", `#${id}`);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const stats: StatItem[] = [
    { label: "Creators in our network", value: "1,000+", hint: "TikTok-focused creator pool (placeholder)" },
    { label: "Brands & merchants served", value: "200+", hint: "Cross-border eCommerce & local SMEs (placeholder)" },
    { label: "Regions covered", value: "Thailand · SEA", hint: "Bangkok and major provinces (placeholder)" },
    { label: "Collaboration formats", value: "UGC · Live · Video", hint: "Transparent workflow & deliverables" },
  ];

  const legal: LegalItem[] = [
    { label: "Registered Entity / นิติบุคคล", value: "Xiangtai International Co., Ltd. (Placeholder)", subtext: "บริษัท เซียงไท อินเตอร์เนชั่นแนล จำกัด (ตัวอย่าง)" },
    { label: "Registration No. / เลขทะเบียน", value: "TH-XXXXXX (Placeholder)" },
    { label: "Incorporation Date / วันที่จดทะเบียน", value: "YYYY-MM-DD (Placeholder)" },
    { label: "Business Type / ประเภทธุรกิจ", value: "Influencer distribution & digital marketing services (Placeholder)", subtext: "บริการจัดหาครีเอเตอร์และการตลาดดิจิทัล (ตัวอย่าง)" },
    { label: "Office Address / ที่อยู่สำนักงาน", value: "Bangkok, Thailand (Placeholder)", subtext: "กรุงเทพฯ ประเทศไทย (ตัวอย่าง)" },
  ];

  const lineOfficialUrl = "https://lin.ee/XXXXXXX";
  const supportEmail = "support@example.com";
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Bangkok%20Thailand";

  return (
    <div className="xt-about-page">
      <AnchorNav items={navItems} onJump={jumpTo} />

      <header className="xt-about-hero">
        <div className="xt-about-hero__inner">
          <div className="xt-about-hero__copy">
            <div className="xt-about-hero__brand">
              <BrandLogo height={44} />
              <div className="xt-about-hero__brandtext">
                <div className="xt-about-hero__brandname">湘泰国际达人分发系统</div>
                <div className="xt-about-hero__brandsub">Xiangtai International Influencer Distribution</div>
              </div>
            </div>
            <h1 className="xt-about-h1">A compliant, transparent collaboration network for creators and merchants.</h1>
            <p className="xt-about-lead">
              We help brands run TikTok-first campaigns with clear deliverables, accountable workflows, and privacy-first data handling in Thailand.
            </p>
            <div className="xt-about-hero__cta">
              <button
                type="button"
                style={{ ...xtPrimaryBtn, padding: "10px 18px", borderRadius: 10 }}
                onClick={() => jumpTo("contact")}
              >
                Contact us on LINE
              </button>
              <button
                type="button"
                style={{ ...xtOutlineBtn, padding: "10px 18px", borderRadius: 10 }}
                onClick={() => jumpTo("credentials")}
              >
                View compliance info
              </button>
              <a className="xt-about-btn xt-about-btn--ghost" href="/login">
                Enter system
              </a>
            </div>
            <div className="xt-about-hero__trust">
              <div className="xt-about-pill">
                <span className="xt-about-pill__icon" aria-hidden="true">
                  <Icon name="shield" />
                </span>
                PDPA-ready data protection
              </div>
              <div className="xt-about-pill">
                <span className="xt-about-pill__icon" aria-hidden="true">
                  <Icon name="case" />
                </span>
                Transparent collaboration records
              </div>
              <div className="xt-about-pill">
                <span className="xt-about-pill__icon" aria-hidden="true">
                  <Icon name="people" />
                </span>
                Creator-centric operations
              </div>
            </div>
          </div>

          <div className="xt-about-hero__media" aria-label="Office / team photo placeholder">
            <div className="xt-about-photo xt-about-photo--hero">
              <div className="xt-about-photo__badge">Office / Team Photo</div>
              <div className="xt-about-photo__caption">Replace with real shots of your Bangkok office and team.</div>
            </div>
          </div>
        </div>
      </header>

      <main className="xt-about-main">
        <section id="company" className="xt-about-section">
          <div className="xt-about-grid xt-about-grid--split">
            <div className="xt-about-grid__text">
              <SectionTitle
                kicker="Company"
                title="Who we are"
                desc="A Thailand-focused influencer distribution and TikTok collaboration team built to help creators and merchants work with confidence."
              />
              <div className="xt-about-prose">
                <p>
                  Xiangtai International connects creators with merchants through standardized collaboration processes: clear task definitions, transparent review rules, and trackable delivery records.
                </p>
                <p>
                  Our core scope includes influencer distribution, TikTok video collaborations, UGC content production coordination, and campaign operations support.
                </p>
              </div>
            </div>
            <div className="xt-about-grid__media">
              <div className="xt-about-photo xt-about-photo--alt">
                <div className="xt-about-photo__badge">Team Photo</div>
                <div className="xt-about-photo__caption">Add team or workspace real photos here.</div>
              </div>
            </div>
          </div>
        </section>

        <section id="values" className="xt-about-section">
          <div className="xt-about-grid xt-about-grid--split xt-about-grid--reverse">
            <div className="xt-about-grid__text">
              <SectionTitle
                kicker="Mission & Values"
                title="Built for creators, designed for trust"
                desc="We operate with a creator-first mindset while keeping collaboration transparent and compliant."
              />
              <div className="xt-about-values">
                <div className="xt-about-value">
                  <div className="xt-about-value__head">Mission</div>
                  <div className="xt-about-value__body">Support creators and merchants to collaborate efficiently with clear expectations and fair settlement.</div>
                </div>
                <div className="xt-about-value">
                  <div className="xt-about-value__head">Vision</div>
                  <div className="xt-about-value__body">Become a trusted Thailand & SEA collaboration network for TikTok-first commerce.</div>
                </div>
                <div className="xt-about-value">
                  <div className="xt-about-value__head">Core principles</div>
                  <div className="xt-about-value__body">Transparency, privacy-first operations, and accountable delivery.</div>
                </div>
              </div>
            </div>
            <div className="xt-about-grid__media">
              <div className="xt-about-photo xt-about-photo--alt2">
                <div className="xt-about-photo__badge">Office Photo</div>
                <div className="xt-about-photo__caption">Use a real office photo to strengthen credibility.</div>
              </div>
            </div>
          </div>
        </section>

        <section id="credentials" className="xt-about-section">
          <SectionTitle
            kicker="Credentials"
            title="Business proof & compliance"
            desc="Key operational metrics and Thailand business information for credibility and compliance."
          />

          <div className="xt-about-stats">
            <StatCard item={stats[0]} icon={<Icon name="people" />} />
            <StatCard item={stats[1]} icon={<Icon name="store" />} />
            <StatCard item={stats[2]} icon={<Icon name="map" />} />
            <StatCard item={stats[3]} icon={<Icon name="case" />} />
          </div>

          <div className="xt-about-legal">
            <div className="xt-about-legal__title">
              <span className="xt-about-legal__icon" aria-hidden="true">
                <Icon name="shield" />
              </span>
              Thailand compliance information (ต้องสอดคล้องกับข้อมูลที่จดทะเบียนจริง)
            </div>
            <div className="xt-about-legal__grid">
              {legal.map((item) => (
                <LegalRow key={item.label} item={item} />
              ))}
            </div>
            <div className="xt-about-legal__foot">
              If you need a downloadable company certificate or official documents, please contact our support team.
            </div>
          </div>
        </section>

        <section id="cases" className="xt-about-section">
          <SectionTitle
            kicker="Cases"
            title="Customer feedback & collaboration examples"
            desc="Reserved slots — add real quotes, logos, and case summaries later."
          />
          <div className="xt-about-cases">
            <div className="xt-about-card xt-about-card--case">
              <div className="xt-about-card__casehead">
                <span className="xt-about-card__icon" aria-hidden="true">
                  <Icon name="case" />
                </span>
                Case Placeholder 01
              </div>
              <div className="xt-about-card__casetext">
                Add a brief description: campaign goal, creator type, deliverables, and outcome.
              </div>
            </div>
            <div className="xt-about-card xt-about-card--case">
              <div className="xt-about-card__casehead">
                <span className="xt-about-card__icon" aria-hidden="true">
                  <Icon name="case" />
                </span>
                Case Placeholder 02
              </div>
              <div className="xt-about-card__casetext">Add real customer feedback, screenshots, or a short quote.</div>
            </div>
            <div className="xt-about-card xt-about-card--case">
              <div className="xt-about-card__casehead">
                <span className="xt-about-card__icon" aria-hidden="true">
                  <Icon name="case" />
                </span>
                Case Placeholder 03
              </div>
              <div className="xt-about-card__casetext">Reserve for future partner logos and testimonials.</div>
            </div>
          </div>
        </section>

        <section id="contact" className="xt-about-section">
          <div className="xt-about-grid xt-about-grid--split">
            <div className="xt-about-grid__text">
              <SectionTitle
                kicker="Contact"
                title="Talk to us"
                desc="Official LINE channel, customer support entry, and office location details."
              />

              <div className="xt-about-contact">
                <div className="xt-about-contact__row">
                  <div className="xt-about-contact__label">
                    <span className="xt-about-contact__icon" aria-hidden="true">
                      <Icon name="chat" />
                    </span>
                    LINE Official Account
                  </div>
                  <a className="xt-about-link" href={lineOfficialUrl} target="_blank" rel="noreferrer">
                    {lineOfficialUrl}
                  </a>
                </div>
                <div className="xt-about-contact__row">
                  <div className="xt-about-contact__label">
                    <span className="xt-about-contact__icon" aria-hidden="true">
                      <Icon name="chat" />
                    </span>
                    Customer Support Email
                  </div>
                  <a className="xt-about-link" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                </div>
                <div className="xt-about-contact__row">
                  <div className="xt-about-contact__label">
                    <span className="xt-about-contact__icon" aria-hidden="true">
                      <Icon name="map" />
                    </span>
                    Office Address
                  </div>
                  <div className="xt-about-contact__text">
                    Bangkok, Thailand (Placeholder)
                    <div className="xt-about-contact__sub">กรุงเทพฯ ประเทศไทย (ตัวอย่าง)</div>
                  </div>
                </div>
              </div>

              <div className="xt-about-contact__cta">
                <a
                  className="xt-about-btn xt-about-btn--primary"
                  href={lineOfficialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chat on LINE
                </a>
                <a className="xt-about-btn xt-about-btn--ghost" href={mapsUrl} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              </div>
            </div>

            <div className="xt-about-grid__media">
              <a className="xt-about-map" href={mapsUrl} target="_blank" rel="noreferrer" aria-label="Map placeholder">
                <div className="xt-about-map__inner">
                  <div className="xt-about-map__title">Map Placeholder</div>
                  <div className="xt-about-map__desc">Replace with embedded map later, or keep as an external link.</div>
                </div>
              </a>
            </div>
          </div>
        </section>

        <section id="pdpa" className="xt-about-section">
          <SectionTitle
            kicker="Compliance & Privacy"
            title="PDPA policy entry & privacy commitment"
            desc="A clear statement for Thailand users to build trust and support compliance needs."
          />

          <div className="xt-about-pdpa">
            <div className="xt-about-pdpa__card">
              <div className="xt-about-pdpa__head">
                <span className="xt-about-pdpa__icon" aria-hidden="true">
                  <Icon name="shield" />
                </span>
                PDPA (Personal Data Protection Act)
              </div>
              <div className="xt-about-pdpa__body">
                We follow privacy-first practices and use creator data only for collaboration operations and service fulfillment. We do not sell, rent, or trade creators’ personal data or creative works to third parties without a lawful basis.
              </div>
              <div className="xt-about-pdpa__actions">
                <a className="xt-about-link" href={`mailto:${supportEmail}?subject=PDPA%20Request`}>
                  Request PDPA policy / ขอรับนโยบาย PDPA
                </a>
                <span className="xt-about-pdpa__sep" aria-hidden="true">
                  ·
                </span>
                <a className="xt-about-link" href={`mailto:${supportEmail}?subject=Data%20Request`}>
                  Data access / deletion request
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="xt-about-footer">
          <div className="xt-about-footer__inner">
            <div className="xt-about-footer__brand">
              <BrandLogo height={34} />
              <div>
                <div className="xt-about-footer__name">湘泰国际达人分发系统</div>
                <div className="xt-about-footer__sub">Built for trust · Thailand market ready</div>
              </div>
            </div>
            <div className="xt-about-footer__links">
              {navItems.map((it) => (
                <button key={it.id} type="button" className="xt-about-footer__link" onClick={() => jumpTo(it.id)}>
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
