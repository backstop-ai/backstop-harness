import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import * as Projection from "../../../src/backstop/domain/projection"
import * as Domain from "../../../src/backstop/domain/schema"

const workUnitID = Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-001")
const event = (
  id: number,
  type: Domain.LifecycleEventType,
  data: Record<string, unknown> = {},
): Projection.EventV2 => ({
  id: `EVT-${id}`,
  type,
  work_unit_id: workUnitID,
  sequence: id,
  data,
})

describe("EventV2 work-unit projection", () => {
  test("projects the complete product lifecycle deterministically", () => {
    const events = [
      event(1, "bundle.drafted"),
      event(2, "bundle.approved"),
      event(3, "directive.filed"),
      event(4, "spec.drafted"),
      event(5, "spec.approved"),
      event(6, "plan.drafted"),
      event(7, "plan.ready"),
      event(8, "attempt.started", { attempt_id: "ATTEMPT-001", role: "implementer" }),
      event(9, "attempt.completed"),
      event(10, "verification.passed"),
    ]
    const result = Projection.projectWorkUnit({ work_unit_id: workUnitID, events })
    expect(result).toMatchObject({
      aggregate_version: 10,
      current_state: "implementation_reviewing",
      active_attempt: null,
      terminal_outcome: null,
    })
    expect(result).toEqual(Projection.projectWorkUnit({ work_unit_id: workUnitID, events: [...events].reverse() }))
  })

  test("projects verification failure into repairing with a blocker", () => {
    expect(
      Projection.projectWorkUnit({
        work_unit_id: workUnitID,
        events: [
          event(1, "attempt.started", { attempt_id: "ATTEMPT-001" }),
          event(2, "attempt.completed"),
          event(3, "verification.failed", { blocker_id: "BLOCKER-001", message: "tests failed" }),
          event(4, "repair.requested"),
        ],
      }),
    ).toMatchObject({
      current_state: "repairing",
      blockers: [{ blocker_id: "BLOCKER-001", source_event_id: "EVT-3", message: "tests failed" }],
    })
  })

  test("projects repair acceptance and replacement attempt", () => {
    expect(
      Projection.projectWorkUnit({
        work_unit_id: workUnitID,
        events: [
          event(1, "verification.failed", { message: "failed" }),
          event(2, "repair.requested"),
          event(3, "repair.accepted", { resume_state: "verifying" }),
          event(4, "attempt.started", { attempt_id: "ATTEMPT-002" }),
        ],
      }),
    ).toMatchObject({ current_state: "implementing", active_attempt: { attempt_id: "ATTEMPT-002" }, blockers: [] })
  })

  test("validates the complete append-and-project contract", () => {
    const before = Projection.projectWorkUnit({ work_unit_id: workUnitID, events: [event(1, "plan.ready")] })
    const appended = [event(2, "attempt.started", { attempt_id: "ATTEMPT-001" })]
    const after = Projection.projectWorkUnit({
      work_unit_id: workUnitID,
      events: [event(1, "plan.ready"), ...appended],
    })
    expect(
      Projection.validateAppendAndProjectBoundary({
        before,
        appended_events: appended,
        after,
        append_committed: true,
        projection_updated: true,
      }),
    ).toEqual({ valid: true })
    expect(
      Projection.validateAppendAndProjectBoundary({
        before,
        appended_events: appended,
        after: { ...after, active_attempt: null },
        append_committed: true,
        projection_updated: true,
      }),
    ).toEqual({ valid: false, reason: "projection_does_not_match_events" })
    expect(
      Projection.validateAppendAndProjectBoundary({
        before,
        appended_events: appended,
        after,
        append_committed: true,
        projection_updated: false,
      }),
    ).toEqual({ valid: false, reason: "partial_append_without_projection" })
  })

  test("ignores events from other work units", () => {
    expect(
      Projection.projectWorkUnit({
        work_unit_id: workUnitID,
        events: [
          {
            ...event(50, "work_unit.completed"),
            work_unit_id: Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-OTHER"),
          },
        ],
      }),
    ).toMatchObject({ aggregate_version: 0, current_state: "exploring", terminal_outcome: null })
  })
})
