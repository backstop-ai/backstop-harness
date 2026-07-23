import { Schema } from "effect"

const brandedID = <const Name extends string>(name: Name) => Schema.String.pipe(Schema.brand(name))
const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input)
const hasOnlyKeys = (input: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(input).every((key) => keys.includes(key)) && keys.every((key) => key in input)
const isOneOf = <const Values extends readonly string[]>(values: Values, input: unknown): input is Values[number] =>
  typeof input === "string" && values.some((value) => value === input)

export const DOMAIN_MODULE_SCOPE = ["schema", "artifact-revision", "transition", "projection"] as const

export const DOMAIN_VERIFICATION_FILES = [
  "packages/opencode/src/backstop/domain/README.md",
  "packages/opencode/src/backstop/domain/artifact-revision.ts",
  "packages/opencode/src/backstop/domain/projection.ts",
  "packages/opencode/src/backstop/domain/schema.ts",
  "packages/opencode/src/backstop/domain/transition.ts",
  "packages/opencode/test/backstop/domain/artifact-revision.test.ts",
  "packages/opencode/test/backstop/domain/projection.test.ts",
  "packages/opencode/test/backstop/domain/schema.test.ts",
  "packages/opencode/test/backstop/domain/transition.test.ts",
] as const

export const WorkUnitID = brandedID("WorkUnitID")
export type WorkUnitID = Schema.Schema.Type<typeof WorkUnitID>
export const CommandID = brandedID("CommandID")
export type CommandID = Schema.Schema.Type<typeof CommandID>
export const LifecycleEventID = brandedID("LifecycleEventID")
export type LifecycleEventID = Schema.Schema.Type<typeof LifecycleEventID>
export const AttemptID = brandedID("AttemptID")
export type AttemptID = Schema.Schema.Type<typeof AttemptID>
export const SessionEventID = brandedID("SessionEventID")
export type SessionEventID = Schema.Schema.Type<typeof SessionEventID>
export const ArtifactFileID = brandedID("ArtifactFileID")
export type ArtifactFileID = Schema.Schema.Type<typeof ArtifactFileID>
export const ArtifactRevisionID = brandedID("ArtifactRevisionID")
export type ArtifactRevisionID = Schema.Schema.Type<typeof ArtifactRevisionID>
export const EvidenceID = brandedID("EvidenceID")
export type EvidenceID = Schema.Schema.Type<typeof EvidenceID>
export const ReviewID = brandedID("ReviewID")
export type ReviewID = Schema.Schema.Type<typeof ReviewID>
export const CausalLinkID = brandedID("CausalLinkID")
export type CausalLinkID = Schema.Schema.Type<typeof CausalLinkID>
export const AttributionCorrectionID = brandedID("AttributionCorrectionID")
export type AttributionCorrectionID = Schema.Schema.Type<typeof AttributionCorrectionID>

export const LIFECYCLE_STATES = [
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
  "completed",
  "retry_exhausted",
  "superseded",
  "abandoned",
  "cancelled",
] as const

export const COMMAND_TYPES = [
  "draft_bundle",
  "approve_bundle",
  "file_directive",
  "draft_spec",
  "record_validation",
  "submit_review_verdict",
  "draft_plan",
  "start_implementation",
  "complete_attempt",
  "record_verification",
  "request_repair",
  "accept_repair",
  "capture_issue",
  "cancel_work_unit",
  "supersede_work_unit",
  "abandon_work_unit",
  "interrupt_attempt",
  "recover_attempt",
] as const

export const COMMAND_ACTORS = [
  "human",
  "orchestrator",
  "writer",
  "reviewer",
  "implementer",
  "verifier",
  "system",
] as const

export const LIFECYCLE_EVENT_TYPES = [
  "work_unit.opened",
  "bundle.drafted",
  "bundle.approved",
  "directive.filed",
  "spec.drafted",
  "validation.passed",
  "validation.failed",
  "review.approved",
  "review.changes_requested",
  "spec.approved",
  "plan.drafted",
  "plan.ready",
  "issue.captured",
  "attempt.started",
  "attempt.completed",
  "verification.failed",
  "verification.passed",
  "repair.requested",
  "repair.accepted",
  "retry.exhausted",
  "attempt.interrupted",
  "attempt.recovered",
  "work_unit.superseded",
  "work_unit.abandoned",
  "work_unit.cancelled",
  "attempt.completion_ignored",
  "work_unit.completed",
  "attribution.corrected",
] as const

export const REJECTION_REASONS = [
  "work_unit_mismatch",
  "aggregate_version_conflict",
  "stale_artifact_revision",
  "unauthorized_actor",
  "illegal_command",
  "invalid_payload",
  "terminal_work_unit",
  "stale_attempt",
  "late_completion",
  "missing_attribution",
  "missing_prerequisite",
] as const

export const LifecycleState = Schema.Literals(LIFECYCLE_STATES)
export type LifecycleState = (typeof LIFECYCLE_STATES)[number]
export const CommandType = Schema.Literals(COMMAND_TYPES)
export type CommandType = (typeof COMMAND_TYPES)[number]
export const CommandActor = Schema.Literals(COMMAND_ACTORS)
export type CommandActor = (typeof COMMAND_ACTORS)[number]
export const LifecycleEventType = Schema.Literals(LIFECYCLE_EVENT_TYPES)
export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPES)[number]
export const RejectionReason = Schema.Literals(REJECTION_REASONS)
export type RejectionReason = (typeof REJECTION_REASONS)[number]

export const ArtifactRevisionPrecondition = Schema.Struct({
  artifact_file_id: ArtifactFileID,
  expected_revision_id: ArtifactRevisionID,
  actual_revision_id: ArtifactRevisionID,
})
export type ArtifactRevisionPrecondition = Schema.Schema.Type<typeof ArtifactRevisionPrecondition>

export const ArtifactRevisionPreconditions = Schema.Struct({
  artifact_revisions: Schema.Array(ArtifactRevisionPrecondition),
})
export const DraftArtifactPayload = Schema.Struct({
  artifact_file_id: ArtifactFileID,
  revision_id: ArtifactRevisionID,
})
export const ReviewVerdictPayload = Schema.Struct({
  verdict: Schema.Literals(["approved", "changes_requested"] as const),
  artifact_revisions: Schema.Array(ArtifactRevisionPrecondition),
})
export const ValidationPayload = Schema.Struct({
  status: Schema.Literals(["passed", "failed"] as const),
  artifact_revisions: Schema.Array(ArtifactRevisionPrecondition),
})
export const StartImplementationPayload = Schema.Struct({
  attempt_id: AttemptID,
  artifact_revisions: Schema.Array(ArtifactRevisionPrecondition),
})
export const CompleteAttemptPayload = Schema.Struct({
  attempt_id: AttemptID,
  role: Schema.Literals(["implementer"] as const),
  interruption_status: Schema.Literals(["active", "interrupted"] as const),
  artifact_revisions: Schema.Array(ArtifactRevisionPrecondition),
})
export const AcceptRepairPayload = Schema.Struct({
  resume_state: Schema.Literals(["spec_reviewing", "plan_reviewing", "implementation_reviewing", "verifying"] as const),
})
export const CaptureIssuePayload = Schema.Struct({
  discovered_from: Schema.optional(
    Schema.Struct({
      id: CausalLinkID,
      source_work_unit_id: WorkUnitID,
      source_session_event_id: SessionEventID,
      relationship: Schema.String,
    }),
  ),
})
export const EmptyCommandPayload = Schema.Struct({})

export const COMMAND_PAYLOAD_SCHEMAS = {
  draft_bundle: DraftArtifactPayload,
  approve_bundle: ArtifactRevisionPreconditions,
  file_directive: ArtifactRevisionPreconditions,
  draft_spec: DraftArtifactPayload,
  record_validation: ValidationPayload,
  submit_review_verdict: ReviewVerdictPayload,
  draft_plan: DraftArtifactPayload,
  start_implementation: StartImplementationPayload,
  complete_attempt: CompleteAttemptPayload,
  record_verification: ValidationPayload,
  request_repair: EmptyCommandPayload,
  accept_repair: AcceptRepairPayload,
  capture_issue: CaptureIssuePayload,
  cancel_work_unit: EmptyCommandPayload,
  supersede_work_unit: EmptyCommandPayload,
  abandon_work_unit: EmptyCommandPayload,
  interrupt_attempt: Schema.Struct({ attempt_id: AttemptID }),
  recover_attempt: Schema.Struct({ attempt_id: AttemptID }),
} as const

const commandSchema = <Type extends CommandType, Payload extends Schema.Top>(type: Type, payload: Payload) =>
  Schema.Struct({
    id: CommandID,
    type: Schema.Literals([type]),
    actor: CommandActor,
    work_unit_id: WorkUnitID,
    expected_aggregate_version: Schema.Number,
    occurred_at: Schema.String,
    payload,
  })

export const Command = Schema.Union([
  commandSchema("draft_bundle", COMMAND_PAYLOAD_SCHEMAS.draft_bundle),
  commandSchema("approve_bundle", COMMAND_PAYLOAD_SCHEMAS.approve_bundle),
  commandSchema("file_directive", COMMAND_PAYLOAD_SCHEMAS.file_directive),
  commandSchema("draft_spec", COMMAND_PAYLOAD_SCHEMAS.draft_spec),
  commandSchema("record_validation", COMMAND_PAYLOAD_SCHEMAS.record_validation),
  commandSchema("submit_review_verdict", COMMAND_PAYLOAD_SCHEMAS.submit_review_verdict),
  commandSchema("draft_plan", COMMAND_PAYLOAD_SCHEMAS.draft_plan),
  commandSchema("start_implementation", COMMAND_PAYLOAD_SCHEMAS.start_implementation),
  commandSchema("complete_attempt", COMMAND_PAYLOAD_SCHEMAS.complete_attempt),
  commandSchema("record_verification", COMMAND_PAYLOAD_SCHEMAS.record_verification),
  commandSchema("request_repair", COMMAND_PAYLOAD_SCHEMAS.request_repair),
  commandSchema("accept_repair", COMMAND_PAYLOAD_SCHEMAS.accept_repair),
  commandSchema("capture_issue", COMMAND_PAYLOAD_SCHEMAS.capture_issue),
  commandSchema("cancel_work_unit", COMMAND_PAYLOAD_SCHEMAS.cancel_work_unit),
  commandSchema("supersede_work_unit", COMMAND_PAYLOAD_SCHEMAS.supersede_work_unit),
  commandSchema("abandon_work_unit", COMMAND_PAYLOAD_SCHEMAS.abandon_work_unit),
  commandSchema("interrupt_attempt", COMMAND_PAYLOAD_SCHEMAS.interrupt_attempt),
  commandSchema("recover_attempt", COMMAND_PAYLOAD_SCHEMAS.recover_attempt),
])
export type Command = Schema.Schema.Type<typeof Command>

export const Rejection = Schema.Struct({
  reason: RejectionReason,
  work_unit_id: WorkUnitID,
  command_id: CommandID,
  message: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

export interface LifecycleEvent {
  id: LifecycleEventID
  type: LifecycleEventType
  work_unit_id: WorkUnitID
  command_id: CommandID
  actor: CommandActor
  sequence: number
  aggregate_version: number
  occurred_at: string
  data: Record<string, unknown>
}

export const LifecycleEvent = Schema.declare<LifecycleEvent>((input): input is LifecycleEvent => {
  if (!isRecord(input)) return false
  if (
    !hasOnlyKeys(input, [
      "id",
      "type",
      "work_unit_id",
      "command_id",
      "actor",
      "sequence",
      "aggregate_version",
      "occurred_at",
      "data",
    ])
  )
    return false
  return (
    typeof input.id === "string" &&
    isOneOf(LIFECYCLE_EVENT_TYPES, input.type) &&
    typeof input.work_unit_id === "string" &&
    typeof input.command_id === "string" &&
    isOneOf(COMMAND_ACTORS, input.actor) &&
    typeof input.sequence === "number" &&
    Number.isFinite(input.sequence) &&
    typeof input.aggregate_version === "number" &&
    Number.isFinite(input.aggregate_version) &&
    typeof input.occurred_at === "string" &&
    isRecord(input.data)
  )
})

export const Attempt = Schema.Struct({
  attempt_id: AttemptID,
  work_unit_id: WorkUnitID,
  role: CommandActor,
  status: Schema.Literals(["active", "completed", "interrupted", "cancelled", "stale", "late"] as const),
})

export const AggregateState = Schema.Struct({
  work_unit_id: WorkUnitID,
  aggregate_version: Schema.Number,
  current_state: LifecycleState,
  active_attempt_id: Schema.NullOr(AttemptID),
  terminal: Schema.Boolean,
  retry_count: Schema.Number,
  expected_revisions: Schema.Record(Schema.String, ArtifactRevisionID),
  validation_status: Schema.NullOr(Schema.Literals(["passed", "failed"] as const)),
  verification_status: Schema.NullOr(Schema.Literals(["passed", "failed"] as const)),
  legal_next_actions: Schema.Array(CommandType),
})

export const EvidenceReference = Schema.Struct({
  evidence_id: EvidenceID,
  work_unit_id: WorkUnitID,
  source_event_id: SessionEventID,
  summary: Schema.String,
})

export const ReviewRecord = Schema.Struct({
  review_id: ReviewID,
  work_unit_id: WorkUnitID,
  command_id: CommandID,
  verdict: Schema.Literals(["approved", "changes_requested"] as const),
  evidence_ids: Schema.Array(EvidenceID),
})

export interface AttributionCorrection {
  id: AttributionCorrectionID
  type: "attribution.corrected"
  work_unit_id: WorkUnitID
  original_event_id: LifecycleEventID
  original_work_unit_id: WorkUnitID
  corrected_work_unit_id: WorkUnitID
  reason: string
  corrected_by_command_id: CommandID
  occurred_at: string
}

export const AttributionCorrection = Schema.declare<AttributionCorrection>((input): input is AttributionCorrection => {
  if (!isRecord(input)) return false
  if (
    !hasOnlyKeys(input, [
      "id",
      "type",
      "work_unit_id",
      "original_event_id",
      "original_work_unit_id",
      "corrected_work_unit_id",
      "reason",
      "corrected_by_command_id",
      "occurred_at",
    ])
  )
    return false
  return (
    typeof input.id === "string" &&
    input.type === "attribution.corrected" &&
    typeof input.work_unit_id === "string" &&
    typeof input.original_event_id === "string" &&
    typeof input.original_work_unit_id === "string" &&
    typeof input.corrected_work_unit_id === "string" &&
    typeof input.reason === "string" &&
    typeof input.corrected_by_command_id === "string" &&
    typeof input.occurred_at === "string"
  )
})

export interface DiscoveredFrom {
  id: CausalLinkID
  source_work_unit_id: WorkUnitID
  source_session_event_id: SessionEventID
  relationship: string
}

export const DiscoveredFrom = Schema.declare<DiscoveredFrom>((input): input is DiscoveredFrom => {
  if (!isRecord(input)) return false
  if (!hasOnlyKeys(input, ["id", "source_work_unit_id", "source_session_event_id", "relationship"])) return false
  return (
    typeof input.id === "string" &&
    typeof input.source_work_unit_id === "string" &&
    typeof input.source_session_event_id === "string" &&
    typeof input.relationship === "string"
  )
})

export const LEGAL_ACTIONS_BY_STATE = {
  exploring: ["draft_bundle", "capture_issue", "cancel_work_unit"],
  bundle_reviewing: ["approve_bundle", "cancel_work_unit"],
  bundle_approved: ["file_directive", "cancel_work_unit", "supersede_work_unit"],
  directive_filed: ["draft_spec", "cancel_work_unit", "supersede_work_unit"],
  spec_reviewing: ["record_validation", "submit_review_verdict", "cancel_work_unit", "supersede_work_unit"],
  spec_approved: ["draft_plan", "cancel_work_unit", "supersede_work_unit"],
  plan_reviewing: ["record_validation", "submit_review_verdict", "cancel_work_unit", "supersede_work_unit"],
  plan_ready: ["start_implementation", "cancel_work_unit", "supersede_work_unit", "abandon_work_unit"],
  implementing: ["complete_attempt", "interrupt_attempt", "cancel_work_unit"],
  verifying: ["record_verification", "cancel_work_unit", "supersede_work_unit", "abandon_work_unit"],
  implementation_reviewing: [
    "submit_review_verdict",
    "request_repair",
    "cancel_work_unit",
    "supersede_work_unit",
    "abandon_work_unit",
  ],
  issue_captured: ["draft_plan", "cancel_work_unit"],
  repairing: [
    "accept_repair",
    "start_implementation",
    "request_repair",
    "cancel_work_unit",
    "supersede_work_unit",
    "abandon_work_unit",
  ],
  interrupted: ["recover_attempt", "cancel_work_unit"],
  completed: [],
  retry_exhausted: [],
  superseded: [],
  abandoned: [],
  cancelled: [],
} satisfies Record<LifecycleState, readonly CommandType[]>

export * as BackstopDomainSchema from "./schema"
