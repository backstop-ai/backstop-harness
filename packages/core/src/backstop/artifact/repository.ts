export * as BackstopArtifactRepository from "./repository"

import { BackstopEvent } from "@opencode-ai/schema"
import { NonNegativeInt } from "@opencode-ai/schema/schema"
import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../../database/database"
import { makeGlobalNode } from "../../effect/app-node"
import { EventV2 } from "../../event"
import { buildTraceabilityGraph, queryCompleteness, queryStaleEvidence, type EvidenceRecord } from "./traceability"
import { projectArtifact, type ArtifactProjection, type ArtifactRevision, type ImportDiagnostic } from "./model"
import { ArtifactFileTable, ArtifactRevisionTable, ImportDiagnosticTable, TraceEdgeTable, TraceNodeTable } from "./sql"

export class AggregateVersionConflict extends Schema.TaggedErrorClass<AggregateVersionConflict>()(
  "BackstopArtifactRepository.AggregateVersionConflict",
  {
    aggregateID: Schema.String,
    expectedAggregateVersion: NonNegativeInt,
    actualAggregateVersion: NonNegativeInt,
  },
) {}

export class ArtifactRevisionNotFound extends Schema.TaggedErrorClass<ArtifactRevisionNotFound>()(
  "BackstopArtifactRepository.ArtifactRevisionNotFound",
  {
    artifactFileID: BackstopEvent.ArtifactFileID,
    revisionID: BackstopEvent.ArtifactRevisionID,
  },
) {}

export interface ImportInput {
  readonly projectID: string
  readonly workUnitID: BackstopEvent.WorkUnitID
  readonly artifactFileID: BackstopEvent.ArtifactFileID
  readonly expectedAggregateVersion: number
  readonly artifactPath: string
  readonly artifactKind: BackstopEvent.ArtifactKind
  readonly authoredID: string
  readonly schemaVersion: string
  readonly revisionID: BackstopEvent.ArtifactRevisionID
  readonly normalizedContent: Uint8Array
  readonly importedAt: string
  readonly document: Record<string, unknown>
}

export interface CandidateInput {
  readonly projectID: string
  readonly workUnitID: BackstopEvent.WorkUnitID
  readonly artifactFileID: BackstopEvent.ArtifactFileID
  readonly revisionID: BackstopEvent.ArtifactRevisionID
  readonly expectedAggregateVersion: number
  readonly decidedAt: string
}

export interface Interface {
  readonly importRevision: (
    input: ImportInput,
  ) => Effect.Effect<BackstopEvent.ArtifactRevisionImported, AggregateVersionConflict>
  readonly acceptCandidate: (
    input: CandidateInput,
  ) => Effect.Effect<BackstopEvent.ArtifactCandidateAccepted, AggregateVersionConflict | ArtifactRevisionNotFound>
  readonly rejectCandidate: (
    input: CandidateInput & { readonly reason: string },
  ) => Effect.Effect<BackstopEvent.ArtifactCandidateRejected, AggregateVersionConflict | ArtifactRevisionNotFound>
  readonly getRevision: (input: {
    artifactFileID: BackstopEvent.ArtifactFileID
    revisionID: BackstopEvent.ArtifactRevisionID
  }) => Effect.Effect<ArtifactRevision | undefined>
  readonly graph: (input: {
    projectID: string
    workUnitID: BackstopEvent.WorkUnitID
  }) => Effect.Effect<ReturnType<typeof buildTraceabilityGraph>>
  readonly completeness: (input: {
    projectID: string
    workUnitID: BackstopEvent.WorkUnitID
    evidence: readonly EvidenceRecord[]
  }) => Effect.Effect<ReturnType<typeof queryCompleteness>>
  readonly staleEvidence: (input: {
    projectID: string
    workUnitID: BackstopEvent.WorkUnitID
    evidence: readonly EvidenceRecord[]
    currentRepositoryRevision?: string
  }) => Effect.Effect<ReturnType<typeof queryStaleEvidence>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopArtifactRepository") {}

const emptyProjection: ArtifactProjection = {
  requirements: [],
  claims: [],
  tasks: [],
  sources: [],
  repairObligations: [],
}

function aggregateID(projectID: string, workUnitID: BackstopEvent.WorkUnitID) {
  return `${projectID}:${workUnitID}`
}

function conflictBoundary<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E | AggregateVersionConflict> {
  return effect.pipe(
    Effect.catchDefect((defect) =>
      defect instanceof AggregateVersionConflict ? Effect.fail(defect) : Effect.die(defect),
    ),
  )
}

function expectedVersion(input: { aggregateID: string; expectedAggregateVersion: number }) {
  return (seq: number) =>
    seq === input.expectedAggregateVersion
      ? Effect.void
      : Effect.die(
          new AggregateVersionConflict({
            aggregateID: input.aggregateID,
            expectedAggregateVersion: input.expectedAggregateVersion,
            actualAggregateVersion: seq,
          }),
        )
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service

    const currentRevisions = Effect.fn("BackstopArtifactRepository.currentRevisions")(function* (input: {
      projectID: string
      workUnitID: BackstopEvent.WorkUnitID
    }) {
      const rows = yield* db
        .select({ file: ArtifactFileTable, revision: ArtifactRevisionTable })
        .from(ArtifactFileTable)
        .innerJoin(
          ArtifactRevisionTable,
          and(
            eq(ArtifactRevisionTable.artifact_file_id, ArtifactFileTable.id),
            eq(ArtifactRevisionTable.revision_id, ArtifactFileTable.current_revision_id),
          ),
        )
        .where(
          and(
            eq(ArtifactFileTable.project_id, input.projectID),
            eq(ArtifactFileTable.work_unit_id, input.workUnitID),
            eq(ArtifactRevisionTable.projection_status, "parsed"),
          ),
        )
        .all()
        .pipe(Effect.orDie)
      return rows.map(
        (row): ArtifactRevision => ({
          projectID: row.file.project_id,
          workUnitID: row.file.work_unit_id,
          artifactFileID: row.file.id,
          artifactPath: row.file.artifact_path,
          artifactKind: row.file.artifact_kind,
          authoredID: row.file.authored_id,
          schemaVersion: row.revision.schema_version,
          revisionID: row.revision.revision_id,
          normalizedContentBase64: row.revision.normalized_content_base64,
          normalizedByteLength: row.revision.normalized_byte_length,
          importedAt: row.revision.imported_at,
          canonicalValidation: row.revision.canonical_validation,
          projection: row.revision.projection,
        }),
      )
    })

    const projectGraph = Effect.fn("BackstopArtifactRepository.projectGraph")(function* (input: {
      projectID: string
      workUnitID: BackstopEvent.WorkUnitID
    }) {
      const graph = buildTraceabilityGraph(yield* currentRevisions(input))
      yield* db
        .delete(TraceEdgeTable)
        .where(and(eq(TraceEdgeTable.project_id, input.projectID), eq(TraceEdgeTable.work_unit_id, input.workUnitID)))
        .run()
        .pipe(Effect.orDie)
      yield* db
        .delete(TraceNodeTable)
        .where(and(eq(TraceNodeTable.project_id, input.projectID), eq(TraceNodeTable.work_unit_id, input.workUnitID)))
        .run()
        .pipe(Effect.orDie)
      if (graph.nodes.length > 0) {
        yield* db
          .insert(TraceNodeTable)
          .values(
            graph.nodes.map((node) => ({
              id: node.id,
              project_id: node.projectID,
              work_unit_id: Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)(node.workUnitID),
              artifact_file_id: node.artifactFileID,
              revision_id: node.revisionID,
              node_type: node.type,
              local_id: node.localID,
            })),
          )
          .run()
          .pipe(Effect.orDie)
      }
      if (graph.edges.length > 0) {
        yield* db
          .insert(TraceEdgeTable)
          .values(
            graph.edges.map((item) => ({
              id: item.id,
              project_id: input.projectID,
              work_unit_id: input.workUnitID,
              edge_type: item.type,
              from_node_id: item.from,
              to_node_id: item.to,
              source_revision_id: item.sourceRevisionID,
              source_path: item.sourcePath,
              source_location: item.sourceLocation,
            })),
          )
          .run()
          .pipe(Effect.orDie)
      }
    })

    yield* events.project(BackstopEvent.ArtifactRevisionImported, (event) =>
      Effect.gen(function* () {
        const projected = projectArtifact({
          artifactKind: event.data.artifactKind,
          schemaVersion: event.data.schemaVersion,
          document: event.data.projection,
        })
        const projection = projected.status === "parsed" ? projected.projection : emptyProjection
        const diagnostics: readonly ImportDiagnostic[] = projected.status === "parsed" ? [] : projected.diagnostics
        const now = Date.parse(event.data.importedAt)
        const existing = yield* db
          .select({ currentRevisionID: ArtifactFileTable.current_revision_id })
          .from(ArtifactFileTable)
          .where(eq(ArtifactFileTable.id, event.data.artifactFileID))
          .get()
          .pipe(Effect.orDie)
        yield* db
          .insert(ArtifactFileTable)
          .values({
            id: event.data.artifactFileID,
            project_id: event.data.projectID,
            work_unit_id: event.data.workUnitID,
            artifact_path: event.data.artifactPath,
            artifact_kind: event.data.artifactKind,
            authored_id: event.data.authoredID,
            current_revision_id: existing?.currentRevisionID ?? event.data.revisionID,
            candidate_revision_id:
              existing?.currentRevisionID && existing.currentRevisionID !== event.data.revisionID
                ? event.data.revisionID
                : null,
            time_created: now,
            time_updated: now,
          })
          .onConflictDoUpdate({
            target: ArtifactFileTable.id,
            set: {
              project_id: event.data.projectID,
              work_unit_id: event.data.workUnitID,
              artifact_path: event.data.artifactPath,
              artifact_kind: event.data.artifactKind,
              authored_id: event.data.authoredID,
              candidate_revision_id:
                existing?.currentRevisionID && existing.currentRevisionID !== event.data.revisionID
                  ? event.data.revisionID
                  : null,
              time_updated: now,
            },
          })
          .run()
          .pipe(Effect.orDie)
        yield* db
          .insert(ArtifactRevisionTable)
          .values({
            artifact_file_id: event.data.artifactFileID,
            revision_id: event.data.revisionID,
            schema_version: event.data.schemaVersion,
            normalized_content_base64: event.data.normalizedContentBase64,
            normalized_byte_length: event.data.normalizedByteLength,
            projection,
            diagnostics,
            projection_status: projected.status,
            canonical_validation: "unknown",
            imported_at: event.data.importedAt,
            time_created: now,
          })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)
        if (diagnostics.length > 0) {
          yield* db
            .insert(ImportDiagnosticTable)
            .values(
              diagnostics.map((diagnostic, position) => ({
                artifact_file_id: event.data.artifactFileID,
                revision_id: event.data.revisionID,
                position,
                code: diagnostic.code,
                location: diagnostic.location,
                message: diagnostic.message,
              })),
            )
            .onConflictDoNothing()
            .run()
            .pipe(Effect.orDie)
        }
        yield* projectGraph({ projectID: event.data.projectID, workUnitID: event.data.workUnitID })
      }),
    )

    yield* events.project(BackstopEvent.ArtifactCandidateAccepted, (event) =>
      db
        .update(ArtifactFileTable)
        .set({
          current_revision_id: event.data.revisionID,
          candidate_revision_id: null,
          time_updated: Date.parse(event.data.decidedAt),
        })
        .where(
          and(
            eq(ArtifactFileTable.id, event.data.artifactFileID),
            eq(ArtifactFileTable.project_id, event.data.projectID),
            eq(ArtifactFileTable.work_unit_id, event.data.workUnitID),
            eq(ArtifactFileTable.candidate_revision_id, event.data.revisionID),
          ),
        )
        .run()
        .pipe(
          Effect.orDie,
          Effect.andThen(projectGraph({ projectID: event.data.projectID, workUnitID: event.data.workUnitID })),
        ),
    )

    yield* events.project(BackstopEvent.ArtifactCandidateRejected, (event) =>
      db
        .update(ArtifactFileTable)
        .set({ candidate_revision_id: null, time_updated: Date.parse(event.data.decidedAt) })
        .where(
          and(
            eq(ArtifactFileTable.id, event.data.artifactFileID),
            eq(ArtifactFileTable.project_id, event.data.projectID),
            eq(ArtifactFileTable.work_unit_id, event.data.workUnitID),
            eq(ArtifactFileTable.candidate_revision_id, event.data.revisionID),
          ),
        )
        .run()
        .pipe(Effect.orDie),
    )

    const importRevision = Effect.fn("BackstopArtifactRepository.importRevision")(function* (input: ImportInput) {
      const id = aggregateID(input.projectID, input.workUnitID)
      return yield* events
        .publish(
          BackstopEvent.ArtifactRevisionImported,
          {
            aggregateID: id,
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
          { commit: expectedVersion({ aggregateID: id, expectedAggregateVersion: input.expectedAggregateVersion }) },
        )
        .pipe(conflictBoundary)
    })

    const candidateExists = Effect.fn("BackstopArtifactRepository.candidateExists")(function* (input: CandidateInput) {
      const row = yield* db
        .select({ revisionID: ArtifactFileTable.candidate_revision_id })
        .from(ArtifactFileTable)
        .where(
          and(
            eq(ArtifactFileTable.id, input.artifactFileID),
            eq(ArtifactFileTable.project_id, input.projectID),
            eq(ArtifactFileTable.work_unit_id, input.workUnitID),
          ),
        )
        .get()
        .pipe(Effect.orDie)
      if (row?.revisionID !== input.revisionID) {
        yield* new ArtifactRevisionNotFound({
          artifactFileID: input.artifactFileID,
          revisionID: input.revisionID,
        })
      }
    })

    const acceptCandidate = Effect.fn("BackstopArtifactRepository.acceptCandidate")(function* (input: CandidateInput) {
      yield* candidateExists(input)
      const id = aggregateID(input.projectID, input.workUnitID)
      return yield* events
        .publish(
          BackstopEvent.ArtifactCandidateAccepted,
          { aggregateID: id, ...input },
          { commit: expectedVersion({ aggregateID: id, expectedAggregateVersion: input.expectedAggregateVersion }) },
        )
        .pipe(conflictBoundary)
    })

    const rejectCandidate = Effect.fn("BackstopArtifactRepository.rejectCandidate")(function* (
      input: CandidateInput & { readonly reason: string },
    ) {
      yield* candidateExists(input)
      const id = aggregateID(input.projectID, input.workUnitID)
      return yield* events
        .publish(
          BackstopEvent.ArtifactCandidateRejected,
          { aggregateID: id, ...input },
          { commit: expectedVersion({ aggregateID: id, expectedAggregateVersion: input.expectedAggregateVersion }) },
        )
        .pipe(conflictBoundary)
    })

    const getRevision = Effect.fn("BackstopArtifactRepository.getRevision")(function* (input: {
      artifactFileID: BackstopEvent.ArtifactFileID
      revisionID: BackstopEvent.ArtifactRevisionID
    }) {
      const row = yield* db
        .select({ file: ArtifactFileTable, revision: ArtifactRevisionTable })
        .from(ArtifactRevisionTable)
        .innerJoin(ArtifactFileTable, eq(ArtifactFileTable.id, ArtifactRevisionTable.artifact_file_id))
        .where(
          and(
            eq(ArtifactRevisionTable.artifact_file_id, input.artifactFileID),
            eq(ArtifactRevisionTable.revision_id, input.revisionID),
          ),
        )
        .get()
        .pipe(Effect.orDie)
      if (!row) return undefined
      return {
        projectID: row.file.project_id,
        workUnitID: row.file.work_unit_id,
        artifactFileID: row.file.id,
        artifactPath: row.file.artifact_path,
        artifactKind: row.file.artifact_kind,
        authoredID: row.file.authored_id,
        schemaVersion: row.revision.schema_version,
        revisionID: row.revision.revision_id,
        normalizedContentBase64: row.revision.normalized_content_base64,
        normalizedByteLength: row.revision.normalized_byte_length,
        importedAt: row.revision.imported_at,
        canonicalValidation: row.revision.canonical_validation,
        projection: row.revision.projection,
      } satisfies ArtifactRevision
    })

    const graph = Effect.fn("BackstopArtifactRepository.graph")(function* (input: {
      projectID: string
      workUnitID: BackstopEvent.WorkUnitID
    }) {
      return buildTraceabilityGraph(yield* currentRevisions(input))
    })

    const completeness = Effect.fn("BackstopArtifactRepository.completeness")(function* (input: {
      projectID: string
      workUnitID: BackstopEvent.WorkUnitID
      evidence: readonly EvidenceRecord[]
    }) {
      return queryCompleteness({ graph: yield* graph(input), evidence: input.evidence })
    })

    const staleEvidence = Effect.fn("BackstopArtifactRepository.staleEvidence")(function* (input: {
      projectID: string
      workUnitID: BackstopEvent.WorkUnitID
      evidence: readonly EvidenceRecord[]
      currentRepositoryRevision?: string
    }) {
      return queryStaleEvidence({
        evidence: input.evidence,
        currentRevisions: new Map(
          (yield* currentRevisions(input)).map((revision) => [revision.artifactFileID, revision.revisionID]),
        ),
        ...(input.currentRepositoryRevision ? { currentRepositoryRevision: input.currentRepositoryRevision } : {}),
      })
    })

    return Service.of({
      importRevision,
      acceptCandidate,
      rejectCandidate,
      getRevision,
      graph,
      completeness,
      staleEvidence,
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, EventV2.node] })
