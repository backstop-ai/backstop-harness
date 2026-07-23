import { describe, expect, test } from "bun:test"
import { BackstopEvent } from "@opencode-ai/schema"
import { BackstopArtifactRepository } from "@opencode-ai/core/backstop/artifact/repository"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { Location } from "@opencode-ai/core/location"
import { ProjectV2 } from "@opencode-ai/core/project"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Effect, Layer, Schema } from "effect"
import { BackstopArtifactImporter, parseArtifactContent } from "../../../src/backstop/artifact/importer"
import { testEffect } from "../../lib/effect"

let captured: BackstopArtifactRepository.ImportInput | undefined
const capturedInput = () => captured
const repositoryLayer = Layer.succeed(
  BackstopArtifactRepository.Service,
  BackstopArtifactRepository.Service.of({
    importRevision: (input) => {
      captured = input
      return Effect.succeed(
        Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionImported)({
          id: "evt_importer-test",
          type: "backstop.artifact.revision.imported",
          durable: { aggregateID: `${input.projectID}:${input.workUnitID}`, seq: 0, version: 1 },
          data: {
            aggregateID: `${input.projectID}:${input.workUnitID}`,
            projectID: input.projectID,
            workUnitID: input.workUnitID,
            artifactFileID: input.artifactFileID,
            expectedAggregateVersion: input.expectedAggregateVersion,
            artifactPath: input.artifactPath,
            artifactKind: input.artifactKind,
            authoredID: input.authoredID,
            schemaVersion: input.schemaVersion,
            revisionID: input.revisionID,
            normalizedContentBase64: Buffer.from(input.normalizedContent).toString("base64"),
            normalizedByteLength: input.normalizedContent.byteLength,
            importedAt: input.importedAt,
            projection: input.document,
            diagnostics: [],
          },
        }),
      )
    },
    acceptCandidate: () => Effect.die("not used"),
    rejectCandidate: () => Effect.die("not used"),
    getRevision: () => Effect.succeed(undefined),
    graph: () => Effect.succeed({ revisions: [], nodes: [], edges: [], resolutions: [] }),
    completeness: () => Effect.succeed([]),
    staleEvidence: () => Effect.succeed([]),
  }),
)
const spec = `---
title: Artifact revisions
number: SPEC-002
created: "2026-07-22"
status: ready-for-implementation
schema_version: spec/v1
spec_version: 1.0.0
requirements: []
claims: []
---

# SPEC-002
`
const it = testEffect(
  AppNodeBuilder.build(BackstopArtifactImporter.node, [
    [
      FileSystem.node,
      Layer.succeed(
        FileSystem.Service,
        FileSystem.Service.of({
          read: () =>
            Effect.succeed({ content: new TextEncoder().encode(spec.replaceAll("\n", "\r\n")), mime: "text/markdown" }),
          list: () => Effect.succeed([]),
          find: () => Effect.succeed([]),
          glob: () => Effect.succeed([]),
          grep: () => Effect.succeed([]),
        }),
      ),
    ],
    [
      Location.node,
      Layer.succeed(
        Location.Service,
        Location.Service.of({
          directory: AbsolutePath.make("/tmp/backstop-importer"),
          project: { id: ProjectV2.ID.make("project-1"), directory: AbsolutePath.make("/tmp/backstop-importer") },
        }),
      ),
    ],
    [BackstopArtifactRepository.node, repositoryLayer],
  ]),
)

describe("Backstop authored artifact importer", () => {
  test("imports an explicit authored artifact path with location and work-unit isolation", () => {
    expect(
      parseArtifactContent({
        artifactPath: "specs/SPEC-002-artifact-revision.spec.md",
        content: spec,
      }),
    ).toMatchObject({ artifactKind: "spec", authoredID: "SPEC-002", schemaVersion: "spec/v1" })
  })

  test("parses pure YAML plans and fails closed on unsupported paths", () => {
    expect(
      parseArtifactContent({
        artifactPath: "plans/PLAN-SPEC-002.plan.yml",
        content: "plan_id: PLAN-SPEC-002\nspec_id: SPEC-002\nphases: []\n",
      }),
    ).toMatchObject({ artifactKind: "plan", authoredID: "PLAN-SPEC-002", schemaVersion: "plan/v1" })
    expect(parseArtifactContent({ artifactPath: "README.md", content: "# no" })).toBeUndefined()
    expect(
      parseArtifactContent({ artifactPath: "specs/broken.spec.md", content: "---\nnumber: SPEC-002\n---\n" }),
    ).toBeUndefined()
  })

  test("projects explicit bundle directive and issue identities", () => {
    expect(
      parseArtifactContent({
        artifactPath: "bundles/BUNDLE-001-ambient.bundle.md",
        content: "---\nnumber: BUNDLE-001\nschema_version: bundle/v2\nbundle:\n  name: ambient\n---\n",
      }),
    ).toMatchObject({ artifactKind: "bundle", authoredID: "BUNDLE-001", schemaVersion: "bundle/v2" })
    expect(
      parseArtifactContent({
        artifactPath: "directives/DIR-001-ambient.directive.md",
        content: "---\nnumber: DIR-001\nschema_version: directive/v1\ndirective:\n  source: [BUNDLE-001]\n---\n",
      }),
    ).toMatchObject({ artifactKind: "directive", authoredID: "DIR-001", schemaVersion: "directive/v1" })
    expect(
      parseArtifactContent({
        artifactPath: "issues/ISSUE-001-defect.issue.md",
        content: "---\nschema_version: issue/v1\nissue:\n  id: ISSUE-001\n  status: open\n---\n",
      }),
    ).toMatchObject({ artifactKind: "issue", authoredID: "ISSUE-001", schemaVersion: "issue/v1" })
  })

  test("rejects missing frontmatter schema and authored identity", () => {
    expect(parseArtifactContent({ artifactPath: "specs/no-frontmatter.spec.md", content: "# Missing" })).toBeUndefined()
    expect(
      parseArtifactContent({
        artifactPath: "specs/no-schema.spec.md",
        content: "---\nnumber: SPEC-002\n---\n",
      }),
    ).toBeUndefined()
    expect(
      parseArtifactContent({
        artifactPath: "issues/no-id.issue.md",
        content: "---\nschema_version: issue/v1\nissue:\n  status: open\n---\n",
      }),
    ).toBeUndefined()
  })

  it.effect("imports normalized bytes through the location-scoped repository boundary", () =>
    Effect.gen(function* () {
      captured = undefined
      const importer = yield* BackstopArtifactImporter.Service
      const event = yield* importer.importArtifact({
        workUnitID: Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001"),
        artifactFileID: Schema.decodeUnknownSync(BackstopEvent.ArtifactFileID)("FILE-SPEC-002"),
        artifactPath: "specs/SPEC-002-artifact-revision.spec.md",
        expectedAggregateVersion: 0,
        importedAt: "2026-07-22T00:00:00.000Z",
      })
      expect(event.data.projectID).toBe("project-1")
      expect(new TextDecoder().decode(capturedInput()?.normalizedContent)).toBe(spec)
      expect(capturedInput()).toMatchObject({
        artifactKind: "spec",
        authoredID: "SPEC-002",
        schemaVersion: "spec/v1",
      })
    }),
  )
})
