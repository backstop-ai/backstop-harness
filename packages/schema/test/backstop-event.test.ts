import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { BackstopEvent } from "../src/backstop-event"
import { DurableEventManifest } from "../src/durable-event-manifest"

describe("Backstop durable artifact events", () => {
  test("registers versioned Backstop artifact events as durable work-unit aggregates", () => {
    expect(BackstopEvent.DurableDefinitions.map((definition) => definition.type)).toEqual([
      "backstop.artifact.revision.imported",
      "backstop.artifact.candidate.accepted",
      "backstop.artifact.candidate.rejected",
    ])

    for (const definition of BackstopEvent.DurableDefinitions) {
      expect(definition.durable).toEqual({ aggregate: "aggregateID", version: 1 })
      expect(DurableEventManifest.Durable.get(`${definition.type}.1`)).toBe(definition)
    }
  })

  test("requires complete projector input on imported revisions", () => {
    const event = {
      id: "evt_backstop-import",
      type: "backstop.artifact.revision.imported",
      durable: { aggregateID: "BUNDLE-001", seq: 1, version: 1 },
      data: {
        aggregateID: "project-1:BUNDLE-001",
        projectID: "project-1",
        workUnitID: "BUNDLE-001",
        artifactFileID: "FILE-001",
        expectedAggregateVersion: 0,
        artifactPath: "specs/SPEC-001.spec.md",
        artifactKind: "spec",
        authoredID: "SPEC-001",
        schemaVersion: "spec/v1",
        revisionID: "sha256:abc",
        normalizedContentBase64: "dGl0bGU6IFRlc3QK",
        normalizedByteLength: 12,
        importedAt: "2026-07-22T00:00:00.000Z",
        projection: { requirements: [] },
        diagnostics: [],
      },
    }

    expect(Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionImported)(event)).toMatchObject({
      data: { workUnitID: "BUNDLE-001", revisionID: "sha256:abc" },
    })
    expect(() =>
      Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionImported)({
        ...event,
        data: { ...event.data, normalizedContentBase64: undefined },
      }),
    ).toThrow()
  })
})
