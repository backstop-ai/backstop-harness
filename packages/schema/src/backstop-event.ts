export * as BackstopEvent from "./backstop-event"

import { Schema } from "effect"
import { Event } from "./event"
import { NonNegativeInt } from "./schema"

const id = <const Name extends string>(name: Name) => Schema.String.pipe(Schema.brand(name))

export const WorkUnitID = id("Backstop.WorkUnitID")
export type WorkUnitID = typeof WorkUnitID.Type
export const ArtifactFileID = id("Backstop.ArtifactFileID")
export type ArtifactFileID = typeof ArtifactFileID.Type
export const ArtifactRevisionID = id("Backstop.ArtifactRevisionID")
export type ArtifactRevisionID = typeof ArtifactRevisionID.Type

export const ArtifactKind = Schema.Literals(["bundle", "spec", "plan", "directive", "issue"])
export type ArtifactKind = typeof ArtifactKind.Type

const durable = {
  durable: {
    aggregate: "aggregateID",
    version: 1,
  },
} as const

const ownership = {
  aggregateID: Schema.String,
  projectID: Schema.String,
  workUnitID: WorkUnitID,
  artifactFileID: ArtifactFileID,
}

export const ArtifactRevisionImported = Event.define({
  type: "backstop.artifact.revision.imported",
  ...durable,
  schema: {
    ...ownership,
    expectedAggregateVersion: NonNegativeInt,
    artifactPath: Schema.String,
    artifactKind: ArtifactKind,
    authoredID: Schema.String,
    schemaVersion: Schema.String,
    revisionID: ArtifactRevisionID,
    normalizedContentBase64: Schema.String,
    normalizedByteLength: NonNegativeInt,
    importedAt: Schema.String,
    projection: Schema.Record(Schema.String, Schema.Unknown),
    diagnostics: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  },
})
export type ArtifactRevisionImported = typeof ArtifactRevisionImported.Type

export const ArtifactCandidateAccepted = Event.define({
  type: "backstop.artifact.candidate.accepted",
  ...durable,
  schema: {
    ...ownership,
    expectedAggregateVersion: NonNegativeInt,
    revisionID: ArtifactRevisionID,
    decidedAt: Schema.String,
  },
})
export type ArtifactCandidateAccepted = typeof ArtifactCandidateAccepted.Type

export const ArtifactCandidateRejected = Event.define({
  type: "backstop.artifact.candidate.rejected",
  ...durable,
  schema: {
    ...ownership,
    expectedAggregateVersion: NonNegativeInt,
    revisionID: ArtifactRevisionID,
    reason: Schema.String,
    decidedAt: Schema.String,
  },
})
export type ArtifactCandidateRejected = typeof ArtifactCandidateRejected.Type

export const DurableDefinitions = Event.inventory(
  ArtifactRevisionImported,
  ArtifactCandidateAccepted,
  ArtifactCandidateRejected,
)

export const Durable = Schema.Union(DurableDefinitions, { mode: "oneOf" })
  .pipe(Schema.toTaggedUnion("type"))
  .annotate({ identifier: "BackstopDurableEvent" })
export type DurableEvent = typeof Durable.Type
