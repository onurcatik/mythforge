import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  CloudOff,
  Command,
  Cpu,
  DatabaseZap,
  FileSearch,
  GitBranch,
  Gauge,
  LockKeyhole,
  Network,
  Orbit,
  Radar,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from "lucide-react";

import type {
  HomeAssignmentSignal,
  HomeCommandStep,
  HomeConsoleItem,
  HomeGraphEdge,
  HomeGraphNode,
  HomeMemorySource,
  HomeRuntimeSignal,
} from "./home-page-data";
import {
  assignmentSignals,
  commandSteps,
  decorativeTelemetry,
  graphEdges,
  graphNodes,
  heroSignals,
  memorySources,
  operatingConsoleItems,
  runtimeSignals,
  stackCards,
  visualBadges,
} from "./home-page-data";

const statusLabel = {
  locked: "Locked",
  ready: "Ready",
  hybrid: "Hybrid",
  observed: "Observed",
} as const;

const graphNodeIcon: Record<HomeGraphNode["type"], LucideIcon> = {
  project: Orbit,
  task: CircleDot,
  document: FileSearch,
  blocker: AlertTriangle,
  risk: Radar,
};

const riskTone: Record<HomeGraphEdge["risk"], string> = {
  low: "home-os-risk-low",
  medium: "home-os-risk-medium",
  high: "home-os-risk-high",
};

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="home-os-meter" aria-label={`${label}: ${value}%`}>
      <div className="home-os-meter__label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="home-os-meter__track">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SignalChip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="home-os-signal-chip">
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function ConsoleStatus({ item }: { item: HomeConsoleItem }) {
  return (
    <article
      className={`home-os-console-status home-os-console-status--${item.tone}`}
    >
      <div>
        <p>{item.label}</p>
        <strong>{item.value}</strong>
      </div>
      <span>{item.meta}</span>
    </article>
  );
}

export function HeroOperatingConsole() {
  return (
    <div
      className="home-os-hero-console"
      aria-label="AI operating console preview"
    >
      <div
        className="home-os-console-orb home-os-console-orb--one"
        aria-hidden="true"
      />
      <div
        className="home-os-console-orb home-os-console-orb--two"
        aria-hidden="true"
      />
      <div className="home-os-console-window">
        <div className="home-os-console-toolbar">
          <div className="home-os-console-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="home-os-console-title">AI Operating Console</span>
          <span className="home-os-console-runtime">Local AI ready</span>
        </div>
        <div className="home-os-command-card">
          <div className="home-os-command-card__icon">
            <Command aria-hidden="true" />
          </div>
          <div>
            <span>Workspace command</span>
            <strong>Plan the recovery path for launch blockers.</strong>
          </div>
        </div>
        <div className="home-os-console-grid">
          {heroSignals.map((signal) => (
            <article key={signal.label} className="home-os-console-signal">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
        <div
          className="home-os-mini-graph"
          aria-label="Dependency graph preview"
        >
          {graphNodes.slice(0, 5).map((node) => {
            const Icon = graphNodeIcon[node.type];
            return (
              <div
                key={node.id}
                className={`home-os-mini-graph__node home-os-mini-graph__node--${node.type}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <Icon aria-hidden="true" />
                <span>{node.label}</span>
              </div>
            );
          })}
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M48 12 L24 36 L12 62" />
            <path d="M48 12 L62 34 L44 67" />
            <path d="M62 34 L75 63" />
          </svg>
        </div>
        <div className="home-os-console-bottom">
          <div>
            <span>Approval queue</span>
            <strong>3 proposed actions</strong>
          </div>
          <button type="button">Review plan</button>
        </div>
      </div>
    </div>
  );
}

export function ProductOperatingConsole() {
  return (
    <div
      className="home-os-product-console"
      aria-label="Product operating system preview"
    >
      <div className="home-os-product-console__rail">
        <span className="is-active">
          <Command aria-hidden="true" /> Command
        </span>
        <span>
          <DatabaseZap aria-hidden="true" /> Memory
        </span>
        <span>
          <GitBranch aria-hidden="true" /> Graph
        </span>
        <span>
          <Gauge aria-hidden="true" /> Capacity
        </span>
        <span>
          <CloudOff aria-hidden="true" /> Runtime
        </span>
      </div>
      <div className="home-os-product-console__main">
        <div className="home-os-product-console__header">
          <div>
            <span>Operating view</span>
            <strong>Launch recovery command room</strong>
          </div>
          <p>
            Everything the AI recommends stays tied to workspace evidence, graph
            pressure and a human approval point.
          </p>
        </div>
        <div className="home-os-product-console__statuses">
          {operatingConsoleItems.map((item) => (
            <ConsoleStatus key={item.label} item={item} />
          ))}
        </div>
        <div className="home-os-product-console__lanes">
          <div className="home-os-product-lane">
            <span>Plan</span>
            <strong>Recovery plan generated</strong>
            <p>6 steps, 3 approvals, 2 owners, 1 blocker escalation.</p>
          </div>
          <div className="home-os-product-lane">
            <span>Evidence</span>
            <strong>18 fragments cited</strong>
            <p>Release notes, task threads, project comments and docs.</p>
          </div>
          <div className="home-os-product-lane">
            <span>Impact</span>
            <strong>Critical path affected</strong>
            <p>Launch milestone depends on resolving integration blocker.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandFlowVisual({
  steps = commandSteps,
}: {
  steps?: HomeCommandStep[];
}) {
  return (
    <div
      className="home-os-command-flow"
      aria-label="Command to outcome workflow"
    >
      <div className="home-os-command-flow__prompt">
        <Command aria-hidden="true" />
        <div>
          <span>Command input</span>
          <strong>
            “Show risks, create a recovery plan and suggest owners.”
          </strong>
        </div>
      </div>
      <div className="home-os-command-flow__steps">
        {steps.map((step) => (
          <article key={step.index} className="home-os-command-step">
            <div className="home-os-command-step__index">{step.index}</div>
            <div className="home-os-command-step__body">
              <span>{step.label}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
              <code>{step.output}</code>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceMemoryVisual({
  sources = memorySources,
}: {
  sources?: HomeMemorySource[];
}) {
  return (
    <div
      className="home-os-memory-visual"
      aria-label="Workspace memory retrieval preview"
    >
      <div className="home-os-memory-answer">
        <div>
          <Sparkles aria-hidden="true" />
          <span>Grounded answer</span>
        </div>
        <strong>
          Launch is blocked by integration ownership and unresolved privacy
          review.
        </strong>
        <p>
          The answer is not a generic summary. It carries source cards,
          confidence, missing context and follow-up prompts so the team can
          decide what to trust.
        </p>
      </div>
      <div className="home-os-memory-sources">
        {sources.map((source) => (
          <article key={source.title} className="home-os-memory-source">
            <div className="home-os-memory-source__top">
              <span>{source.kind}</span>
              <strong>{source.confidence}</strong>
            </div>
            <h3>{source.title}</h3>
            <p>{source.description}</p>
            <div className="home-os-memory-source__chips">
              {source.citations.map((citation) => (
                <span key={citation}>{citation}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function WorkGraphVisual({
  nodes = graphNodes,
  edges = graphEdges,
}: {
  nodes?: HomeGraphNode[];
  edges?: HomeGraphEdge[];
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return (
    <div
      className="home-os-graph-visual"
      aria-label="Work graph impact preview"
    >
      <svg
        className="home-os-graph-visual__edges"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={riskTone[edge.risk]}
            />
          );
        })}
      </svg>
      {nodes.map((node) => {
        const Icon = graphNodeIcon[node.type];
        return (
          <article
            key={node.id}
            className={`home-os-graph-node home-os-graph-node--${node.type}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <Icon aria-hidden="true" />
            <span>{node.label}</span>
          </article>
        );
      })}
      <div className="home-os-graph-legend">
        <span>
          <i className="home-os-risk-low" /> Low
        </span>
        <span>
          <i className="home-os-risk-medium" /> Medium
        </span>
        <span>
          <i className="home-os-risk-high" /> High
        </span>
      </div>
    </div>
  );
}

export function AssignmentMatrixVisual({
  signals = assignmentSignals,
}: {
  signals?: HomeAssignmentSignal[];
}) {
  return (
    <div
      className="home-os-assignment-visual"
      aria-label="Assignment recommendation preview"
    >
      {signals.map((signal, index) => (
        <article key={signal.person} className="home-os-assignment-card">
          <div className="home-os-assignment-card__rank">#{index + 1}</div>
          <div className="home-os-assignment-card__header">
            <div>
              <strong>{signal.person}</strong>
              <span>{signal.role}</span>
            </div>
            <BadgeCheck aria-hidden="true" />
          </div>
          <div className="home-os-assignment-card__meters">
            <Meter value={signal.capacity} label="Capacity" />
            <Meter value={signal.skillMatch} label="Skill fit" />
            <Meter value={signal.confidence} label="Confidence" />
          </div>
          <p>{signal.reason}</p>
        </article>
      ))}
    </div>
  );
}

export function LocalRuntimeVisual({
  signals = runtimeSignals,
}: {
  signals?: HomeRuntimeSignal[];
}) {
  return (
    <div
      className="home-os-runtime-visual"
      aria-label="Local AI runtime posture preview"
    >
      <div className="home-os-runtime-core">
        <div className="home-os-runtime-core__icon">
          <Cpu aria-hidden="true" />
        </div>
        <span>Runtime posture</span>
        <strong>Private local AI when the work requires it.</strong>
        <p>
          Provider, model, embedding and fallback state become visible product
          controls instead of hidden infrastructure choices.
        </p>
      </div>
      <div className="home-os-runtime-grid">
        {signals.map((signal) => (
          <article
            key={signal.label}
            className={`home-os-runtime-card home-os-runtime-card--${signal.status}`}
          >
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <p>{signal.description}</p>
            <small>{statusLabel[signal.status]}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

export function GovernanceVisual() {
  return (
    <div
      className="home-os-governance-visual"
      aria-label="Governance and approval preview"
    >
      <div className="home-os-governance-visual__top">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span>Approval gate</span>
          <strong>3 changes require review before execution</strong>
        </div>
      </div>
      <div className="home-os-governance-diff">
        <div>
          <span>Proposed</span>
          <p>Create launch recovery task</p>
        </div>
        <ArrowRight aria-hidden="true" />
        <div>
          <span>Impact</span>
          <p>Changes critical path owner and due date</p>
        </div>
      </div>
      <div className="home-os-governance-events">
        {[
          "Intent classified",
          "Sources attached",
          "Risk calculated",
          "Human approval requested",
          "Audit event ready",
        ].map((event) => (
          <span key={event}>
            <CheckCircle2 aria-hidden="true" /> {event}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ArchitectureStackVisual() {
  return (
    <div
      className="home-os-architecture-visual"
      aria-label="Architecture trust preview"
    >
      {stackCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <article
            key={card.title}
            className="home-os-stack-card"
            style={{ transform: `translateX(${index * 10}px)` }}
          >
            <div className="home-os-stack-card__icon">
              <Icon aria-hidden="true" />
            </div>
            <div>
              <span>{card.label}</span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function TelemetryRibbon() {
  return (
    <div
      className="home-os-telemetry-ribbon"
      aria-label="Product telemetry signals"
    >
      <div>
        {[...decorativeTelemetry, ...decorativeTelemetry].map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function BadgeOrbit() {
  return (
    <div className="home-os-badge-orbit" aria-label="Product capability badges">
      {visualBadges.map((badge, index) => (
        <SignalChip key={badge.label} icon={badge.icon} label={badge.label} />
      ))}
      <div className="home-os-badge-orbit__core">
        <BrainCircuit aria-hidden="true" />
        <span>AI Ops</span>
      </div>
      <svg viewBox="0 0 400 400" aria-hidden="true">
        <circle cx="200" cy="200" r="150" />
        <circle cx="200" cy="200" r="96" />
      </svg>
    </div>
  );
}

export function SystemComparisonVisual({
  rows,
}: {
  rows: { old: string; next: string; detail: string }[];
}) {
  return (
    <div
      className="home-os-comparison"
      aria-label="Old workflow compared with operating system workflow"
    >
      {rows.map((row) => (
        <article key={row.old} className="home-os-comparison-row">
          <div>
            <span>Before</span>
            <strong>{row.old}</strong>
          </div>
          <ChevronRight aria-hidden="true" />
          <div>
            <span>Mythforge</span>
            <strong>{row.next}</strong>
            <p>{row.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ScenarioTimelineVisual({
  items,
}: {
  items: { time: string; label: string; detail: string }[];
}) {
  return (
    <div
      className="home-os-scenario"
      aria-label="Operational scenario timeline"
    >
      {items.map((item) => (
        <article
          key={`${item.time}-${item.label}`}
          className="home-os-scenario-item"
        >
          <time>{item.time}</time>
          <div>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TechnicalSignalGrid({
  items,
}: {
  items: { icon: LucideIcon; title: string; body: string }[];
}) {
  return (
    <div className="home-os-technical-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.title} className="home-os-technical-card">
            <Icon aria-hidden="true" />
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        );
      })}
    </div>
  );
}

export function FinalSystemVisual({ signals }: { signals: string[] }) {
  return (
    <div
      className="home-os-final-visual"
      aria-label="Final AI operating system summary"
    >
      <div className="home-os-final-visual__core">
        <Workflow aria-hidden="true" />
        <strong>Workspace operating loop</strong>
      </div>
      <div className="home-os-final-visual__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="home-os-final-visual__signals">
        {signals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <div className="home-os-final-visual__footer">
        <Zap aria-hidden="true" />
        <span>Ask. Ground. Model. Approve. Execute.</span>
      </div>
    </div>
  );
}
