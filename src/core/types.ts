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

export interface GoalTestData {
  credentials?: {
    username?: string;
    password?: string;
  };
  appointment?: {
    name?: string;
    description?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
  };
  [key: string]: unknown;
}

export interface GoalInput {
  goal: string;
  url: string;
  testData?: GoalTestData;
  context?: string;
}

export type AdaptivePlanStatus = "continue" | "complete" | "blocked";

export interface AdaptiveNextActionOutput {
  status: AdaptivePlanStatus;
  instruction?: string;
  expectedOutcome?: string;
  reasoning: string;
}

export interface GoalVerificationOutput {
  isComplete: boolean;
  confidence: "low" | "medium" | "high";
  missing: string[];
  reasoning: string;
}

export interface AdaptiveHistoryEntry {
  index: number;
  instruction: string;
  expectedOutcome?: string;
  success: boolean;
  errorMessage?: string;
  actionPerformed?: string;
  urlAfter: string;
  observedAfter?: string;
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
  | "observePage"
  | "click"
  | "clickText"
  | "clickNearest"
  | "clickRowContaining"
  | "clickCellContaining"
  | "clickOutside"
  | "doubleClick"
  | "rightClick"
  | "fill"
  | "setValue"
  | "fillField"
  | "fillForm"
  | "type"
  | "appendText"
  | "clear"
  | "clearValue"
  | "select"
  | "selectOption"
  | "openDropdown"
  | "closeDropdown"
  | "check"
  | "uncheck"
  | "toggle"
  | "selectRadio"
  | "hover"
  | "focus"
  | "blur"
  | "press"
  | "pressShortcut"
  | "navigate"
  | "goBack"
  | "goForward"
  | "reload"
  | "waitForPageReady"
  | "waitForNavigationOrStateChange"
  | "waitForVisible"
  | "waitForHidden"
  | "waitForText"
  | "waitForUrl"
  | "assertVisible"
  | "assertHidden"
  | "assertText"
  | "verifyTextVisible"
  | "assertTextNotVisible"
  | "assertValue"
  | "assertUrl"
  | "assertTitle"
  | "assertEnabled"
  | "assertDisabled"
  | "assertChecked"
  | "scrollIntoView"
  | "scrollToText"
  | "scrollPage"
  | "scrollContainer"
  | "setDate"
  | "setTime"
  | "pickDate"
  | "pickTime"
  | "openDatePicker"
  | "openTimePicker"
  | "submitForm"
  | "resetForm"
  | "addRow"
  | "deleteRow"
  | "sortColumn"
  | "filterColumn"
  | "verifyRowExists"
  | "verifyCellValue"
  | "waitForDialog"
  | "confirmDialog"
  | "cancelDialog"
  | "closeDialog"
  | "dismissOverlay"
  | "waitForToast"
  | "verifyToast"
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
  visualContext?: string;
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
  visualContext?: string;
}

export interface CriticOutput {
  shouldRetry: boolean;
  revisedInstruction?: string;
  reasoning: string;
  abort: boolean;
}
