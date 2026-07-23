import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import * as Transition from "../../../src/backstop/domain/transition"
import * as Domain from "../../../src/backstop/domain/schema"

const workUnitID = Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-001")
const artifactFileID = Schema.decodeUnknownSync(Domain.ArtifactFileID)("FILE-001")
const revisionID = Schema.decodeUnknownSync(Domain.ArtifactRevisionID)("sha256:current")
const attemptID = Schema.decodeUnknownSync(Domain.AttemptID)("ATTEMPT-001")
const revision = {
  artifact_file_id: artifactFileID,
  expected_revision_id: revisionID,
  actual_revision_id: revisionID,
}
const revisions = { artifact_revisions: [revision] }
const draft = { artifact_file_id: artifactFileID, revision_id: revisionID }
const baseAggregate: Transition.Aggregate = {
  work_unit_id: workUnitID,
  aggregate_version: 4,
  current_state: "exploring",
  active_attempt_id: null,
  terminal: false,
  retry_count: 0,
  max_retries: 3,
  expected_revisions: { [artifactFileID]: revisionID },
  validation_status: null,
  verification_status: null,
}

function command<Type extends Domain.CommandType>(
  type: Type,
  actor: Domain.CommandActor,
  payload: Transition.CommandPayloadByType[Type],
): Transition.Command {
  return Schema.decodeUnknownSync(Domain.Command)({
    id: "CMD-001",
    work_unit_id: workUnitID,
    expected_aggregate_version: 4,
    type,
    actor,
    occurred_at: "2026-07-22T00:00:00.000Z",
    payload,
  })
}

function transition(
  current_state: Domain.LifecycleState,
  input: Transition.Command,
  aggregate: Partial<Transition.Aggregate> = {},
) {
  return Transition.evaluateTransition({ aggregate: { ...baseAggregate, current_state, ...aggregate }, command: input })
}

describe("deterministic transition core", () => {
  test.each([
    {
      state: "exploring",
      input: command("draft_bundle", "human", draft),
      events: ["bundle.drafted"],
      nextState: "bundle_reviewing",
    },
    {
      state: "bundle_reviewing",
      input: command("approve_bundle", "human", revisions),
      events: ["bundle.approved"],
      nextState: "bundle_approved",
    },
    {
      state: "bundle_approved",
      input: command("file_directive", "orchestrator", revisions),
      events: ["directive.filed"],
      nextState: "directive_filed",
    },
    {
      state: "directive_filed",
      input: command("draft_spec", "writer", draft),
      events: ["spec.drafted"],
      nextState: "spec_reviewing",
    },
    {
      state: "spec_reviewing",
      input: command("submit_review_verdict", "reviewer", { verdict: "approved", ...revisions }),
      events: ["review.approved", "spec.approved"],
      nextState: "spec_approved",
      aggregate: { validation_status: "passed" },
    },
    {
      state: "spec_approved",
      input: command("draft_plan", "writer", draft),
      events: ["plan.drafted"],
      nextState: "plan_reviewing",
    },
    {
      state: "plan_reviewing",
      input: command("submit_review_verdict", "reviewer", { verdict: "approved", ...revisions }),
      events: ["review.approved", "plan.ready"],
      nextState: "plan_ready",
      aggregate: { validation_status: "passed" },
    },
    {
      state: "plan_ready",
      input: command("start_implementation", "orchestrator", { attempt_id: attemptID, ...revisions }),
      events: ["attempt.started"],
      nextState: "implementing",
      aggregate: { validation_status: "passed" },
    },
    {
      state: "implementing",
      input: command("complete_attempt", "implementer", {
        attempt_id: attemptID,
        role: "implementer",
        interruption_status: "active",
        ...revisions,
      }),
      events: ["attempt.completed"],
      nextState: "verifying",
      aggregate: { active_attempt_id: attemptID },
    },
    {
      state: "verifying",
      input: command("record_verification", "verifier", { status: "passed", ...revisions }),
      events: ["verification.passed"],
      nextState: "implementation_reviewing",
    },
    {
      state: "implementation_reviewing",
      input: command("submit_review_verdict", "reviewer", { verdict: "approved", ...revisions }),
      events: ["review.approved", "work_unit.completed"],
      nextState: "completed",
      aggregate: { verification_status: "passed" },
    },
  ] satisfies ReadonlyArray<{
    state: Domain.LifecycleState
    input: Transition.Command
    events: Domain.LifecycleEventType[]
    nextState: Domain.LifecycleState
    aggregate?: Partial<Transition.Aggregate>
  }>)("advances product path from $state", (row) => {
    const result = transition(row.state, row.input, row.aggregate)
    expect(result).toMatchObject({ ok: true, next_state: row.nextState })
    expect(result.events.map((item) => item.type)).toEqual(row.events)
  })

  test("advances reactive issue path into the shared plan lifecycle", () => {
    expect(
      transition(
        "exploring",
        command("capture_issue", "human", {
          discovered_from: {
            id: "CAUSE-001",
            source_work_unit_id: Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-OTHER"),
            source_session_event_id: "SESSION-EVENT-001",
            relationship: "follow_on",
          },
        }),
      ),
    ).toMatchObject({ ok: true, next_state: "issue_captured", events: [{ type: "issue.captured" }] })
    expect(transition("issue_captured", command("draft_plan", "orchestrator", draft))).toMatchObject({
      ok: true,
      next_state: "plan_reviewing",
      events: [{ type: "plan.drafted" }],
    })
  })

  test("models validation failure and repair acceptance explicitly", () => {
    expect(
      transition("spec_reviewing", command("record_validation", "verifier", { status: "failed", ...revisions })),
    ).toMatchObject({
      ok: true,
      next_state: "repairing",
      events: [{ type: "validation.failed" }, { type: "repair.requested" }],
      semantics: "repair_scoped",
    })
    expect(
      transition("repairing", command("accept_repair", "reviewer", { resume_state: "spec_reviewing" })),
    ).toMatchObject({
      ok: true,
      next_state: "spec_reviewing",
      events: [{ type: "repair.accepted" }],
      semantics: "repair_accepted",
    })
  })

  test("uses one retry threshold for events, state, and semantics", () => {
    expect(
      transition("repairing", command("request_repair", "orchestrator", {}), { retry_count: 1, max_retries: 3 }),
    ).toMatchObject({
      ok: true,
      next_state: "repairing",
      events: [{ type: "repair.requested" }],
      semantics: "retryable",
    })
    expect(
      transition("repairing", command("request_repair", "orchestrator", {}), { retry_count: 2, max_retries: 3 }),
    ).toMatchObject({
      ok: true,
      next_state: "retry_exhausted",
      events: [{ type: "retry.exhausted" }],
      semantics: "terminal",
    })
  })

  test.each([
    ["aggregate_version_conflict", { aggregate_version: 5 }, command("draft_bundle", "human", draft)],
    [
      "unauthorized_actor",
      { current_state: "bundle_reviewing" as const },
      command("approve_bundle", "writer", revisions),
    ],
    [
      "illegal_command",
      { current_state: "spec_approved" as const },
      command("file_directive", "orchestrator", revisions),
    ],
    [
      "late_completion",
      { current_state: "cancelled" as const, terminal: true },
      command("complete_attempt", "implementer", {
        attempt_id: attemptID,
        role: "implementer",
        interruption_status: "active",
        ...revisions,
      }),
    ],
    [
      "stale_attempt",
      { current_state: "interrupted" as const, active_attempt_id: attemptID },
      command("complete_attempt", "implementer", {
        attempt_id: attemptID,
        role: "implementer",
        interruption_status: "active",
        ...revisions,
      }),
    ],
    [
      "late_completion",
      { current_state: "retry_exhausted" as const },
      command("complete_attempt", "implementer", {
        attempt_id: attemptID,
        role: "implementer",
        interruption_status: "active",
        ...revisions,
      }),
    ],
  ] as const)("rejects %s without events", (reason, aggregate, input) => {
    expect(
      Transition.evaluateTransition({ aggregate: { ...baseAggregate, ...aggregate }, command: input }),
    ).toMatchObject({
      ok: false,
      rejection: { reason },
      events: [],
    })
  })

  test("fences commands to their named work-unit aggregate", () => {
    expect(
      Transition.evaluateTransition({
        aggregate: baseAggregate,
        command: {
          ...command("draft_bundle", "human", draft),
          work_unit_id: Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-OTHER"),
        },
      }),
    ).toMatchObject({ ok: false, rejection: { reason: "work_unit_mismatch" }, events: [] })
  })

  test("requires validation and verification prerequisites before approval", () => {
    expect(
      transition("spec_reviewing", command("submit_review_verdict", "reviewer", { verdict: "approved", ...revisions })),
    ).toMatchObject({
      ok: false,
      rejection: { reason: "missing_prerequisite" },
    })
    expect(
      transition(
        "implementation_reviewing",
        command("submit_review_verdict", "reviewer", { verdict: "approved", ...revisions }),
      ),
    ).toMatchObject({
      ok: false,
      rejection: { reason: "missing_prerequisite" },
    })
  })

  test("requires current artifact revision pins for content-dependent commands", () => {
    expect(
      transition(
        "verifying",
        command("record_verification", "verifier", {
          status: "passed",
          artifact_revisions: [
            {
              ...revision,
              actual_revision_id: Schema.decodeUnknownSync(Domain.ArtifactRevisionID)("sha256:changed"),
            },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, rejection: { reason: "stale_artifact_revision" }, events: [] })

    const missingPins = command("record_verification", "verifier", { status: "passed", artifact_revisions: [] })
    expect(transition("verifying", missingPins)).toMatchObject({
      ok: false,
      rejection: { reason: "invalid_payload" },
      events: [],
    })
  })

  test("emits appendable lifecycle events with deterministic timestamps and ordering", () => {
    const result = transition("exploring", command("draft_bundle", "human", draft))
    expect(result.ok).toBeTrue()
    if (!result.ok) return
    expect(result.events[0]).toMatchObject({
      sequence: 5,
      aggregate_version: 5,
      occurred_at: "2026-07-22T00:00:00.000Z",
    })
    expect(Schema.decodeUnknownSync(Domain.LifecycleEvent)(result.events[0])).toEqual(result.events[0])
  })
})
