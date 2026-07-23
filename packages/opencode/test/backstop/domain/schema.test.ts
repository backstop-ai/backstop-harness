import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import * as Domain from "../../../src/backstop/domain/schema"

describe("Backstop domain schema", () => {
  test("defines distinct branded identities", () => {
    expect(String(Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-001"))).toBe("BUNDLE-001")
    expect(String(Schema.decodeUnknownSync(Domain.CommandID)("CMD-001"))).toBe("CMD-001")
    expect(String(Schema.decodeUnknownSync(Domain.ArtifactFileID)("FILE-001"))).toBe("FILE-001")
    expect(String(Schema.decodeUnknownSync(Domain.AttributionCorrectionID)("CORRECTION-001"))).toBe("CORRECTION-001")

    const commandID = Schema.decodeUnknownSync(Domain.CommandID)("CMD-001")
    // @ts-expect-error command IDs cannot be used as work-unit IDs.
    const invalid: Domain.WorkUnitID = commandID
    void invalid
  })

  test("enumerates unambiguous product and reactive lifecycle vocabulary", () => {
    expect(Domain.LIFECYCLE_STATES).toEqual(
      expect.arrayContaining([
        "bundle_approved",
        "spec_approved",
        "plan_ready",
        "verifying",
        "implementation_reviewing",
        "issue_captured",
        "repairing",
      ]),
    )
    expect(Domain.LIFECYCLE_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "validation.failed",
        "review.changes_requested",
        "repair.requested",
        "repair.accepted",
        "verification.failed",
        "verification.passed",
      ]),
    )
    expect(Domain.COMMAND_TYPES).toEqual(expect.arrayContaining(["record_validation", "accept_repair"]))
    expect(Object.keys(Domain.LEGAL_ACTIONS_BY_STATE).sort()).toEqual([...Domain.LIFECYCLE_STATES].sort())
    expect(Domain.LEGAL_ACTIONS_BY_STATE.spec_approved).toContain("draft_plan")
    expect(Domain.LEGAL_ACTIONS_BY_STATE.bundle_approved).toContain("file_directive")
    expect(Domain.LEGAL_ACTIONS_BY_STATE.spec_approved).not.toContain("file_directive")
  })

  test("decodes command payloads by their discriminant", () => {
    const command = {
      id: "CMD-001",
      type: "start_implementation",
      actor: "orchestrator",
      work_unit_id: "BUNDLE-001",
      expected_aggregate_version: 4,
      occurred_at: "2026-07-22T00:00:00.000Z",
      payload: {
        attempt_id: "ATTEMPT-001",
        artifact_revisions: [
          {
            artifact_file_id: "FILE-001",
            expected_revision_id: "sha256:current",
            actual_revision_id: "sha256:current",
          },
        ],
      },
    }
    expect(Schema.decodeUnknownSync(Domain.Command)(command)).toMatchObject({ type: "start_implementation" })
    expect(() =>
      Schema.decodeUnknownSync(Domain.Command)({
        ...command,
        payload: { status: "passed", artifact_revisions: [] },
      }),
    ).toThrow()
  })

  test("requires exact work-unit attribution and typed discovered_from links", () => {
    const lifecycleEvent = {
      id: "EVT-001",
      type: "attempt.completed",
      work_unit_id: "BUNDLE-001",
      command_id: "CMD-001",
      actor: "implementer",
      sequence: 7,
      aggregate_version: 7,
      occurred_at: "2026-07-22T00:00:00.000Z",
      data: { attempt_id: "ATTEMPT-001" },
    }
    expect(Schema.decodeUnknownSync(Domain.LifecycleEvent)(lifecycleEvent)).toMatchObject({
      work_unit_id: "BUNDLE-001",
    })
    expect(() =>
      Schema.decodeUnknownSync(Domain.LifecycleEvent)({
        ...lifecycleEvent,
        work_unit_ids: ["BUNDLE-001"],
      }),
    ).toThrow()

    expect(
      Schema.decodeUnknownSync(Domain.DiscoveredFrom)({
        id: "CAUSE-001",
        source_work_unit_id: "BUNDLE-001",
        source_session_event_id: "SESSION-EVENT-001",
        relationship: "follow_on",
      }),
    ).toMatchObject({ source_work_unit_id: "BUNDLE-001", source_session_event_id: "SESSION-EVENT-001" })
    expect(() =>
      Schema.decodeUnknownSync(Domain.DiscoveredFrom)({
        id: "CAUSE-001",
        source_work_unit_id: "BUNDLE-001",
        relationship: "follow_on",
      }),
    ).toThrow()
  })

  test("models attribution corrections as append-only facts", () => {
    const correction = {
      id: "CORRECTION-001",
      type: "attribution.corrected",
      work_unit_id: "BUNDLE-002",
      original_event_id: "EVT-001",
      original_work_unit_id: "BUNDLE-001",
      corrected_work_unit_id: "BUNDLE-002",
      reason: "wrong session focus",
      corrected_by_command_id: "CMD-002",
      occurred_at: "2026-07-22T00:01:00.000Z",
    }
    expect(Schema.decodeUnknownSync(Domain.AttributionCorrection)(correction)).toMatchObject({
      original_event_id: "EVT-001",
    })
    expect(() =>
      Schema.decodeUnknownSync(Domain.AttributionCorrection)({ ...correction, original_event_id: undefined }),
    ).toThrow()
  })

  test("exports only Seed 1 domain surfaces", () => {
    expect(Domain.DOMAIN_MODULE_SCOPE).toEqual(["schema", "artifact-revision", "transition", "projection"])
    expect(Object.keys(Domain)).not.toEqual(
      expect.arrayContaining(["dispatchWorker", "renderControlPlane", "runBunVerifier"]),
    )
  })
})
