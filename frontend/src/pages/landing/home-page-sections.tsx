import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";

import { LogoIcon } from "@/components/LogoIcon";
import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";

import {
  ArchitectureStackVisual,
  AssignmentMatrixVisual,
  BadgeOrbit,
  CommandFlowVisual,
  FinalSystemVisual,
  GovernanceVisual,
  HeroOperatingConsole,
  LocalRuntimeVisual,
  ProductOperatingConsole,
  ScenarioTimelineVisual,
  SystemComparisonVisual,
  TechnicalSignalGrid,
  TelemetryRibbon,
  WorkGraphVisual,
  WorkspaceMemoryVisual,
} from "./home-page-visuals";
import {
  capabilityModules,
  comparisonRows,
  finalCtaSignals,
  footerGroups,
  governanceItems,
  heroMetrics,
  homeNavItems,
  microCopy,
  operatingPrinciples,
  proofStats,
  qualityChecklist,
  scenarioTimeline,
  sectionKpis,
  semanticSectionIds,
  technicalSignals,
  trustLayers,
  useCases,
} from "./home-page-data";

interface LandingNavProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  publicRegistrationEnabled: boolean | null;
  navSolid: boolean;
}

interface CtaProps {
  publicRegistrationEnabled: boolean | null;
  className?: string;
}

function SectionHeader({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`home-os-section-header home-os-section-header--${align}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function RegistrationCta({ publicRegistrationEnabled, className }: CtaProps) {
  if (publicRegistrationEnabled === false) {
    return (
      <Button className={className} asChild>
        <Link to="/login">Sign in to workspace</Link>
      </Button>
    );
  }
  return (
    <Button className={className} asChild>
      <Link to="/register">{microCopy.primaryCta}</Link>
    </Button>
  );
}

function AnchorButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={`home-os-anchor-button ${className}`} href={href}>
      {children}
    </a>
  );
}

export function LandingNav({
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
  publicRegistrationEnabled,
  navSolid,
}: LandingNavProps) {
  return (
    <header className={`home-os-nav ${navSolid ? "home-os-nav--solid" : ""}`}>
      <a className="home-os-skip-link" href="#home-os-main">
        Skip to main content
      </a>
      <div className="home-os-nav__inner">
        <a className="home-os-brand" href="#top" aria-label="Mythforge Home Page">
          <LogoIcon aria-hidden="true" />
          <span>{microCopy.productName}</span>
        </a>
        <nav className="home-os-nav__links" aria-label="Home Page navigation">
          {homeNavItems.map((item) => (
            <a key={item.href} href={item.href} title={item.detail}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="home-os-nav__actions">
          <ModeToggle />
          <Button variant="ghost" asChild>
            <Link to="/login">{microCopy.signIn}</Link>
          </Button>
          <RegistrationCta
            publicRegistrationEnabled={publicRegistrationEnabled}
          />
          <button
            className="home-os-nav__menu"
            type="button"
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            onClick={onToggleMobile}
          >
            {mobileOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div
          className="home-os-mobile-nav"
          role="dialog"
          aria-label="Mobile landing navigation"
        >
          {homeNavItems.map((item) => (
            <a key={item.href} href={item.href} onClick={onCloseMobile}>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </a>
          ))}
          <div className="home-os-mobile-nav__actions">
            <Button variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <RegistrationCta
              publicRegistrationEnabled={publicRegistrationEnabled}
            />
          </div>
        </div>
      )}
    </header>
  );
}

export function HeroSection({ publicRegistrationEnabled }: CtaProps) {
  return (
    <section
      className="home-os-hero"
      id="top"
      aria-labelledby="home-os-hero-title"
    >
      <div className="home-os-hero__background" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="home-os-container home-os-hero__grid">
        <div className="home-os-hero__content">
          <div className="home-os-eyebrow">
            <span />
            {microCopy.eyebrow}
          </div>
          <h1 id="home-os-hero-title">{microCopy.heroTitle}</h1>
          <p className="home-os-hero__lead">{microCopy.heroBody}</p>
          <div className="home-os-hero__actions">
            <RegistrationCta
              publicRegistrationEnabled={publicRegistrationEnabled}
              className="home-os-primary-cta"
            />
            <AnchorButton
              href="#command-flow"
              className="home-os-secondary-cta"
            >
              {microCopy.secondaryCta}
            </AnchorButton>
          </div>
          <p className="home-os-hero__trust">{microCopy.privacyLine}</p>
          <div
            className="home-os-hero__metrics"
            aria-label="Product positioning metrics"
          >
            {heroMetrics.map((metric) => (
              <article
                key={metric.label}
                className={`home-os-hero-metric home-os-hero-metric--${metric.tone}`}
              >
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <HeroOperatingConsole />
      </div>
      <TelemetryRibbon />
    </section>
  );
}

export function OperatingSystemSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.product}
      aria-labelledby="home-os-product-title"
    >
      <div className="home-os-container home-os-split home-os-split--wide">
        <div>
          <SectionHeader
            eyebrow="Product operating model"
            title="The Home Page now sells a system, not a prettier task list."
            body="The new landing experience frames Mythforge as a commandable operations layer where memory, graph intelligence, assignment reasoning and local AI control work together."
          />
          <div className="home-os-principles">
            {operatingPrinciples.map((principle) => {
              const Icon = principle.icon;
              return (
                <article
                  key={principle.title}
                  className="home-os-principle-card"
                >
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{principle.title}</strong>
                    <p>{principle.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <ProductOperatingConsole />
      </div>
    </section>
  );
}

export function IntelligenceModulesSection() {
  return (
    <section
      className="home-os-section home-os-section--dense"
      id={semanticSectionIds.intelligence}
      aria-labelledby="home-os-intelligence-title"
    >
      <div className="home-os-container">
        <SectionHeader
          align="center"
          eyebrow="Connected intelligence"
          title="Six product engines, one operating rhythm."
          body="The page avoids generic AI claims and makes every module visible as part of a real project operations workflow."
        />
        <div className="home-os-capability-grid">
          {capabilityModules.map((module) => {
            const Icon = module.icon;
            return (
              <article
                key={module.title}
                className={`home-os-capability-card home-os-capability-card--${module.accent}`}
              >
                <div className="home-os-capability-card__top">
                  <Icon aria-hidden="true" />
                  <span>{module.eyebrow}</span>
                </div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <div className="home-os-capability-card__proof">
                  <strong>{module.stat}</strong>
                  <span>{module.proof}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CommandOutcomeSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.commandFlow}
      aria-labelledby="home-os-command-title"
    >
      <div className="home-os-container home-os-split">
        <div>
          <SectionHeader
            eyebrow="Command to outcome"
            title="Ask the workspace, approve the plan, execute with traceability."
            body="The new Home Page explains the central AI loop: a command is interpreted, grounded, modeled against dependencies, routed by capacity and held for approval before execution."
          />
          <div className="home-os-proof-strip">
            {proofStats.map((stat) => (
              <article key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <p>{stat.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <CommandFlowVisual />
      </div>
    </section>
  );
}

export function WorkspaceMemorySection() {
  return (
    <section
      className="home-os-section home-os-section--memory"
      id={semanticSectionIds.workspaceMemory}
      aria-labelledby="home-os-memory-title"
    >
      <div className="home-os-container">
        <SectionHeader
          align="center"
          eyebrow="Workspace memory"
          title="Ground answers in the work your team already created."
          body="Documents, task threads, comments and project signals become retrievable memory so AI output can show evidence instead of pretending certainty."
        />
        <WorkspaceMemoryVisual />
      </div>
    </section>
  );
}

export function WorkGraphSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.workGraph}
      aria-labelledby="home-os-graph-title"
    >
      <div className="home-os-container home-os-split home-os-split--reverse">
        <WorkGraphVisual />
        <div>
          <SectionHeader
            eyebrow="Work Graph"
            title="Move from flat tasks to dependency intelligence."
            body="The new visual language shows tasks, documents, blockers and risks as connected project structure, making hidden impact visible before teams commit to a plan."
          />
          <div className="home-os-kpi-grid">
            {sectionKpis.map((kpi) => (
              <article key={kpi.label}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <p>{kpi.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AssignmentSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.assignment}
      aria-labelledby="home-os-assignment-title"
    >
      <div className="home-os-container home-os-split">
        <div>
          <SectionHeader
            eyebrow="Assignment intelligence"
            title="Route work by capacity, context and confidence."
            body="The rewritten Home Page makes assignment recommendation a product differentiator: the UI explains why an owner is suggested before anyone accepts the change."
          />
          <SystemComparisonVisual rows={comparisonRows} />
        </div>
        <AssignmentMatrixVisual />
      </div>
    </section>
  );
}

export function LocalRuntimeSection() {
  return (
    <section
      className="home-os-section home-os-section--privacy"
      id={semanticSectionIds.privacy}
      aria-labelledby="home-os-runtime-title"
    >
      <div className="home-os-container home-os-split home-os-split--reverse">
        <LocalRuntimeVisual />
        <div>
          <SectionHeader
            eyebrow="Local AI runtime"
            title="Run sensitive project intelligence where your team controls it."
            body="Ollama, local-only mode, embedding model readiness and cloud fallback status are elevated into the landing story so privacy is visible before signup."
          />
          <BadgeOrbit />
        </div>
      </div>
    </section>
  );
}

export function GovernanceSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.governance}
      aria-labelledby="home-os-governance-title"
    >
      <div className="home-os-container home-os-split">
        <div>
          <SectionHeader
            eyebrow="Governance"
            title="AI can move fast without hiding the decision path."
            body="The Home Page positions approval, auditability, runtime visibility and permission boundaries as product strengths for serious B2B teams."
          />
          <div className="home-os-governance-grid">
            {governanceItems.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="home-os-governance-card">
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <span>{item.evidence}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <GovernanceVisual />
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section
      className="home-os-section home-os-section--use-cases"
      id={semanticSectionIds.useCases}
      aria-labelledby="home-os-use-cases-title"
    >
      <div className="home-os-container">
        <SectionHeader
          align="center"
          eyebrow="Use cases"
          title="Built for teams that need AI to operate work, not decorate it."
          body="The page now speaks directly to B2B buyers who care about delivery speed, traceability, privacy and operational control."
        />
        <div className="home-os-use-case-grid">
          {useCases.map((useCase) => (
            <article key={useCase.name} className="home-os-use-case-card">
              <span>{useCase.audience}</span>
              <h3>{useCase.name}</h3>
              <p>{useCase.description}</p>
              <div>
                {useCase.workflows.map((workflow) => (
                  <small key={workflow}>{workflow}</small>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScenarioSection() {
  return (
    <section
      className="home-os-section home-os-section--scenario"
      aria-labelledby="home-os-scenario-title"
    >
      <div className="home-os-container home-os-split home-os-split--reverse">
        <ScenarioTimelineVisual items={scenarioTimeline} />
        <div>
          <SectionHeader
            eyebrow="Why now"
            title="AI tools are everywhere, but operations are still scattered."
            body="The new Home Page answers the strategic question: why this product should exist now. Teams need AI that understands the work graph, respects approvals and carries context forward."
          />
          <div className="home-os-scenario-copy">
            <p>
              Generic copilots can draft text. Mythforge is positioned as the
              operational layer that connects a request to workspace memory,
              graph pressure, assignment reasoning and runtime control.
            </p>
            <p>
              That difference matters for teams selling services, shipping
              software, managing PMO risk or protecting sensitive client
              context.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ArchitectureTrustSection() {
  return (
    <section
      className="home-os-section"
      id={semanticSectionIds.architecture}
      aria-labelledby="home-os-architecture-title"
    >
      <div className="home-os-container home-os-split">
        <div>
          <SectionHeader
            eyebrow="Architecture trust"
            title="A premium landing experience without backend contract drift."
            body="This rewrite keeps the public route and registration logic compatible while replacing old screenshot-based marketing with code-native, deployable product visuals."
          />
          <div className="home-os-trust-layers">
            {trustLayers.map((layer) => (
              <article key={layer.label} className="home-os-trust-layer">
                <strong>{layer.label}</strong>
                <p>{layer.description}</p>
                <div>
                  {layer.checks.map((check) => (
                    <span key={check}>{check}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        <ArchitectureStackVisual />
      </div>
    </section>
  );
}

export function TechnicalQualitySection() {
  return (
    <section
      className="home-os-section home-os-section--quality"
      aria-labelledby="home-os-quality-title"
    >
      <div className="home-os-container">
        <SectionHeader
          align="center"
          eyebrow="Implementation quality"
          title="The rewrite is designed as production frontend, not landing-page filler."
          body="The final Home Page splits content, visuals, section composition and scoped CSS so the new experience can evolve without becoming another monolithic marketing file."
        />
        <TechnicalSignalGrid items={technicalSignals} />
        <div
          className="home-os-quality-checklist"
          aria-label="Home Page rewrite quality checklist"
        >
          {qualityChecklist.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({ publicRegistrationEnabled }: CtaProps) {
  return (
    <section
      className="home-os-final"
      id={semanticSectionIds.launch}
      aria-labelledby="home-os-final-title"
    >
      <div className="home-os-container home-os-final__grid">
        <div>
          <span className="home-os-eyebrow">
            <i /> Launch the operating layer
          </span>
          <h2 id="home-os-final-title">{microCopy.finalTitle}</h2>
          <p>{microCopy.finalBody}</p>
          <div className="home-os-final__actions">
            <RegistrationCta
              publicRegistrationEnabled={publicRegistrationEnabled}
              className="home-os-primary-cta"
            />
            <Button variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
        <FinalSystemVisual signals={finalCtaSignals} />
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="home-os-footer">
      <div className="home-os-container home-os-footer__grid">
        <div className="home-os-footer__brand">
          <a className="home-os-brand" href="#top">
            <LogoIcon aria-hidden="true" />
            <span>{microCopy.productName}</span>
          </a>
          <p>
            AI-native project operations with grounded memory, graph-aware
            execution and local runtime control.
          </p>
        </div>
        {footerGroups.map((group) => (
          <nav key={group.title} aria-label={`${group.title} links`}>
            <strong>{group.title}</strong>
            {group.links.map((link) =>
              link.href.startsWith("/") ? (
                <Link key={link.href} to={link.href as "/login" | "/register"}>
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ),
            )}
          </nav>
        ))}
      </div>
      <div className="home-os-container home-os-footer__bottom">
        <span>© {new Date().getFullYear()} Mythforge</span>
        <span>
          Private runtime. Approval-first agents. Grounded workspace memory.
        </span>
      </div>
    </footer>
  );
}
