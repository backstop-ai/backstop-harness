import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { BackstopEvent } from "@opencode-ai/schema"
import * as Model from "../../src/backstop/artifact/model"
import * as Traceability from "../../src/backstop/artifact/traceability"

const workUnitID = Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001")
const fileID = (id: string) => Schema.decodeUnknownSync(BackstopEvent.ArtifactFileID)(id)
const revisionID = (id: string) => Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionID)(id)

function revision(
  input: Partial<Model.ArtifactRevision> &
    Pick<Model.ArtifactRevision, "artifactKind" | "authoredID" | "artifactPath" | "projection">,
): Model.ArtifactRevision {
  return {
    projectID: input.projectID ?? "project-1",
    workUnitID: input.workUnitID ?? workUnitID,
    artifactFileID: input.artifactFileID ?? fileID(`FILE-${input.authoredID}`),
    artifactPath: input.artifactPath,
    artifactKind: input.artifactKind,
    authoredID: input.authoredID,
    schemaVersion: input.schemaVersion ?? `${input.artifactKind}/v1`,
    revisionID: input.revisionID ?? revisionID(`sha256:${input.authoredID}`),
    normalizedContentBase64: input.normalizedContentBase64 ?? "e30=",
    normalizedByteLength: input.normalizedByteLength ?? 2,
    importedAt: input.importedAt ?? "2026-07-22T00:00:00.000Z",
    canonicalValidation: input.canonicalValidation ?? "unknown",
    projection: input.projection,
  }
}

const bundle = revision({
  artifactKind: "bundle",
  authoredID: "BUNDLE-001",
  artifactPath: "bundles/BUNDLE-001.bundle.md",
  schemaVersion: "bundle/v2",
  projection: {
    bundleName: "ambient-backstop-orchestration",
    requirements: [{ id: "REQ-006", text: "revisions", version: "1.0.0", supports: [] }],
    claims: [],
    tasks: [],
    sources: [],
    repairObligations: [],
  },
})
const spec = revision({
  artifactKind: "spec",
  authoredID: "SPEC-002",
  artifactPath: "specs/SPEC-002.spec.md",
  projection: {
    requirements: [{ id: "REQ-001", text: "snapshots", supports: ["ambient-backstop-orchestration:REQ-006@1.0.0"] }],
    claims: [{ id: "CLM-001", requirementID: "REQ-001", text: "stored", tests: ["persists snapshots"] }],
    tasks: [],
    sources: [],
    repairObligations: [],
  },
})
const plan = revision({
  artifactKind: "plan",
  authoredID: "PLAN-SPEC-002",
  artifactPath: "plans/PLAN-SPEC-002.plan.yml",
  projection: {
    targetArtifactID: "SPEC-002",
    requirements: [],
    claims: [],
    sources: [],
    repairObligations: [],
    tasks: [{ id: "TASK-001", claims: ["CLM-001"], testNames: ["persists snapshots"], dependsOn: [] }],
  },
})

describe("Backstop artifact projection", () => {
  test("fails closed on malformed and unsupported artifact projections", () => {
    expect(Model.projectArtifact({ artifactKind: "spec", schemaVersion: "spec/v2", document: {} })).toMatchObject({
      status: "parse_failed",
      diagnostics: [{ code: "unsupported_schema_version" }],
    })
    expect(
      Model.projectArtifact({ artifactKind: "spec", schemaVersion: "spec/v1", document: { requirements: [{}] } }),
    ).toMatchObject({ status: "parse_failed", diagnostics: [{ code: "malformed_requirement" }] })
  })

  test("projects bounded bundle spec plan directive and issue facts", () => {
    expect(
      Model.projectArtifact({
        artifactKind: "bundle",
        schemaVersion: "bundle/v2",
        document: {
          bundle: { name: "ambient-backstop-orchestration" },
          status: "defined",
          requirements: [{ id: "REQ-001", text: "fact", version: "1.0.0" }],
        },
      }),
    ).toMatchObject({
      status: "parsed",
      projection: {
        bundleName: "ambient-backstop-orchestration",
        status: "defined",
        requirements: [{ id: "REQ-001", version: "1.0.0" }],
      },
    })
    expect(
      Model.projectArtifact({
        artifactKind: "plan",
        schemaVersion: "plan/v1",
        document: {
          spec_id: "SPEC-002",
          phases: [
            {
              tasks: [
                {
                  id: "TASK-001",
                  claims: ["CLM-001"],
                  test_names: ["persists snapshots"],
                  depends_on: [],
                },
              ],
            },
          ],
        },
      }),
    ).toMatchObject({
      status: "parsed",
      projection: { targetArtifactID: "SPEC-002", tasks: [{ id: "TASK-001" }] },
    })
    expect(
      Model.projectArtifact({
        artifactKind: "directive",
        schemaVersion: "directive/v1",
        document: { directive: { source: ["BUNDLE-001"], spec: "SPEC-002" } },
      }),
    ).toMatchObject({
      status: "parsed",
      projection: { sources: ["BUNDLE-001"], targetArtifactID: "SPEC-002" },
    })
    expect(
      Model.projectArtifact({
        artifactKind: "issue",
        schemaVersion: "issue/v1",
        document: {
          issue: {
            status: "closed",
            delivered_by: "PLAN-ISSUE-001",
            "resolved-by": "commit:abc",
            repair_obligations: ["REQ-001"],
          },
        },
      }),
    ).toMatchObject({
      status: "parsed",
      projection: {
        status: "closed",
        deliveredBy: "PLAN-ISSUE-001",
        resolvedBy: "commit:abc",
        repairObligations: ["REQ-001"],
      },
    })
  })

  test("rejects malformed documents claims and plan tasks", () => {
    expect(Model.projectArtifact({ artifactKind: "spec", schemaVersion: "spec/v1", document: null })).toMatchObject({
      status: "parse_failed",
      diagnostics: [{ code: "malformed_document" }],
    })
    expect(
      Model.projectArtifact({
        artifactKind: "spec",
        schemaVersion: "spec/v1",
        document: { claims: [{ id: "CLM-001", requirement: "REQ-001", text: "fact", tests: [1] }] },
      }),
    ).toMatchObject({ status: "parse_failed", diagnostics: [{ code: "malformed_claim" }] })
    expect(
      Model.projectArtifact({
        artifactKind: "plan",
        schemaVersion: "plan/v1",
        document: { phases: [{ tasks: [{ id: "TASK-001", claims: false }] }] },
      }),
    ).toMatchObject({ status: "parse_failed", diagnostics: [{ code: "malformed_task" }] })
  })
})

describe("Backstop traceability graph", () => {
  test("isolates repeated requirement and claim IDs by artifact revision", () => {
    const graph = Traceability.buildTraceabilityGraph([bundle, spec])
    expect(graph.nodes.filter((node) => node.localID === "REQ-001")).toHaveLength(1)
    expect(graph.nodes.find((node) => node.localID === "REQ-001")?.id).toContain(String(spec.revisionID))
  })

  test("resolves cross-artifact references deterministically", () => {
    const expected = Traceability.buildTraceabilityGraph([bundle, spec, plan])
    expect(expected.resolutions).toEqual(Traceability.buildTraceabilityGraph([plan, spec, bundle]).resolutions)
    expect(expected.resolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "ambient-backstop-orchestration:REQ-006@1.0.0", status: "resolved" }),
        expect.objectContaining({ reference: "SPEC-002", status: "resolved" }),
      ]),
    )
  })

  test("reports invalid missing ambiguous and stale references without guessing", () => {
    const invalid = revision({
      artifactKind: "spec",
      authoredID: "SPEC-INVALID",
      artifactPath: "specs/SPEC-INVALID.spec.md",
      projection: {
        requirements: [
          { id: "REQ-001", text: "invalid", supports: ["not-a-reference"] },
          { id: "REQ-002", text: "missing", supports: ["missing:REQ-001@1.0.0"] },
          {
            id: "REQ-003",
            text: "stale",
            supports: ["ambient-backstop-orchestration:REQ-006@2.0.0"],
          },
        ],
        claims: [{ id: "CLM-MISSING", requirementID: "REQ-404", text: "missing", tests: [] }],
        tasks: [],
        sources: [],
        repairObligations: [],
      },
    })
    expect(Traceability.buildTraceabilityGraph([bundle, invalid]).resolutions.map((item) => item.status)).toEqual(
      expect.arrayContaining(["invalid_ref", "missing_artifact", "semantic_pin_stale", "missing_node"]),
    )

    const duplicate = revision({
      ...bundle,
      artifactFileID: fileID("FILE-BUNDLE-DUPLICATE"),
      revisionID: revisionID("sha256:BUNDLE-DUPLICATE"),
      artifactPath: "bundles/BUNDLE-DUPLICATE.bundle.md",
    })
    expect(Traceability.buildTraceabilityGraph([bundle, duplicate, spec]).resolutions).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "ambiguous_artifact" })]),
    )
  })

  test("reports deterministic requirements-to-evidence completeness gaps", () => {
    const graph = Traceability.buildTraceabilityGraph([bundle, spec, plan])
    expect(Traceability.queryCompleteness({ graph, evidence: [] })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "evidence_missing" })]),
    )
  })

  test("reports stale evidence without changing structural completeness", () => {
    const graph = Traceability.buildTraceabilityGraph([bundle, spec, plan])
    const claim = graph.nodes.find((node) => node.type === "claim")
    expect(claim).toBeDefined()
    if (!claim) return
    const evidence: Traceability.EvidenceRecord = {
      evidenceID: "EVIDENCE-001",
      workUnitID: String(workUnitID),
      artifactRevisions: [{ artifactFileID: spec.artifactFileID, revisionID: spec.revisionID }],
      claimNodeIDs: [claim.id],
      taskNodeIDs: [],
      name: "persists snapshots",
      repositoryRevision: "old",
      semanticScope: "repair",
      result: "passed",
    }
    const stale = Traceability.queryStaleEvidence({
      evidence: [evidence],
      currentRevisions: new Map([[spec.artifactFileID, revisionID("sha256:new")]]),
      currentRepositoryRevision: "new",
    })
    expect(stale).toEqual([
      {
        evidenceID: "EVIDENCE-001",
        reasons: ["artifact_revision_changed", "repair_scope_not_final", "repository_revision_changed"],
      },
    ])
    expect(Traceability.queryCompleteness({ graph, evidence: [evidence] })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "evidence_missing" })]),
    )
  })

  test("reports missing failed and interrupted evidence inputs", () => {
    const missingFile = fileID("FILE-MISSING")
    const records: Traceability.EvidenceRecord[] = [
      {
        evidenceID: "EVIDENCE-FAILED",
        workUnitID: String(workUnitID),
        artifactRevisions: [{ artifactFileID: missingFile, revisionID: revisionID("sha256:missing") }],
        claimNodeIDs: [],
        taskNodeIDs: [],
        name: "failed",
        semanticScope: "final",
        result: "failed",
      },
      {
        evidenceID: "EVIDENCE-INTERRUPTED",
        workUnitID: String(workUnitID),
        artifactRevisions: [],
        claimNodeIDs: [],
        taskNodeIDs: [],
        name: "interrupted",
        semanticScope: "final",
        result: "interrupted",
      },
    ]
    expect(Traceability.queryStaleEvidence({ evidence: records, currentRevisions: new Map() })).toEqual([
      {
        evidenceID: "EVIDENCE-FAILED",
        reasons: ["artifact_revision_missing", "failed"],
      },
      { evidenceID: "EVIDENCE-INTERRUPTED", reasons: ["interrupted"] },
    ])
  })

  test("keeps artifact traceability independent from runtime execution", () => {
    expect(Object.keys(Traceability)).not.toEqual(
      expect.arrayContaining(["dispatch", "runGate", "publishChat", "renderControlPlane"]),
    )
  })
})
