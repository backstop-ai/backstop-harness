import {
  ArtifactRevisionID,
  AttemptID,
  LEGAL_ACTIONS_BY_STATE,
  LIFECYCLE_STATES,
  type LifecycleEvent,
  type LifecycleState,
  type WorkUnitID,
} from "./schema"
import { Schema } from "effect"

export type EventV2 = Pick<LifecycleEvent, "type" | "work_unit_id" | "sequence" | "data"> & {
  id: string
}

export type WorkUnitProjection = {
  work_unit_id: WorkUnitID
  aggregate_version: number
  current_state: LifecycleState
  active_attempt: { attempt_id: AttemptID; role: string } | null
  blockers: { blocker_id: string; source_event_id: string; message: string }[]
  expected_revisions: Record<string, ArtifactRevisionID>
  validation_status: "passed" | "failed" | null
  verification_status: "passed" | "failed" | null
  terminal_outcome: { type: string; source_event_id: string; reason?: string } | null
  legal_next_actions: string[]
}

export type AppendAndProjectBoundaryResult =
  | { valid: true }
  | {
      valid: false
      reason:
        | "partial_append_without_projection"
        | "projection_without_committed_append"
        | "projection_does_not_match_events"
    }

type ProjectionState = Omit<WorkUnitProjection, "legal_next_actions">

function stringData(event: EventV2, key: string) {
  return typeof event.data[key] === "string" ? event.data[key] : undefined
}

function lifecycleStateData(event: EventV2, key: string) {
  const value = stringData(event, key)
  return LIFECYCLE_STATES.find((state) => state === value)
}

function legalNextActions(state: LifecycleState, terminal: boolean) {
  return terminal ? [] : [...LEGAL_ACTIONS_BY_STATE[state]]
}

function blocker(current: ProjectionState, event: EventV2) {
  return [
    ...current.blockers,
    {
      blocker_id: stringData(event, "blocker_id") ?? event.id,
      source_event_id: event.id,
      message: stringData(event, "message") ?? "",
    },
  ]
}

function foldEvent(current: ProjectionState, event: EventV2): ProjectionState {
  const next = {
    ...current,
    aggregate_version: Math.max(current.aggregate_version, event.sequence),
    expected_revisions: { ...current.expected_revisions },
  }
  if (event.type === "work_unit.opened")
    return { ...next, current_state: lifecycleStateData(event, "state") ?? "exploring" }
  if (event.type === "bundle.drafted") return withRevision(next, event, "bundle_reviewing")
  if (event.type === "bundle.approved") return { ...next, current_state: "bundle_approved" }
  if (event.type === "directive.filed") return withRevision(next, event, "directive_filed")
  if (event.type === "spec.drafted") return { ...withRevision(next, event, "spec_reviewing"), validation_status: null }
  if (event.type === "spec.approved") return { ...next, current_state: "spec_approved" }
  if (event.type === "plan.drafted") return { ...withRevision(next, event, "plan_reviewing"), validation_status: null }
  if (event.type === "plan.ready") return withRevision(next, event, "plan_ready")
  if (event.type === "issue.captured") return { ...next, current_state: "issue_captured" }
  if (
    event.type === "validation.failed" ||
    event.type === "verification.failed" ||
    event.type === "review.changes_requested"
  ) {
    return {
      ...next,
      current_state: "repairing",
      blockers: blocker(next, event),
      validation_status: event.type === "validation.failed" ? "failed" : next.validation_status,
      verification_status: event.type === "verification.failed" ? "failed" : next.verification_status,
    }
  }
  if (event.type === "validation.passed") return { ...next, validation_status: "passed" }
  if (event.type === "repair.requested") return { ...next, current_state: "repairing" }
  if (event.type === "repair.accepted") {
    const currentState = lifecycleStateData(event, "resume_state") ?? next.current_state
    return {
      ...next,
      current_state: currentState,
      blockers: [],
      validation_status:
        currentState === "spec_reviewing" || currentState === "plan_reviewing" ? null : next.validation_status,
      verification_status: currentState === "verifying" ? null : next.verification_status,
    }
  }
  if (event.type === "attempt.started") {
    return {
      ...next,
      current_state: "implementing",
      active_attempt: {
        attempt_id: Schema.decodeUnknownSync(AttemptID)(stringData(event, "attempt_id") ?? ""),
        role: stringData(event, "role") ?? "implementer",
      },
      blockers: [],
      verification_status: null,
    }
  }
  if (event.type === "attempt.interrupted") return { ...next, current_state: "interrupted" }
  if (event.type === "attempt.recovered") return { ...next, current_state: "implementing" }
  if (event.type === "attempt.completed")
    return next.terminal_outcome ? next : { ...next, current_state: "verifying", active_attempt: null }
  if (event.type === "verification.passed") {
    return next.terminal_outcome
      ? next
      : { ...next, current_state: "implementation_reviewing", verification_status: "passed" }
  }
  if (event.type === "retry.exhausted") return terminal(next, event, "retry_exhausted")
  if (event.type === "work_unit.superseded") return terminal(next, event, "superseded")
  if (event.type === "work_unit.abandoned") return terminal(next, event, "abandoned")
  if (event.type === "work_unit.cancelled") return terminal(next, event, "cancelled")
  if (event.type === "work_unit.completed") return terminal(next, event, "completed")
  return next
}

function withRevision(current: ProjectionState, event: EventV2, state: LifecycleState): ProjectionState {
  const artifactFileID = stringData(event, "artifact_file_id")
  const revisionID = stringData(event, "revision_id")
  return {
    ...current,
    current_state: state,
    expected_revisions:
      artifactFileID && revisionID
        ? { ...current.expected_revisions, [artifactFileID]: Schema.decodeUnknownSync(ArtifactRevisionID)(revisionID) }
        : current.expected_revisions,
  }
}

function terminal(current: ProjectionState, event: EventV2, state: LifecycleState): ProjectionState {
  return {
    ...current,
    current_state: state,
    active_attempt: null,
    terminal_outcome: { type: state, source_event_id: event.id, reason: stringData(event, "reason") },
  }
}

function initialProjection(workUnitID: WorkUnitID): ProjectionState {
  return {
    work_unit_id: workUnitID,
    aggregate_version: 0,
    current_state: "exploring",
    active_attempt: null,
    blockers: [],
    expected_revisions: {},
    validation_status: null,
    verification_status: null,
    terminal_outcome: null,
  }
}

function foldEvents(before: ProjectionState, events: readonly EventV2[]) {
  return events
    .filter((event) => event.work_unit_id === before.work_unit_id)
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
    .reduce(foldEvent, before)
}

function completeProjection(projection: ProjectionState): WorkUnitProjection {
  return {
    ...projection,
    legal_next_actions: legalNextActions(projection.current_state, projection.terminal_outcome !== null),
  }
}

export function projectWorkUnit(input: { work_unit_id: WorkUnitID; events: readonly EventV2[] }): WorkUnitProjection {
  return completeProjection(foldEvents(initialProjection(input.work_unit_id), input.events))
}

export function validateAppendAndProjectBoundary(input: {
  before: WorkUnitProjection
  appended_events: readonly EventV2[]
  after: WorkUnitProjection
  append_committed: boolean
  projection_updated: boolean
}): AppendAndProjectBoundaryResult {
  if (input.append_committed && !input.projection_updated)
    return { valid: false, reason: "partial_append_without_projection" }
  if (!input.append_committed && input.projection_updated)
    return { valid: false, reason: "projection_without_committed_append" }
  if (!input.append_committed) return { valid: true }

  const { legal_next_actions: _, ...before } = input.before
  const expected = completeProjection(foldEvents(before, input.appended_events))
  return JSON.stringify(expected) === JSON.stringify(input.after)
    ? { valid: true }
    : { valid: false, reason: "projection_does_not_match_events" }
}

export * as Projection from "./projection"
