export * as BackstopControl from "./backstop-control"

import { Schema } from "effect"
import { ascending } from "./identifier"
import { optional, statics } from "./schema"
import { BackstopEvent } from "./backstop-event"
import { Event } from "./event"

export const CommandID = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/)).pipe(
  Schema.brand("Backstop.CommandID"),
)
export type CommandID = typeof CommandID.Type

export const CommandActor = Schema.Literals([
  "human",
  "primary",
  "orchestrator",
  "writer",
  "reviewer",
  "implementer",
  "verifier",
  "system",
])
export type CommandActor = typeof CommandActor.Type

export const ConfirmationRisk = Schema.Literals(["none", "reversible", "commitment", "terminal"])
export type ConfirmationRisk = typeof ConfirmationRisk.Type

export const CommandMetadata = Schema.Struct({
  id: CommandID,
  actors: Schema.Array(CommandActor),
  permission: Schema.String,
  commandFamily: Schema.String,
  idempotency: Schema.Literals(["none", "required", "derived"]),
  confirmationRisk: ConfirmationRisk,
  description: Schema.String,
  requiresWorkUnit: Schema.Boolean,
  legalAction: Schema.String.pipe(optional),
}).annotate({ identifier: "Backstop.CommandMetadata" })
export type CommandMetadata = typeof CommandMetadata.Type

export const CommandContext = Schema.Struct({
  actor: CommandActor,
  projectID: Schema.String,
  sessionID: Schema.String.pipe(optional),
  workUnitID: BackstopEvent.WorkUnitID.pipe(optional),
  idempotencyKey: Schema.String.pipe(optional),
}).annotate({ identifier: "Backstop.CommandContext" })
export type CommandContext = typeof CommandContext.Type

export const CommandResult = Schema.TaggedUnion({
  Accepted: { commandID: CommandID, value: Schema.Unknown },
  Rejected: { commandID: CommandID, reason: Schema.String },
  ClarificationRequired: { commandID: CommandID, question: Schema.String },
})
export type CommandResult = typeof CommandResult.Type

export const GrantID = Schema.String.check(Schema.isStartsWith("grant_")).pipe(
  Schema.brand("Backstop.GrantID"),
  statics((schema) => ({ create: () => schema.make(`grant_${ascending()}`) })),
)
export type GrantID = typeof GrantID.Type

export const GrantScope = Schema.Literals(["once", "work_unit", "project_command_family"])
export type GrantScope = typeof GrantScope.Type

export const AutonomyGrant = Schema.Struct({
  id: GrantID,
  projectID: Schema.String,
  commandFamily: Schema.String,
  scope: GrantScope,
  workUnitID: BackstopEvent.WorkUnitID.pipe(optional),
  grantor: CommandActor,
  timeCreated: Schema.String,
  timeConsumed: Schema.String.pipe(optional),
  timeRevoked: Schema.String.pipe(optional),
}).annotate({ identifier: "Backstop.AutonomyGrant" })
export type AutonomyGrant = typeof AutonomyGrant.Type

const durable = {
  durable: {
    aggregate: "projectID",
    version: 1,
  },
} as const

export const AutonomyGrantCreated = Event.define({
  type: "backstop.autonomy.grant.created",
  ...durable,
  schema: {
    grant: AutonomyGrant,
    projectID: Schema.String,
  },
})

export const AutonomyGrantConsumed = Event.define({
  type: "backstop.autonomy.grant.consumed",
  ...durable,
  schema: {
    grantID: GrantID,
    projectID: Schema.String,
    timeConsumed: Schema.String,
  },
})

export const AutonomyGrantRevoked = Event.define({
  type: "backstop.autonomy.grant.revoked",
  ...durable,
  schema: {
    grantID: GrantID,
    projectID: Schema.String,
    timeRevoked: Schema.String,
  },
})

export const DurableDefinitions = Event.inventory(AutonomyGrantCreated, AutonomyGrantConsumed, AutonomyGrantRevoked)
