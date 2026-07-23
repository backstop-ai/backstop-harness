export * as BackstopAutonomyGrant from "./grant"

import { BackstopControl, BackstopEvent } from "@opencode-ai/schema"
import { and, eq, isNull } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../../database/database"
import { makeGlobalNode } from "../../effect/app-node"
import { EventV2 } from "../../event"
import { AutonomyGrantTable } from "./sql"

export class InvalidGrantScope extends Schema.TaggedErrorClass<InvalidGrantScope>()(
  "BackstopAutonomyGrant.InvalidGrantScope",
  { scope: BackstopControl.GrantScope, message: Schema.String },
) {}

export class GrantUnavailable extends Schema.TaggedErrorClass<GrantUnavailable>()(
  "BackstopAutonomyGrant.GrantUnavailable",
  { grantID: BackstopControl.GrantID },
) {}

export interface CreateInput {
  readonly projectID: string
  readonly commandFamily: string
  readonly scope: BackstopControl.GrantScope
  readonly workUnitID?: BackstopEvent.WorkUnitID
  readonly grantor: BackstopControl.CommandActor
  readonly timeCreated: string
}

export interface AuthorizationInput {
  readonly projectID: string
  readonly commandFamily: string
  readonly workUnitID?: BackstopEvent.WorkUnitID
  readonly time: string
  readonly actorAllowed: boolean
  readonly lifecycleAllowed: boolean
  readonly humanGateRequired: boolean
  readonly evidenceSatisfied: boolean
  readonly paused: boolean
}

export type Authorization =
  | { readonly _tag: "Granted"; readonly grant: BackstopControl.AutonomyGrant }
  | {
      readonly _tag: "ConfirmationRequired"
      readonly reason:
        | "actor_denied"
        | "illegal_transition"
        | "human_gate_required"
        | "evidence_required"
        | "paused"
        | "no_matching_grant"
    }

export interface Interface {
  readonly create: (input: CreateInput) => Effect.Effect<BackstopControl.AutonomyGrant, InvalidGrantScope>
  readonly list: (input: {
    projectID: string
    includeInactive?: boolean
  }) => Effect.Effect<readonly BackstopControl.AutonomyGrant[]>
  readonly authorize: (input: AuthorizationInput) => Effect.Effect<Authorization, GrantUnavailable>
  readonly revoke: (input: {
    projectID: string
    grantID: BackstopControl.GrantID
    timeRevoked: string
  }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopAutonomyGrant") {}

function fromRow(row: typeof AutonomyGrantTable.$inferSelect): BackstopControl.AutonomyGrant {
  return {
    id: row.id,
    projectID: row.project_id,
    commandFamily: row.command_family,
    scope: row.scope,
    ...(row.work_unit_id ? { workUnitID: row.work_unit_id } : {}),
    grantor: row.grantor,
    timeCreated: row.time_created,
    ...(row.time_consumed ? { timeConsumed: row.time_consumed } : {}),
    ...(row.time_revoked ? { timeRevoked: row.time_revoked } : {}),
  }
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service

    yield* events.project(BackstopControl.AutonomyGrantCreated, (event) =>
      db
        .insert(AutonomyGrantTable)
        .values({
          id: event.data.grant.id,
          project_id: event.data.grant.projectID,
          command_family: event.data.grant.commandFamily,
          scope: event.data.grant.scope,
          work_unit_id: event.data.grant.workUnitID,
          grantor: event.data.grant.grantor,
          time_created: event.data.grant.timeCreated,
          time_consumed: event.data.grant.timeConsumed,
          time_revoked: event.data.grant.timeRevoked,
        })
        .run()
        .pipe(Effect.orDie),
    )
    yield* events.project(BackstopControl.AutonomyGrantConsumed, (event) =>
      Effect.gen(function* () {
        const row = yield* db
          .update(AutonomyGrantTable)
          .set({ time_consumed: event.data.timeConsumed })
          .where(
            and(
              eq(AutonomyGrantTable.id, event.data.grantID),
              eq(AutonomyGrantTable.project_id, event.data.projectID),
              eq(AutonomyGrantTable.scope, "once"),
              isNull(AutonomyGrantTable.time_consumed),
              isNull(AutonomyGrantTable.time_revoked),
            ),
          )
          .returning({ id: AutonomyGrantTable.id })
          .get()
          .pipe(Effect.orDie)
        if (!row) yield* Effect.die(new GrantUnavailable({ grantID: event.data.grantID }))
      }),
    )
    yield* events.project(BackstopControl.AutonomyGrantRevoked, (event) =>
      db
        .update(AutonomyGrantTable)
        .set({ time_revoked: event.data.timeRevoked })
        .where(
          and(
            eq(AutonomyGrantTable.id, event.data.grantID),
            eq(AutonomyGrantTable.project_id, event.data.projectID),
            isNull(AutonomyGrantTable.time_revoked),
          ),
        )
        .run()
        .pipe(Effect.orDie),
    )

    const list = Effect.fn("BackstopAutonomyGrant.list")(function* (input: {
      projectID: string
      includeInactive?: boolean
    }) {
      const rows = yield* db
        .select()
        .from(AutonomyGrantTable)
        .where(eq(AutonomyGrantTable.project_id, input.projectID))
        .all()
        .pipe(Effect.orDie)
      return rows
        .filter((row) => input.includeInactive || (!row.time_revoked && (row.scope !== "once" || !row.time_consumed)))
        .map(fromRow)
        .sort((a, b) => a.id.localeCompare(b.id))
    })

    const create = Effect.fn("BackstopAutonomyGrant.create")(function* (input: CreateInput) {
      if (input.scope === "work_unit" && !input.workUnitID) {
        return yield* new InvalidGrantScope({ scope: input.scope, message: "work_unit grants require workUnitID" })
      }
      if (input.scope !== "work_unit" && input.workUnitID) {
        return yield* new InvalidGrantScope({ scope: input.scope, message: "only work_unit grants accept workUnitID" })
      }
      const grant = BackstopControl.AutonomyGrant.make({
        id: BackstopControl.GrantID.create(),
        projectID: input.projectID,
        commandFamily: input.commandFamily,
        scope: input.scope,
        ...(input.workUnitID ? { workUnitID: input.workUnitID } : {}),
        grantor: input.grantor,
        timeCreated: input.timeCreated,
      })
      yield* events.publish(BackstopControl.AutonomyGrantCreated, { grant, projectID: input.projectID })
      return grant
    })

    const authorize = Effect.fn("BackstopAutonomyGrant.authorize")(function* (input: AuthorizationInput) {
      if (!input.actorAllowed) return { _tag: "ConfirmationRequired", reason: "actor_denied" } as const
      if (!input.lifecycleAllowed) return { _tag: "ConfirmationRequired", reason: "illegal_transition" } as const
      if (input.humanGateRequired) return { _tag: "ConfirmationRequired", reason: "human_gate_required" } as const
      if (!input.evidenceSatisfied) return { _tag: "ConfirmationRequired", reason: "evidence_required" } as const
      if (input.paused) return { _tag: "ConfirmationRequired", reason: "paused" } as const
      const grant = (yield* list({ projectID: input.projectID })).find(
        (item) =>
          item.commandFamily === input.commandFamily &&
          (item.scope !== "work_unit" || item.workUnitID === input.workUnitID),
      )
      if (!grant) return { _tag: "ConfirmationRequired", reason: "no_matching_grant" } as const
      if (grant.scope === "once") {
        yield* events
          .publish(BackstopControl.AutonomyGrantConsumed, {
            grantID: grant.id,
            projectID: grant.projectID,
            timeConsumed: input.time,
          })
          .pipe(
            Effect.catchDefect((defect) =>
              defect instanceof GrantUnavailable ? Effect.fail(defect) : Effect.die(defect),
            ),
          )
      }
      return { _tag: "Granted", grant } as const
    })

    const revoke = Effect.fn("BackstopAutonomyGrant.revoke")(function* (input: {
      projectID: string
      grantID: BackstopControl.GrantID
      timeRevoked: string
    }) {
      yield* events.publish(BackstopControl.AutonomyGrantRevoked, input)
    })

    return Service.of({ create, list, authorize, revoke })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, EventV2.node] })
