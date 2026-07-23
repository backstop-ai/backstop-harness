import { describe, expect } from "bun:test"
import { BackstopEvent } from "@opencode-ai/schema"
import { Effect, Schema } from "effect"
import { BackstopArtifactRepository } from "../../src/backstop/artifact/repository"
import { Database } from "../../src/database/database"
import { AppNodeBuilder } from "../../src/effect/app-node-builder"
import { LayerNode } from "../../src/effect/layer-node"
import { EventV2 } from "../../src/event"
import { ArtifactRevisionTable } from "../../src/backstop/artifact/sql"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, BackstopArtifactRepository.node])),
)

const workUnitID = Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001")
const fileID = Schema.decodeUnknownSync(BackstopEvent.ArtifactFileID)("FILE-SPEC-002")
const revisionID = (value: string) => Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionID)(value)

function importInput(input: {
  projectID?: string
  artifactFileID?: BackstopEvent.ArtifactFileID
  expectedAggregateVersion: number
  revisionID: BackstopEvent.ArtifactRevisionID
  content: string
}) {
  return {
    projectID: input.projectID ?? "project-1",
    workUnitID,
    artifactFileID: input.artifactFileID ?? fileID,
    expectedAggregateVersion: input.expectedAggregateVersion,
    artifactPath: "specs/SPEC-002.spec.md",
    artifactKind: "spec" as const,
    authoredID: "SPEC-002",
    schemaVersion: "spec/v1",
    revisionID: input.revisionID,
    normalizedContent: new TextEncoder().encode(input.content),
    importedAt: "2026-07-22T00:00:00.000Z",
    document: {
      requirements: [{ id: "REQ-001", text: "snapshot", supports: [] }],
      claims: [
        {
          id: "CLM-001",
          requirement: "REQ-001",
          text: "stored",
          tests: ["persists snapshots"],
        },
      ],
    },
  }
}

describe("Backstop artifact repository", () => {
  it.effect("persists and recovers complete normalized artifact snapshots", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const id = revisionID("sha256:first")
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 0, revisionID: id, content: "title: Test\n" }),
      )
      const stored = yield* repository.getRevision({ artifactFileID: fileID, revisionID: id })
      expect(stored).toBeDefined()
      expect(Buffer.from(stored?.normalizedContentBase64 ?? "", "base64").toString()).toBe("title: Test\n")
      expect(stored).toMatchObject({
        revisionID: id,
        normalizedByteLength: 12,
        canonicalValidation: "unknown",
      })
    }),
  )

  it.effect("keeps changed artifact revisions candidate and evidence-free", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const first = revisionID("sha256:first")
      const second = revisionID("sha256:second")
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 0, revisionID: first, content: "before\n" }),
      )
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 1, revisionID: second, content: "after\n" }),
      )

      expect((yield* repository.graph({ projectID: "project-1", workUnitID })).revisions).toEqual([
        expect.objectContaining({ revisionID: first }),
      ])
      yield* repository.acceptCandidate({
        projectID: "project-1",
        workUnitID,
        artifactFileID: fileID,
        revisionID: second,
        expectedAggregateVersion: 2,
        decidedAt: "2026-07-22T00:01:00.000Z",
      })
      expect((yield* repository.graph({ projectID: "project-1", workUnitID })).revisions).toEqual([
        expect.objectContaining({ revisionID: second }),
      ])
    }),
  )

  it.effect("reimports identical revisions idempotently", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const { db } = yield* Database.Service
      const id = revisionID("sha256:first")
      yield* repository.importRevision(importInput({ expectedAggregateVersion: 0, revisionID: id, content: "same\n" }))
      yield* repository.importRevision(importInput({ expectedAggregateVersion: 1, revisionID: id, content: "same\n" }))
      expect(
        (yield* db.select().from(ArtifactRevisionTable).all().pipe(Effect.orDie)).filter(
          (row) => row.artifact_file_id === fileID && row.revision_id === id,
        ),
      ).toHaveLength(1)
    }),
  )

  it.effect("rejects candidates without changing the accepted revision", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const first = revisionID("sha256:first")
      const second = revisionID("sha256:second")
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 0, revisionID: first, content: "before\n" }),
      )
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 1, revisionID: second, content: "after\n" }),
      )
      yield* repository.rejectCandidate({
        projectID: "project-1",
        workUnitID,
        artifactFileID: fileID,
        revisionID: second,
        expectedAggregateVersion: 2,
        reason: "external edit is not accepted",
        decidedAt: "2026-07-22T00:01:00.000Z",
      })
      expect((yield* repository.graph({ projectID: "project-1", workUnitID })).revisions).toEqual([
        expect.objectContaining({ revisionID: first }),
      ])
      expect(
        yield* repository
          .acceptCandidate({
            projectID: "project-1",
            workUnitID,
            artifactFileID: fileID,
            revisionID: second,
            expectedAggregateVersion: 3,
            decidedAt: "2026-07-22T00:02:00.000Z",
          })
          .pipe(Effect.exit),
      ).toMatchObject({ _tag: "Failure" })
    }),
  )

  it.effect("commits artifact import event and graph projection atomically", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const first = revisionID("sha256:first")
      yield* repository.importRevision(
        importInput({ expectedAggregateVersion: 0, revisionID: first, content: "before\n" }),
      )
      const exit = yield* repository
        .importRevision(
          importInput({ expectedAggregateVersion: 0, revisionID: revisionID("sha256:loser"), content: "loser\n" }),
        )
        .pipe(Effect.exit)
      expect(exit._tag).toBe("Failure")
      expect(
        yield* repository.getRevision({ artifactFileID: fileID, revisionID: revisionID("sha256:loser") }),
      ).toBeUndefined()
    }),
  )

  it.effect("rejects concurrent imports at the same aggregate version", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      const results = yield* Effect.all(
        [revisionID("sha256:first"), revisionID("sha256:second")].map((id) =>
          repository
            .importRevision(importInput({ expectedAggregateVersion: 0, revisionID: id, content: String(id) }))
            .pipe(Effect.exit),
        ),
        { concurrency: "unbounded" },
      )
      expect(results.filter((result) => result._tag === "Success")).toHaveLength(1)
      expect(results.filter((result) => result._tag === "Failure")).toHaveLength(1)
    }),
  )

  it.effect("isolates artifact imports by project and work unit", () =>
    Effect.gen(function* () {
      const repository = yield* BackstopArtifactRepository.Service
      yield* repository.importRevision(
        importInput({
          projectID: "project-1",
          expectedAggregateVersion: 0,
          revisionID: revisionID("sha256:first"),
          content: "one",
        }),
      )
      yield* repository.importRevision(
        importInput({
          projectID: "project-2",
          artifactFileID: Schema.decodeUnknownSync(BackstopEvent.ArtifactFileID)("FILE-SPEC-002-PROJECT-2"),
          expectedAggregateVersion: 0,
          revisionID: revisionID("sha256:second"),
          content: "two",
        }),
      )
      expect((yield* repository.graph({ projectID: "project-1", workUnitID })).revisions).toHaveLength(1)
      expect((yield* repository.graph({ projectID: "project-2", workUnitID })).revisions).toHaveLength(1)
    }),
  )
})
