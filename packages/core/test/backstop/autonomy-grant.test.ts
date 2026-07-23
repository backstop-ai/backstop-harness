import { describe, expect } from "bun:test"
import { BackstopEvent } from "@opencode-ai/schema"
import { Effect, Schema } from "effect"
import { BackstopAutonomyGrant } from "../../src/backstop/command/grant"
import { Database } from "../../src/database/database"
import { AppNodeBuilder } from "../../src/effect/app-node-builder"
import { LayerNode } from "../../src/effect/layer-node"
import { EventV2 } from "../../src/event"
import { testEffect } from "../lib/effect"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, BackstopAutonomyGrant.node])))
const workUnitID = Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001")
const policy = {
  projectID: "project-1",
  commandFamily: "implementation",
  workUnitID,
  time: "2026-07-22T00:01:00.000Z",
  actorAllowed: true,
  lifecycleAllowed: true,
  humanGateRequired: false,
  evidenceSatisfied: true,
  paused: false,
} as const

describe("Backstop autonomy grants", () => {
  it.effect("persists lists consumes and revokes scoped autonomy grants", () =>
    Effect.gen(function* () {
      const grants = yield* BackstopAutonomyGrant.Service
      const once = yield* grants.create({
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "once",
        grantor: "human",
        timeCreated: "2026-07-22T00:00:00.000Z",
      })
      expect(yield* grants.list({ projectID: "project-1" })).toEqual([once])
      expect(yield* grants.authorize(policy)).toMatchObject({ _tag: "Granted", grant: { id: once.id } })
      expect(yield* grants.list({ projectID: "project-1" })).toEqual([])
      expect(yield* grants.list({ projectID: "project-1", includeInactive: true })).toEqual([
        expect.objectContaining({ id: once.id, timeConsumed: policy.time }),
      ])

      const durable = yield* grants.create({
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "work_unit",
        workUnitID,
        grantor: "human",
        timeCreated: "2026-07-22T00:02:00.000Z",
      })
      yield* grants.revoke({
        projectID: "project-1",
        grantID: durable.id,
        timeRevoked: "2026-07-22T00:03:00.000Z",
      })
      expect(yield* grants.list({ projectID: "project-1" })).toEqual([])
    }),
  )

  it.effect("keeps autonomy grants subordinate to lifecycle gates and actor policy", () =>
    Effect.gen(function* () {
      const grants = yield* BackstopAutonomyGrant.Service
      yield* grants.create({
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "project_command_family",
        grantor: "human",
        timeCreated: "2026-07-22T00:00:00.000Z",
      })
      expect(yield* grants.authorize({ ...policy, actorAllowed: false })).toMatchObject({ reason: "actor_denied" })
      expect(yield* grants.authorize({ ...policy, lifecycleAllowed: false })).toMatchObject({
        reason: "illegal_transition",
      })
      expect(yield* grants.authorize({ ...policy, humanGateRequired: true })).toMatchObject({
        reason: "human_gate_required",
      })
      expect(yield* grants.authorize({ ...policy, evidenceSatisfied: false })).toMatchObject({
        reason: "evidence_required",
      })
      expect(yield* grants.authorize({ ...policy, paused: true })).toMatchObject({ reason: "paused" })
      expect(yield* grants.authorize(policy)).toMatchObject({ _tag: "Granted" })
    }),
  )

  it.effect("isolates grants by project work unit and command family", () =>
    Effect.gen(function* () {
      const grants = yield* BackstopAutonomyGrant.Service
      yield* grants.create({
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "work_unit",
        workUnitID,
        grantor: "human",
        timeCreated: "2026-07-22T00:00:00.000Z",
      })
      expect(yield* grants.authorize({ ...policy, projectID: "project-2" })).toMatchObject({
        reason: "no_matching_grant",
      })
      expect(yield* grants.authorize({ ...policy, commandFamily: "review" })).toMatchObject({
        reason: "no_matching_grant",
      })
      expect(
        yield* grants.authorize({
          ...policy,
          workUnitID: Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-002"),
        }),
      ).toMatchObject({ reason: "no_matching_grant" })
    }),
  )

  it.effect("consumes allow-once grants at most once under concurrency", () =>
    Effect.gen(function* () {
      const grants = yield* BackstopAutonomyGrant.Service
      yield* grants.create({
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "once",
        grantor: "human",
        timeCreated: "2026-07-22T00:00:00.000Z",
      })
      const exits = yield* Effect.all(
        ["2026-07-22T00:01:00.000Z", "2026-07-22T00:01:01.000Z"].map((time) =>
          grants.authorize({ ...policy, time }).pipe(Effect.exit),
        ),
        { concurrency: "unbounded" },
      )
      expect(exits.filter((exit) => exit._tag === "Success" && exit.value._tag === "Granted")).toHaveLength(1)
    }),
  )

  it.effect("rejects malformed work-unit grant scopes", () =>
    Effect.gen(function* () {
      const grants = yield* BackstopAutonomyGrant.Service
      expect(
        yield* grants
          .create({
            projectID: "project-1",
            commandFamily: "implementation",
            scope: "work_unit",
            grantor: "human",
            timeCreated: "2026-07-22T00:00:00.000Z",
          })
          .pipe(Effect.exit),
      ).toMatchObject({ _tag: "Failure" })
    }),
  )
})
