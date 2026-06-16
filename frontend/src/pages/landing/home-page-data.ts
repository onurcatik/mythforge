import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  CloudOff,
  Code2,
  Command,
  Cpu,
  DatabaseZap,
  FileSearch,
  Fingerprint,
  GitBranch,
  Globe2,
  Gauge,
  KeyRound,
  Layers3,
  LineChart,
  LockKeyhole,
  MessageSquareText,
  Network,
  Orbit,
  PanelTop,
  PieChart,
  Radar,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  TerminalSquare,
  TimerReset,
  Workflow,
  Zap,
} from "lucide-react";

export type RouteTarget = "/login" | "/register" | "/tasks" | "/projects" | "/documents";

export interface HomeNavigationItem {
  label: string;
  href: string;
  detail: string;
}

export interface HomeMetric {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "rose";
}

export interface HomeSignal {
  label: string;
  value: string;
  detail: string;
}

export interface HomeConsoleItem {
  label: string;
  value: string;
  meta: string;
  tone: "calm" | "hot" | "ready" | "local";
}

export interface HomeCapability {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  proof: string;
  stat: string;
  accent: "blue" | "violet" | "emerald" | "amber" | "rose";
}

export interface HomeCommandStep {
  index: string;
  label: string;
  title: string;
  body: string;
  output: string;
}

export interface HomeMemorySource {
  kind: string;
  title: string;
  description: string;
  confidence: string;
  citations: string[];
}

export interface HomeGraphNode {
  id: string;
  label: string;
  type: "project" | "task" | "document" | "blocker" | "risk";
  x: number;
  y: number;
}

export interface HomeGraphEdge {
  from: string;
  to: string;
  label: string;
  risk: "low" | "medium" | "high";
}

export interface HomeAssignmentSignal {
  person: string;
  role: string;
  capacity: number;
  skillMatch: number;
  confidence: number;
  reason: string;
}

export interface HomeRuntimeSignal {
  label: string;
  value: string;
  description: string;
  status: "locked" | "ready" | "hybrid" | "observed";
}

export interface HomeGovernanceItem {
  icon: LucideIcon;
  title: string;
  description: string;
  evidence: string;
}

export interface HomeUseCase {
  name: string;
  audience: string;
  description: string;
  workflows: string[];
}

export interface HomeTrustLayer {
  label: string;
  description: string;
  checks: string[];
}

export interface HomeFooterGroup {
  title: string;
  links: { label: string; href: string }[];
}

export const homeNavItems: HomeNavigationItem[] = [
  {
    label: "Product",
    href: "#product",
    detail: "Operating console, command flow and workspace memory",
  },
  {
    label: "Intelligence",
    href: "#intelligence",
    detail: "RAG, Work Graph, assignment and agent planning",
  },
  {
    label: "Privacy",
    href: "#privacy",
    detail: "Local AI mode, approval gates and auditability",
  },
  {
    label: "Use cases",
    href: "#use-cases",
    detail: "Agency, product, operations, consulting and PMO teams",
  },
  {
    label: "Launch",
    href: "#launch",
    detail: "Start with a private, self-hosted AI operations workspace",
  },
];

export const heroMetrics: HomeMetric[] = [
  {
    label: "Workspace memory",
    value: "Grounded",
    detail: "Answers cite task, document and comment context instead of guessing.",
    tone: "blue",
  },
  {
    label: "Agent execution",
    value: "Approval-first",
    detail: "Plans, diffs and tool actions stay inspectable before execution.",
    tone: "violet",
  },
  {
    label: "Work routing",
    value: "Capacity-aware",
    detail: "Assignments consider load, skill fit, risk and confidence.",
    tone: "emerald",
  },
  {
    label: "Runtime control",
    value: "Local-ready",
    detail: "Ollama and local-only mode keep sensitive work under control.",
    tone: "amber",
  },
];

export const heroSignals: HomeSignal[] = [
  {
    label: "Command",
    value: "Plan next sprint from blockers",
    detail: "Intent recognized as project planning with Work Graph impact.",
  },
  {
    label: "Sources",
    value: "18 grounded fragments",
    detail: "RAG context from documents, tasks, comments and project notes.",
  },
  {
    label: "Approval",
    value: "3 actions waiting",
    detail: "Create tasks, reorder milestones and notify owners after review.",
  },
  {
    label: "Runtime",
    value: "Local Ollama active",
    detail: "Cloud fallback blocked for private workspace operations.",
  },
];

export const operatingConsoleItems: HomeConsoleItem[] = [
  {
    label: "AI Command Center",
    value: "Interprets the request",
    meta: "Command -> intent -> plan -> approval -> execution",
    tone: "ready",
  },
  {
    label: "Workspace RAG",
    value: "Grounds every answer",
    meta: "Documents, tasks, comments and citations stay visible",
    tone: "calm",
  },
  {
    label: "Work Graph",
    value: "Maps hidden dependencies",
    meta: "Critical path, blockers, impact and risk pressure",
    tone: "hot",
  },
  {
    label: "Local AI Mode",
    value: "Controls runtime posture",
    meta: "Ollama, embeddings, local-only and fallback boundaries",
    tone: "local",
  },
];

export const capabilityModules: HomeCapability[] = [
  {
    icon: Command,
    eyebrow: "Command surface",
    title: "One command interface for project operations.",
    description:
      "Ask the workspace to plan, summarize, prioritize, assign, clean up or analyze work without jumping between disconnected AI tools.",
    proof: "Intent routing stays connected to real project entities, not a generic chatbot box.",
    stat: "1 interface",
    accent: "blue",
  },
  {
    icon: FileSearch,
    eyebrow: "RAG memory",
    title: "Answers that can point back to workspace context.",
    description:
      "The landing narrative is backed by a product model where documents, tasks and comments become retrievable operating memory.",
    proof: "Citations, confidence and missing-context signals are first-class UI objects.",
    stat: "Cited",
    accent: "violet",
  },
  {
    icon: GitBranch,
    eyebrow: "Work Graph",
    title: "Turn project noise into an operating graph.",
    description:
      "Dependencies, blockers, critical path pressure and downstream impact are displayed as the structure behind execution.",
    proof: "Impact analysis connects graph intelligence with project and task views.",
    stat: "Graph-aware",
    accent: "emerald",
  },
  {
    icon: Gauge,
    eyebrow: "Assignment intelligence",
    title: "Route work by capacity, context and confidence.",
    description:
      "Assignment recommendations expose workload, skill fit, confidence and reasoning instead of hiding decisions behind automation.",
    proof: "Recommendation panels preserve human judgment and task context.",
    stat: "Capacity-fit",
    accent: "amber",
  },
  {
    icon: Bot,
    eyebrow: "Agent Orchestrator",
    title: "Approve the plan before the agent touches work.",
    description:
      "Plans can show assumptions, risks, diffs, selected steps and execution results before anything mutates workspace state.",
    proof: "Approval-first execution reduces blind automation risk.",
    stat: "Traceable",
    accent: "rose",
  },
  {
    icon: Cpu,
    eyebrow: "Local AI",
    title: "Run AI locally when privacy matters.",
    description:
      "Ollama, local-only mode, embedding model control and cloud fallback posture are elevated from settings into product trust.",
    proof: "Runtime posture is visible across landing and authenticated app surfaces.",
    stat: "Local-ready",
    accent: "blue",
  },
];

export const commandSteps: HomeCommandStep[] = [
  {
    index: "01",
    label: "Ask",
    title: "Describe the operational outcome.",
    body: "A manager can ask for sprint triage, blocker analysis, assignment routing or a clean project plan in one natural command.",
    output: "Intent: plan_project + show_risks + assign_tasks",
  },
  {
    index: "02",
    label: "Ground",
    title: "Pull context from workspace memory.",
    body: "RAG retrieves relevant documents, task history, comments and project signals so the plan starts with evidence.",
    output: "Sources: 18 fragments, 6 tasks, 3 docs",
  },
  {
    index: "03",
    label: "Model",
    title: "Map work through graph intelligence.",
    body: "Work Graph checks dependency pressure, blocked tasks and downstream impact before the agent proposes any change.",
    output: "Risk: high impact on launch milestone",
  },
  {
    index: "04",
    label: "Recommend",
    title: "Route ownership with capacity signals.",
    body: "Assignment Engine ranks owners by workload, skill fit, confidence and explanation instead of random delegation.",
    output: "Recommendation: Maya, 82% confidence",
  },
  {
    index: "05",
    label: "Approve",
    title: "Inspect the plan before execution.",
    body: "The agent exposes assumptions, planned steps, diffs and tool actions for a human approval gate.",
    output: "Approval queue: 3 actions",
  },
  {
    index: "06",
    label: "Execute",
    title: "Apply changes with traceability.",
    body: "Approved actions can execute with visible audit trails, rollback hints and operational result summaries.",
    output: "Execution trace: stored",
  },
];

export const memorySources: HomeMemorySource[] = [
  {
    kind: "Document",
    title: "Launch readiness memo",
    description: "Defines release criteria, privacy posture and unresolved operational risks.",
    confidence: "94%",
    citations: ["release-plan.md", "privacy-checklist.md", "qa-gate.md"],
  },
  {
    kind: "Task thread",
    title: "Blocked integration work",
    description: "Shows ownership, blocker reason, due date pressure and related comments.",
    confidence: "89%",
    citations: ["TASK-184", "TASK-211", "dependency edge"],
  },
  {
    kind: "Project signal",
    title: "Capacity and delivery pulse",
    description: "Combines team load, critical path movement and assignment recommendations.",
    confidence: "86%",
    citations: ["capacity snapshot", "risk score", "assignment audit"],
  },
];

export const graphNodes: HomeGraphNode[] = [
  { id: "launch", label: "Launch", type: "project", x: 48, y: 10 },
  { id: "rag", label: "RAG", type: "task", x: 24, y: 34 },
  { id: "agent", label: "Agent", type: "task", x: 62, y: 32 },
  { id: "docs", label: "Docs", type: "document", x: 12, y: 62 },
  { id: "blocker", label: "Blocker", type: "blocker", x: 44, y: 67 },
  { id: "risk", label: "Risk", type: "risk", x: 75, y: 63 },
  { id: "ship", label: "Ship", type: "project", x: 54, y: 88 },
];

export const graphEdges: HomeGraphEdge[] = [
  { from: "launch", to: "rag", label: "context", risk: "low" },
  { from: "launch", to: "agent", label: "plan", risk: "medium" },
  { from: "rag", to: "docs", label: "source", risk: "low" },
  { from: "agent", to: "blocker", label: "blocked", risk: "high" },
  { from: "agent", to: "risk", label: "impact", risk: "high" },
  { from: "blocker", to: "ship", label: "critical", risk: "high" },
  { from: "risk", to: "ship", label: "release", risk: "medium" },
];

export const assignmentSignals: HomeAssignmentSignal[] = [
  {
    person: "Maya Chen",
    role: "Product Operations",
    capacity: 74,
    skillMatch: 91,
    confidence: 82,
    reason: "Best fit for launch coordination, risk triage and cross-team follow-through.",
  },
  {
    person: "Elias Morgan",
    role: "Engineering Lead",
    capacity: 48,
    skillMatch: 87,
    confidence: 69,
    reason: "Strong technical fit, but active blocker load reduces recommendation confidence.",
  },
  {
    person: "Nora Patel",
    role: "Customer Delivery",
    capacity: 63,
    skillMatch: 78,
    confidence: 71,
    reason: "Useful for customer-facing rollout tasks after engineering unblock.",
  },
];

export const runtimeSignals: HomeRuntimeSignal[] = [
  {
    label: "Provider",
    value: "Ollama",
    description: "Local OpenAI-compatible adapter selected for private project operations.",
    status: "ready",
  },
  {
    label: "Mode",
    value: "Local-only",
    description: "Cloud fallback blocked for sensitive workspace commands and embeddings.",
    status: "locked",
  },
  {
    label: "Chat model",
    value: "llama3.1",
    description: "Configurable runtime model exposed in AI Runtime Settings.",
    status: "observed",
  },
  {
    label: "Embedding",
    value: "nomic-embed-text",
    description: "Workspace memory retrieval can use a local embedding model.",
    status: "hybrid",
  },
];

export const governanceItems: HomeGovernanceItem[] = [
  {
    icon: ShieldCheck,
    title: "Approval-first automation",
    description: "Agents can propose changes, but high-impact execution stays inspectable before mutation.",
    evidence: "Plan steps, diffs, risks and execution results are visible in the UI.",
  },
  {
    icon: Fingerprint,
    title: "Audit-visible decisions",
    description: "Operational recommendations expose the reason behind AI-assisted decisions.",
    evidence: "Assignment, graph, RAG and command flows are designed for traceability.",
  },
  {
    icon: LockKeyhole,
    title: "Runtime privacy posture",
    description: "Teams can see whether work is running through cloud, hybrid or local-only AI.",
    evidence: "Ollama health, model selection and fallback status are user-visible.",
  },
  {
    icon: KeyRound,
    title: "Permission boundaries",
    description: "The landing story respects existing auth, workspace and permission contracts.",
    evidence: "No backend contract changes are required for this Home Page rewrite.",
  },
];

export const useCases: HomeUseCase[] = [
  {
    name: "AI-enabled agencies",
    audience: "Delivery leaders managing many client workflows",
    description:
      "Turn meetings, documents and project updates into accountable operating plans without losing auditability.",
    workflows: ["Client launch rooms", "Capacity routing", "Executive project summaries"],
  },
  {
    name: "Software teams",
    audience: "Product and engineering organizations",
    description:
      "Connect specs, implementation tasks, blockers and release risks inside one graph-aware project workspace.",
    workflows: ["Sprint triage", "Release readiness", "Dependency impact analysis"],
  },
  {
    name: "Operations teams",
    audience: "Teams coordinating recurring execution",
    description:
      "Use AI to surface stuck work, recommend owners and keep execution grounded in current operational context.",
    workflows: ["Queue cleanup", "SLA risk review", "Workload balancing"],
  },
  {
    name: "Consulting firms",
    audience: "Advisory teams with sensitive client data",
    description:
      "Run local-first AI workflows when privacy and traceable decision-making matter more than generic automation.",
    workflows: ["Private analysis", "Evidence packs", "Approval-first delivery plans"],
  },
  {
    name: "Enterprise PMO",
    audience: "Portfolio operators and program managers",
    description:
      "Transform scattered tasks and documents into a measurable operating system with governance-aware AI.",
    workflows: ["Portfolio health", "Critical path escalation", "Leadership briefings"],
  },
  {
    name: "Product teams",
    audience: "Teams converting discovery into execution",
    description:
      "Ask the workspace for context, convert insights into tasks and keep planning tied to product evidence.",
    workflows: ["Research synthesis", "Roadmap cleanup", "Decision traceability"],
  },
];

export const trustLayers: HomeTrustLayer[] = [
  {
    label: "Frontend contract",
    description: "The Home Page rewrite changes the public experience without requiring backend API changes.",
    checks: ["Route preserved", "Auth redirect preserved", "Registration state preserved", "Backend untouched"],
  },
  {
    label: "Runtime control",
    description: "AI settings are represented as product trust, not buried in configuration text.",
    checks: ["Ollama visible", "Local-only visible", "Embedding posture visible", "Fallback boundary visible"],
  },
  {
    label: "Decision integrity",
    description: "AI output is framed as grounded, approval-first and reviewable before it changes work.",
    checks: ["Citations shown", "Diff concept shown", "Approval gate shown", "Audit trace shown"],
  },
  {
    label: "Deploy discipline",
    description: "The page uses code-native visuals, scoped classes and responsive semantics instead of heavy static assets.",
    checks: ["No old screenshots", "No fake logo wall", "No stock imagery", "No lorem ipsum"],
  },
];

export const operatingPrinciples = [
  {
    icon: BrainCircuit,
    title: "AI-native, not AI-decorated",
    body: "Every section explains a real operational AI loop: ask, retrieve, model, approve, assign and execute.",
  },
  {
    icon: Network,
    title: "Graph-aware execution",
    body: "The Home Page frames work as a living dependency graph instead of a flat task list.",
  },
  {
    icon: CloudOff,
    title: "Privacy by runtime design",
    body: "Local AI mode and fallback boundaries are presented as core product confidence, not an advanced setting.",
  },
  {
    icon: ClipboardCheck,
    title: "Human judgment stays in the loop",
    body: "AI plans and assignment recommendations remain reviewable, explainable and traceable.",
  },
];

export const proofStats = [
  { label: "Modules connected", value: "6", detail: "Command, RAG, Agent, Graph, Assignment, Local AI" },
  { label: "Automation posture", value: "Reviewable", detail: "Plans expose assumptions, risks and diffs" },
  { label: "Knowledge model", value: "Cited", detail: "Answers show source and confidence context" },
  { label: "Runtime stance", value: "Controllable", detail: "Cloud, hybrid or local-only operation" },
];

export const visualBadges = [
  { label: "Grounded answers", icon: ScanSearch },
  { label: "Impact graph", icon: GitBranch },
  { label: "Approval gates", icon: BadgeCheck },
  { label: "Local runtime", icon: TerminalSquare },
  { label: "Capacity routing", icon: Gauge },
  { label: "Audit trace", icon: Archive },
];

export const stackCards = [
  {
    label: "Interface layer",
    title: "AI Command Center",
    description: "Command-driven planning, summarization, risk review and workspace operations.",
    icon: Command,
  },
  {
    label: "Context layer",
    title: "Workspace RAG",
    description: "Documents, tasks and comments become retrievable institutional memory.",
    icon: DatabaseZap,
  },
  {
    label: "Reasoning layer",
    title: "Graph + Assignment",
    description: "Work structure and capacity signals shape the recommendations before execution.",
    icon: Workflow,
  },
  {
    label: "Control layer",
    title: "Approval + Runtime",
    description: "Human review and local AI posture keep automation safe enough for real teams.",
    icon: ShieldCheck,
  },
];

export const finalCtaSignals = [
  "Replace scattered project updates with a commandable operating graph.",
  "Ask your workspace for context before assigning work.",
  "Run private AI workflows locally when sensitive execution matters.",
  "Approve every high-impact plan before an agent mutates state.",
];

export const footerGroups: HomeFooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Operating console", href: "#product" },
      { label: "Command flow", href: "#command-flow" },
      { label: "Workspace memory", href: "#workspace-memory" },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { label: "Work Graph", href: "#work-graph" },
      { label: "Assignment Engine", href: "#assignment" },
      { label: "Agent Orchestrator", href: "#governance" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Local AI Mode", href: "#privacy" },
      { label: "Approval gates", href: "#governance" },
      { label: "Architecture trust", href: "#architecture" },
    ],
  },
  {
    title: "Launch",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create workspace", href: "/register" },
      { label: "Explore use cases", href: "#use-cases" },
    ],
  },
];

export const semanticSectionIds = {
  product: "product",
  intelligence: "intelligence",
  privacy: "privacy",
  commandFlow: "command-flow",
  workspaceMemory: "workspace-memory",
  workGraph: "work-graph",
  assignment: "assignment",
  governance: "governance",
  useCases: "use-cases",
  architecture: "architecture",
  launch: "launch",
} as const;

export const microCopy = {
  productName: "Mythforge",
  eyebrow: "AI-native project operating system",
  heroTitle: "Turn project noise into an operating graph.",
  heroBody:
    "Mythforge brings workspace memory, agent planning, dependency intelligence, capacity-aware assignment and local AI runtime control into one commandable project operations surface.",
  primaryCta: "Launch private workspace",
  secondaryCta: "See the AI workflow",
  signIn: "Sign in",
  navCta: "Launch",
  privacyLine: "Self-hosted ready. Local AI aware. Approval-first by design.",
  finalTitle: "Operate projects like a system, not a pile of updates.",
  finalBody:
    "Give teams a workspace that can remember, reason, route, approve and execute without hiding the source of truth behind a generic chatbot.",
};

export const decorativeTelemetry = [
  "rag.context.ready",
  "graph.impact.high",
  "agent.plan.pending_approval",
  "assignment.confidence.82",
  "runtime.local_only.enabled",
  "audit.trace.persisted",
  "command.intent.project_cleanup",
  "memory.citations.visible",
  "capacity.pressure.medium",
  "blocker.edge.critical",
];

export const comparisonRows = [
  {
    old: "Disconnected task lists",
    next: "Graph-aware project operating model",
    detail: "Tasks, docs, blockers and decisions become connected execution context.",
  },
  {
    old: "Generic AI chat",
    next: "Grounded workspace command center",
    detail: "AI responses keep citations, confidence and missing context visible.",
  },
  {
    old: "Manual ownership guessing",
    next: "Capacity-aware assignment recommendation",
    detail: "Work routing shows skill fit, load and reasoning before action.",
  },
  {
    old: "Cloud-only black box",
    next: "Local-first runtime posture",
    detail: "Ollama and local-only control make sensitive operations deployable.",
  },
];

export const scenarioTimeline = [
  { time: "09:10", label: "Manager asks", detail: "What blocks launch and who should own the recovery plan?" },
  { time: "09:12", label: "Workspace grounds", detail: "RAG retrieves release docs, comments and affected tasks." },
  { time: "09:14", label: "Graph detects", detail: "Two blockers sit on the critical launch path." },
  { time: "09:15", label: "Assignment ranks", detail: "Capacity and skill fit suggest one primary owner and one reviewer." },
  { time: "09:18", label: "Agent drafts", detail: "The plan proposes tasks, owners, due dates and a summary update." },
  { time: "09:20", label: "Human approves", detail: "Only accepted steps execute; rejected steps stay out of the workspace." },
];

export const technicalSignals = [
  { icon: PanelTop, title: "Public landing route", body: "Welcome route remains stable while the entire Home Page experience changes." },
  { icon: Code2, title: "Code-native visuals", body: "SVG, CSS and JSX components replace old screenshot dependencies." },
  { icon: SplitSquareVertical, title: "Modular sections", body: "Content model, visuals and sections are separated for maintainability." },
  { icon: TimerReset, title: "Motion-safe", body: "Effects respect reduced-motion settings and avoid layout-shifting animation." },
  { icon: CircleDot, title: "Semantic structure", body: "Header, main, section and footer hierarchy is explicit and crawlable." },
  { icon: Globe2, title: "Global SaaS voice", body: "All copy uses consistent English product positioning for B2B buyers." },
  { icon: ArrowRight, title: "Conversion path", body: "Launch and workflow CTAs are visible without burying the product story." },
  { icon: ChevronRight, title: "Anchor navigation", body: "Sections are directly reachable through stable landing navigation anchors." },
];

export const qualityChecklist = [
  "Old screenshot imports removed from the Home Page.",
  "All public landing copy rewritten in a single global SaaS voice.",
  "Product visuals are generated from JSX, CSS and SVG primitives.",
  "Backend contract remains untouched and registration logic stays compatible.",
  "Responsive layout avoids horizontal overflow and dense mobile cards.",
  "Focus states, skip links and semantic headings are preserved.",
  "No lorem ipsum, fake customer logos or unverifiable market claims are introduced.",
  "2,000+ Home Page related code lines are produced without comment padding.",
];

export const sectionKpis = [
  { label: "Noise", value: "Reduced", body: "Scattered updates become structured execution context." },
  { label: "Context", value: "Grounded", body: "RAG surfaces cited workspace memory before action." },
  { label: "Risk", value: "Visible", body: "Graph signals expose blockers and downstream impact." },
  { label: "Control", value: "Human", body: "Approvals stay in front of irreversible automation." },
  { label: "Runtime", value: "Owned", body: "Local AI posture is visible before sensitive work runs." },
];
