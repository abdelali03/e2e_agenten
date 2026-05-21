export type LlmProvider = "groq" | "openrouter" | "minimax";

export interface AgentStep {
  stepIndex: number;
  instruction: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  retryCount: number;
  error?: string;
  result?: ActionResult;
}

export interface SessionState {
  sessionId: string;
  goal: string;
  url: string;
  steps: AgentStep[];
  currentStepIndex: number;
  isComplete: boolean;
  hasFailed: boolean;
}


export interface PlannerInput {
  goal: string;
  url: string;
  context?: string;
}

export interface PlannerOutput {
  steps: string[];
}


export interface AomNode {
  uid?: string;
  selector?: string;
  domIndex?: number;
  tagName?: string;
  inputType?: string;
  label?: string;
  placeholder?: string;
  visible?: boolean;
  text?: string;
  id?: string;
  className?: string;
  nameAttr?: string;
  title?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaLabelledByText?: string;
  ariaDescribedBy?: string;
  ariaDescribedByText?: string;
  testId?: string;
  dataTestId?: string;
  dataTest?: string;
  dataCy?: string;
  dataQa?: string;
  autoComplete?: string;
  href?: string;
  nearestHeading?: string;
  nearbyText?: string;
  ancestorText?: string;
  formText?: string;
  componentContext?: string;
  componentHints?: string[];
  options?: string[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  role: string;
  name: string;
  value?: string;
  description?: string;
  disabled?: boolean;
  checked?: boolean;
  expanded?: boolean;
  required?: boolean;
  level?: number;
  children?: AomNode[];
}

export type BrowserActionType =
  | "click"
  | "doubleClick"
  | "rightClick"
  | "fill"
  | "type"
  | "clear"
  | "select"
  | "check"
  | "uncheck"
  | "hover"
  | "press"
  | "navigate"
  | "waitForVisible"
  | "waitForHidden"
  | "waitForText"
  | "waitForUrl"
  | "assertVisible"
  | "assertHidden"
  | "assertText"
  | "assertValue"
  | "assertUrl"
  | "scrollIntoView"
  | "setDate"
  | "setTime"
  | "uploadFile";

export interface AnalystOutput {
  actionType: BrowserActionType;
  targetUid?: string;
  selector?: string;
  targetDescription: string;
  targetRole?: string;
  targetName?: string;
  value?: string;
  reasoning: string;
}

export interface AnalystInput {
  instruction: string;
  aomTree: AomNode[];
  previousError?: string;
}


export interface ActionResult {
  success: boolean;
  actionPerformed: string;
  errorMessage?: string;
  screenshotBase64?: string;
  durationMs: number;
}


export interface CriticInput {
  failedInstruction: string;
  errorMessage: string;
  aomTreeAfterFailure: AomNode[];
  retryCount: number;
}

export interface CriticOutput {
  shouldRetry: boolean;
  revisedInstruction?: string;
  reasoning: string;
  abort: boolean;
}
