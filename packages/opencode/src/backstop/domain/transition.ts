import { Schema } from "effect"
import { LifecycleEventID } from "./schema"
import type {
  ArtifactFileID,
  ArtifactRevisionPrecondition,
  ArtifactRevisionID,
  AttemptID,
  Command as DomainCommand,
  CommandActor,
  CommandID,
  CommandType,
  LifecycleEvent,
  LifecycleEventType,
  LifecycleState,
  RejectionReason,
  WorkUnitID,
} from "./schema"

export type Aggregate = {
  work_unit_id: WorkUnitID
  aggregate_version: number
  current_state: LifecycleState
  active_attempt_id: AttemptID | null
  terminal: boolean
  retry_count: number
  max_retries: number
  expected_revisions: Record<string, ArtifactRevisionID>
  validation_status: "passed" | "failed" | null
  verification_status: "passed" | "failed" | null
}

type RevisionPayload = { artifact_revisions: readonly ArtifactRevisionPrecondition[] }
type DraftArtifactPayload = { artifact_file_id: ArtifactFileID; revision_id: ArtifactRevisionID }

export type CommandPayloadByType = {
  draft_bundle: DraftArtifactPayload
  approve_bundle: RevisionPayload
  file_directive: RevisionPayload
  draft_spec: DraftArtifactPayload
  record_validation: RevisionPayload & { status: "passed" | "failed" }
  submit_review_verdict: RevisionPayload & { verdict: "approved" | "changes_requested" }
  draft_plan: DraftArtifactPayload
  start_implementation: RevisionPayload & { attempt_id: AttemptID }
  complete_attempt: RevisionPayload & {
    attempt_id: AttemptID
    role: "implementer"
    interruption_status: "active" | "interrupted"
  }
  record_verification: RevisionPayload & { status: "passed" | "failed" }
  request_repair: Record<never, never>
  accept_repair: { resume_state: "spec_reviewing" | "plan_reviewing" | "implementation_reviewing" | "verifying" }
  capture_issue: {
    discovered_from?: {
      id: string
      source_work_unit_id: WorkUnitID
      source_session_event_id: string
      relationship: string
    }
  }
  cancel_work_unit: Record<never, never>
  supersede_work_unit: Record<never, never>
  abandon_work_unit: Record<never, never>
  interrupt_attempt: { attempt_id: AttemptID }
  recover_attempt: { attempt_id: AttemptID }
}

export type Command = DomainCommand

export type TransitionEvent = LifecycleEvent

export type TransitionSemantics = "terminal" | "repair_scoped" | "repair_accepted" | "resumable" | "retryable"
export type TransitionResult =
  | { ok: true; next_state: LifecycleState; events: TransitionEvent[]; semantics?: TransitionSemantics }
  | {
      ok: false
      rejection: { reason: RejectionReason; work_unit_id: WorkUnitID; command_id: CommandID }
      events: []
      next_state: LifecycleState
    }

type TransitionRule = {
  command: CommandType
  state: LifecycleState | readonly LifecycleState[]
  actor: CommandActor | readonly CommandActor[]
  events: readonly LifecycleEventType[] | ((aggregate: Aggregate, command: Command) => readonly LifecycleEventType[])
  next_state: LifecycleState | ((aggregate: Aggregate, command: Command) => LifecycleState)
  semantics?: TransitionSemantics | ((aggregate: Aggregate) => TransitionSemantics)
  when?: (command: Command) => boolean
}

const terminalEligibleStates = [
  "exploring",
  "bundle_reviewing",
  "bundle_approved",
  "directive_filed",
  "spec_reviewing",
  "spec_approved",
  "plan_reviewing",
  "plan_ready",
  "implementing",
  "verifying",
  "implementation_reviewing",
  "issue_captured",
  "repairing",
  "interrupted",
] as const satisfies readonly LifecycleState[]

function includes<const Value extends string>(value: string, allowed: Value | readonly Value[]) {
  return Array.isArray(allowed) ? allowed.includes(value) : allowed === value
}

function event(aggregate: Aggregate, command: Command, type: LifecycleEventType, index: number): TransitionEvent {
  return {
    id: Schema.decodeUnknownSync(LifecycleEventID)(`${command.id}:${index + 1}`),
    type,
    work_unit_id: command.work_unit_id,
    command_id: command.id,
    actor: command.actor,
    sequence: aggregate.aggregate_version + index + 1,
    aggregate_version: aggregate.aggregate_version + index + 1,
    occurred_at: command.occurred_at,
    data: command.payload ?? {},
  }
}

function rejected(aggregate: Aggregate, command: Command, reason: RejectionReason): TransitionResult {
  return {
    ok: false,
    rejection: { reason, work_unit_id: command.work_unit_id, command_id: command.id },
    events: [],
    next_state: aggregate.current_state,
  }
}

function retryExhaustedByRequest(aggregate: Aggregate) {
  return aggregate.retry_count + 1 >= aggregate.max_retries
}

function repairEvents(aggregate: Aggregate): readonly LifecycleEventType[] {
  return retryExhaustedByRequest(aggregate) ? ["retry.exhausted"] : ["repair.requested"]
}

function repairState(aggregate: Aggregate): LifecycleState {
  return retryExhaustedByRequest(aggregate) ? "retry_exhausted" : "repairing"
}

function repairSemantics(aggregate: Aggregate): TransitionSemantics {
  return retryExhaustedByRequest(aggregate) ? "terminal" : "retryable"
}

function repairResumeState(command: Command): LifecycleState {
  const state = command.type === "accept_repair" ? command.payload.resume_state : undefined
  if (
    state === "spec_reviewing" ||
    state === "plan_reviewing" ||
    state === "implementation_reviewing" ||
    state === "verifying"
  )
    return state
  return "implementation_reviewing"
}

const approved = (command: Command) =>
  command.type === "submit_review_verdict" && command.payload.verdict === "approved"
const changesRequested = (command: Command) =>
  command.type === "submit_review_verdict" && command.payload.verdict === "changes_requested"
const validationPassed = (command: Command) =>
  command.type === "record_validation" && command.payload.status === "passed"
const validationFailed = (command: Command) =>
  command.type === "record_validation" && command.payload.status === "failed"
const verificationPassed = (command: Command) =>
  command.type === "record_verification" && command.payload.status === "passed"
const verificationFailed = (command: Command) =>
  command.type === "record_verification" && command.payload.status === "failed"

export const TRANSITION_TABLE: readonly TransitionRule[] = [
  {
    command: "draft_bundle",
    state: "exploring",
    actor: ["human", "orchestrator"],
    events: ["bundle.drafted"],
    next_state: "bundle_reviewing",
  },
  {
    command: "approve_bundle",
    state: "bundle_reviewing",
    actor: "human",
    events: ["bundle.approved"],
    next_state: "bundle_approved",
  },
  {
    command: "file_directive",
    state: "bundle_approved",
    actor: "orchestrator",
    events: ["directive.filed"],
    next_state: "directive_filed",
  },
  {
    command: "draft_spec",
    state: "directive_filed",
    actor: "writer",
    events: ["spec.drafted"],
    next_state: "spec_reviewing",
  },
  {
    command: "record_validation",
    state: ["spec_reviewing", "plan_reviewing"],
    actor: "verifier",
    when: validationPassed,
    events: ["validation.passed"],
    next_state: (aggregate) => aggregate.current_state,
  },
  {
    command: "record_validation",
    state: ["spec_reviewing", "plan_reviewing"],
    actor: "verifier",
    when: validationFailed,
    events: ["validation.failed", "repair.requested"],
    next_state: "repairing",
    semantics: "repair_scoped",
  },
  {
    command: "submit_review_verdict",
    state: "spec_reviewing",
    actor: "reviewer",
    when: approved,
    events: ["review.approved", "spec.approved"],
    next_state: "spec_approved",
  },
  {
    command: "draft_plan",
    state: ["spec_approved", "issue_captured"],
    actor: ["writer", "orchestrator"],
    events: ["plan.drafted"],
    next_state: "plan_reviewing",
  },
  {
    command: "submit_review_verdict",
    state: "plan_reviewing",
    actor: "reviewer",
    when: approved,
    events: ["review.approved", "plan.ready"],
    next_state: "plan_ready",
  },
  {
    command: "start_implementation",
    state: "plan_ready",
    actor: "orchestrator",
    events: ["attempt.started"],
    next_state: "implementing",
  },
  {
    command: "complete_attempt",
    state: "implementing",
    actor: "implementer",
    events: ["attempt.completed"],
    next_state: "verifying",
  },
  {
    command: "record_verification",
    state: "verifying",
    actor: "verifier",
    when: verificationFailed,
    events: ["verification.failed", "repair.requested"],
    next_state: "repairing",
    semantics: "repair_scoped",
  },
  {
    command: "record_verification",
    state: "verifying",
    actor: "verifier",
    when: verificationPassed,
    events: ["verification.passed"],
    next_state: "implementation_reviewing",
  },
  {
    command: "submit_review_verdict",
    state: "implementation_reviewing",
    actor: "reviewer",
    when: approved,
    events: ["review.approved", "work_unit.completed"],
    next_state: "completed",
    semantics: "terminal",
  },
  {
    command: "submit_review_verdict",
    state: ["spec_reviewing", "plan_reviewing", "implementation_reviewing"],
    actor: "reviewer",
    when: changesRequested,
    events: ["review.changes_requested", "repair.requested"],
    next_state: "repairing",
    semantics: "repair_scoped",
  },
  {
    command: "request_repair",
    state: "repairing",
    actor: "orchestrator",
    events: repairEvents,
    next_state: repairState,
    semantics: repairSemantics,
  },
  {
    command: "accept_repair",
    state: "repairing",
    actor: ["reviewer", "verifier"],
    events: ["repair.accepted"],
    next_state: (_, command) => repairResumeState(command),
    semantics: "repair_accepted",
  },
  {
    command: "start_implementation",
    state: "repairing",
    actor: "orchestrator",
    events: ["repair.accepted", "attempt.started"],
    next_state: "implementing",
    semantics: "repair_accepted",
  },
  {
    command: "capture_issue",
    state: "exploring",
    actor: "human",
    events: ["issue.captured"],
    next_state: "issue_captured",
  },
  {
    command: "interrupt_attempt",
    state: "implementing",
    actor: "system",
    events: ["attempt.interrupted"],
    next_state: "interrupted",
    semantics: "resumable",
  },
  {
    command: "recover_attempt",
    state: "interrupted",
    actor: "orchestrator",
    events: ["attempt.recovered"],
    next_state: "implementing",
    semantics: "resumable",
  },
  {
    command: "supersede_work_unit",
    state: terminalEligibleStates,
    actor: "human",
    events: ["work_unit.superseded"],
    next_state: "superseded",
    semantics: "terminal",
  },
  {
    command: "abandon_work_unit",
    state: terminalEligibleStates,
    actor: "human",
    events: ["work_unit.abandoned"],
    next_state: "abandoned",
    semantics: "terminal",
  },
  {
    command: "cancel_work_unit",
    state: terminalEligibleStates,
    actor: "human",
    events: ["work_unit.cancelled"],
    next_state: "cancelled",
    semantics: "terminal",
  },
]

const contentDependentCommands = [
  "approve_bundle",
  "file_directive",
  "record_validation",
  "submit_review_verdict",
  "start_implementation",
  "complete_attempt",
  "record_verification",
] as const satisfies readonly CommandType[]

function revisionPreconditions(command: Command): readonly ArtifactRevisionPrecondition[] | undefined {
  if (!includes(command.type, contentDependentCommands)) return undefined
  return "artifact_revisions" in command.payload && Array.isArray(command.payload.artifact_revisions)
    ? command.payload.artifact_revisions
    : undefined
}

function expectedRevisionMismatch(aggregate: Aggregate, command: Command) {
  return (
    revisionPreconditions(command)?.some(
      (revision) =>
        aggregate.expected_revisions[revision.artifact_file_id] !== revision.expected_revision_id ||
        revision.actual_revision_id !== revision.expected_revision_id,
    ) ?? false
  )
}

function payloadValid(command: Command) {
  if (includes(command.type, contentDependentCommands) && !revisionPreconditions(command)?.length) return false
  if (command.type === "start_implementation") return typeof command.payload.attempt_id === "string"
  if (command.type === "complete_attempt") {
    return (
      typeof command.payload.attempt_id === "string" &&
      command.payload.role === "implementer" &&
      (command.payload.interruption_status === "active" || command.payload.interruption_status === "interrupted")
    )
  }
  if (command.type === "interrupt_attempt" || command.type === "recover_attempt")
    return typeof command.payload.attempt_id === "string"
  return true
}

function prerequisitesMet(aggregate: Aggregate, command: Command) {
  if (
    command.type === "submit_review_verdict" &&
    (aggregate.current_state === "spec_reviewing" || aggregate.current_state === "plan_reviewing")
  ) {
    return aggregate.validation_status === "passed"
  }
  if (command.type === "submit_review_verdict" && aggregate.current_state === "implementation_reviewing") {
    return aggregate.verification_status === "passed"
  }
  if (command.type === "start_implementation" && aggregate.current_state === "plan_ready")
    return aggregate.validation_status === "passed"
  return true
}

function matchingRule(aggregate: Aggregate, command: Command) {
  return TRANSITION_TABLE.find(
    (rule) =>
      rule.command === command.type &&
      includes(aggregate.current_state, rule.state) &&
      includes(command.actor, rule.actor) &&
      (!rule.when || rule.when(command)),
  )
}

function targetsAggregate(aggregate: Aggregate, command: Command) {
  // Commands are fenced to the single aggregate named by work_unit_id.
  return command.work_unit_id === aggregate.work_unit_id
}

function completionRejectionReason(aggregate: Aggregate, command: Command): RejectionReason | undefined {
  if (command.type !== "complete_attempt") return undefined
  if (
    aggregate.terminal ||
    includes(aggregate.current_state, ["completed", "retry_exhausted", "superseded", "abandoned", "cancelled"])
  )
    return "late_completion"
  if (aggregate.current_state !== "implementing") return "stale_attempt"
  if (command.payload.attempt_id !== aggregate.active_attempt_id) return "stale_attempt"
  if (command.payload.role !== undefined && command.payload.role !== command.actor) return "stale_attempt"
  if (command.payload.interruption_status === "interrupted") return "stale_attempt"
  return undefined
}

export function evaluateTransition(input: { aggregate: Aggregate; command: Command }): TransitionResult {
  if (!targetsAggregate(input.aggregate, input.command))
    return rejected(input.aggregate, input.command, "work_unit_mismatch")
  if (input.command.expected_aggregate_version !== input.aggregate.aggregate_version)
    return rejected(input.aggregate, input.command, "aggregate_version_conflict")
  const completionRejection = completionRejectionReason(input.aggregate, input.command)
  if (completionRejection) return rejected(input.aggregate, input.command, completionRejection)
  if (input.aggregate.terminal) return rejected(input.aggregate, input.command, "terminal_work_unit")
  if (!payloadValid(input.command)) return rejected(input.aggregate, input.command, "invalid_payload")
  if (expectedRevisionMismatch(input.aggregate, input.command))
    return rejected(input.aggregate, input.command, "stale_artifact_revision")
  if (!prerequisitesMet(input.aggregate, input.command))
    return rejected(input.aggregate, input.command, "missing_prerequisite")

  const candidateRules = TRANSITION_TABLE.filter(
    (rule) => rule.command === input.command.type && includes(input.aggregate.current_state, rule.state),
  )
  const rule = matchingRule(input.aggregate, input.command)
  if (!rule && candidateRules.some((candidate) => !includes(input.command.actor, candidate.actor)))
    return rejected(input.aggregate, input.command, "unauthorized_actor")
  if (!rule) return rejected(input.aggregate, input.command, "illegal_command")

  const events = typeof rule.events === "function" ? rule.events(input.aggregate, input.command) : rule.events
  const nextState =
    typeof rule.next_state === "function" ? rule.next_state(input.aggregate, input.command) : rule.next_state
  const semantics = typeof rule.semantics === "function" ? rule.semantics(input.aggregate) : rule.semantics
  return {
    ok: true,
    next_state: nextState,
    events: events.map((type, index) => event(input.aggregate, input.command, type, index)),
    ...(semantics ? { semantics } : {}),
  }
}

export * as Transition from "./transition"
