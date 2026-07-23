import { describe, expect } from "bun:test"
import { BackstopEvent } from "@opencode-ai/schema"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { SystemContext } from "@opencode-ai/core/system-context"
import { Effect, Layer, Schema } from "effect"
import { BackstopAmbientContext } from "../../../src/backstop/control/context"
import { testEffect } from "../../lib/effect"

const focused: BackstopAmbientContext.State = {
  focused: true,
  workUnitID: Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001"),
  state: "implementing",
  activeAttempt: "ATTEMPT-001",
  blockers: ["zeta", "alpha", "alpha"],
  legalActions: ["pause", "cancel"],
  pendingDecisions: ["Approve candidate revision"],
  verificationSummary: "final gate pending",
}

function layer(state: BackstopAmbientContext.State) {
  return AppNodeBuilder.build(BackstopAmbientContext.node, [
    [
      BackstopAmbientContext.readModelNode,
      Layer.succeed(
        BackstopAmbientContext.ReadModel,
        BackstopAmbientContext.ReadModel.of({ load: () => Effect.succeed(state) }),
      ),
    ],
  ])
}

describe("Backstop ambient context", () => {
  testEffect(layer(focused)).effect(
    "renders focused Backstop state blockers actions and decisions deterministically",
    () =>
      Effect.gen(function* () {
        const generation = yield* SystemContext.initialize((yield* BackstopAmbientContext.Service).context)
        expect(generation.baseline).toContain("Focus: BUNDLE-001")
        expect(generation.baseline).toContain("State: implementing")
        expect(generation.baseline).toContain("Blockers: alpha; zeta")
        expect(generation.baseline).toContain("Legal actions: cancel, pause")
        expect(generation.baseline).toContain("Pending decisions: Approve candidate revision")
        expect(generation.baseline).toContain("Verification: final gate pending")
      }),
  )

  testEffect(layer({ focused: false })).effect("keeps exploration fluid before a durable capture command", () =>
    Effect.gen(function* () {
      const generation = yield* SystemContext.initialize((yield* BackstopAmbientContext.Service).context)
      expect(generation.baseline).toContain("No work unit is focused")
      expect(generation.baseline).toContain("Freeform exploration is active")
    }),
  )

  testEffect(layer(focused)).effect("keeps shared controls independent from workflow execution", () =>
    Effect.sync(() => {
      expect(Object.keys(BackstopAmbientContext)).not.toEqual(
        expect.arrayContaining(["startWorker", "runVerifier", "publishChat"]),
      )
    }),
  )
})
