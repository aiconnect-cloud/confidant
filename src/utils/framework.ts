/**
 * Framework Detection Utility
 *
 * Detects the running agent framework (OpenClaw, Nanobot, Claude Code, etc.)
 * and adjusts CLI output/formatting accordingly.
 */

export type AgentFramework =
  | 'openclaw'
  | 'nanobot'
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'copilot'
  | 'gemini-cli'
  | 'qwen'
  | 'kiro'
  | 'factory-droid'
  | 'kilocode'
  | 'iflow'
  | 'opencode'
  | 'unknown';

export interface FrameworkInfo {
  /** Normalized framework identifier */
  framework: AgentFramework;
  /** Human-readable display name */
  displayName: string;
  /** Whether this framework supports rich markdown output */
  supportsMarkdown: boolean;
  /** Whether this framework prefers JSON-only output */
  prefersJson: boolean;
  /** Config path convention for this framework */
  configPath?: string;
  /** Detected environment variables that confirmed the framework */
  detectedVia: string[];
}

/**
 * Environment variable patterns that indicate each framework.
 * Ordered by specificity (more specific patterns first).
 */
const FRAMEWORK_SIGNALS: Array<{
  framework: AgentFramework;
  displayName: string;
  envVars: string[];
  configPath?: string;
  supportsMarkdown: boolean;
  prefersJson: boolean;
}> = [
  {
    framework: 'openclaw',
    displayName: 'OpenClaw',
    envVars: ['OPENCLAW_VERSION', 'OPENCLAW_WORKSPACE'],
    configPath: 'skills.entries.<label>.env',
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'claude-code',
    displayName: 'Claude Code',
    envVars: ['ANTHROPIC_API_KEY'], // Claude Code sets this; not unique but combined with others
    configPath: undefined,
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'codex',
    displayName: 'Codex',
    envVars: ['CODEX_SANDBOX', 'OPENAI_API_KEY'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'cursor',
    displayName: 'Cursor',
    envVars: ['CURSOR_AGENT_ID', 'CURSOR_WORKSPACE'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'copilot',
    displayName: 'GitHub Copilot',
    envVars: ['COPILOT_AGENT', 'GITHUB_COPILOT_TOKEN'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'gemini-cli',
    displayName: 'Gemini CLI',
    envVars: ['GEMINI_CLI_VERSION'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'nanobot',
    displayName: 'Nanobot',
    envVars: ['NANOBOT_ENV', 'NANOBOT_VERSION'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'qwen',
    displayName: 'Qwen',
    envVars: ['QWEN_AGENT', 'QWEN_VERSION'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'kiro',
    displayName: 'Kiro',
    envVars: ['KIRO_AGENT', 'KIRO_VERSION'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'factory-droid',
    displayName: 'Factory Droid',
    envVars: ['FACTORY_DROID_ENV'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'kilocode',
    displayName: 'Kilocode',
    envVars: ['KILOCODE_ENV'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'iflow',
    displayName: 'iFlow',
    envVars: ['IFLOW_ENV', 'IFLOW_VERSION'],
    supportsMarkdown: true,
    prefersJson: false,
  },
  {
    framework: 'opencode',
    displayName: 'OpenCode',
    envVars: ['OPENCODE_ENV'],
    supportsMarkdown: true,
    prefersJson: false,
  },
];

/**
 * Detects the currently running agent framework by inspecting environment variables.
 *
 * @returns FrameworkInfo with detection results
 */
export function detectFramework(): FrameworkInfo {
  const detected: Array<{ framework: AgentFramework; envVar: string }> = [];

  for (const signal of FRAMEWORK_SIGNALS) {
    for (const envVar of signal.envVars) {
      if (process.env[envVar] !== undefined) {
        detected.push({ framework: signal.framework, envVar });
      }
    }
  }

  if (detected.length === 0) {
    return {
      framework: 'unknown',
      displayName: 'Unknown',
      supportsMarkdown: true,
      prefersJson: false,
      detectedVia: [],
    };
  }

  // Use the first (most specific) match
  const match = detected[0];
  const signal = FRAMEWORK_SIGNALS.find((s) => s.framework === match.framework)!;

  return {
    framework: signal.framework,
    displayName: signal.displayName,
    supportsMarkdown: signal.supportsMarkdown,
    prefersJson: signal.prefersJson,
    configPath: signal.configPath,
    detectedVia: detected.map((d) => d.envVar),
  };
}

/**
 * Checks if running inside an OpenClaw workspace.
 *
 * @returns true if OPENCLAW_WORKSPACE env var is set
 */
export function isOpenClawWorkspace(): boolean {
  return process.env.OPENCLAW_WORKSPACE !== undefined;
}

/**
 * Checks if running inside any recognized agent framework.
 *
 * @returns true if a known framework is detected
 */
export function isInAgentFramework(): boolean {
  return detectFramework().framework !== 'unknown';
}

/**
 * Gets the OpenClaw config key path for storing environment variables.
 *
 * @param label - Service/feature label (e.g., "openai", "serpapi")
 * @param envVarName - Environment variable name (e.g., "OPENAI_API_KEY")
 * @returns Dot-notation path like "skills.entries.openai.env.OPENAI_API_KEY"
 */
export function getOpenClawConfigPath(
  label: string,
  envVarName: string
): string {
  const sanitizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '');
  return `skills.entries.${sanitizedLabel}.env.${envVarName}`;
}
