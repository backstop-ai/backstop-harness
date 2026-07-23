import { describe, expect } from "bun:test"
import { BackstopControl, BackstopEvent } from "@opencode-ai/schema"
import { BackstopCommandRegistry } from "@opencode-ai/core/backstop/command/registry"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Location } from "@opencode-ai/core/location"
import { ProjectV2 } from "@opencode-ai/core/project"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Effect, Layer, Schema } from "effect"
import { BackstopControlAdapters } from "../../../src/backstop/control/adapters"
import { testEffect } from "../../lib/effect"

const calls: BackstopControl.CommandID[] = []
const handlerLayer = Layer.succeed(
  BackstopCommandRegistry.Handler,
  BackstopCommandRegistry.Handler.of({
    handle: (input) => Effect.sync(() => calls.push(input.commandID)),
  }),
)
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of({
    directory: AbsolutePath.make("/tmp/backstop-controls"),
    project: { id: ProjectV2.ID.make("project-1"), directory: AbsolutePath.make("/tmp/backstop-controls") },
  }),
)
const it = testEffect(
  AppNodeBuilder.build(BackstopControlAdapters.node, [
    [BackstopCommandRegistry.handlerNode, handlerLayer],
    [Location.node, locationLayer],
  ]),
)
const workUnitID = Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001")
const commandID = (value: string) => Schema.decodeUnknownSync(BackstopControl.CommandID)(value)

describe("Backstop generated control adapters", () => {
  it.effect("routes every control surface through one typed command handler", () =>
    Effect.gen(function* () {
      calls.length = 0
      const adapters = yield* BackstopControlAdapters.Service
      const surfaces = adapters.materialize("primary")
      const input = { workUnitID, idempotencyKey: "command-1", value: {} }
      for (const descriptors of [surfaces.slashCommands, surfaces.directActions, surfaces.uiActions]) {
        const descriptor = descriptors.find((item) => item.commandID === "work.pause")
        expect(descriptor).toBeDefined()
        if (descriptor) expect(yield* descriptor.execute(input)).toMatchObject({ _tag: "Accepted" })
      }
      expect(calls).toEqual([commandID("work.pause"), commandID("work.pause"), commandID("work.pause")])
      expect(Object.keys(surfaces.tools)).toContain("work_pause")
    }),
  )

  it.effect("executes slash and direct actions without manufacturing conversation", () =>
    Effect.gen(function* () {
      const adapters = yield* BackstopControlAdapters.Service
      const slash = adapters.materialize("primary").slashCommands.find((item) => item.commandID === "issue.capture")
      expect(slash).toBeDefined()
      if (slash) {
        expect(yield* slash.execute({ idempotencyKey: "capture-1", value: { title: "defect" } })).toMatchObject({
          _tag: "Accepted",
        })
      }
      expect(Object.keys(BackstopControlAdapters)).not.toEqual(
        expect.arrayContaining(["prompt", "publishMessage", "runModel"]),
      )
    }),
  )

  it.effect("omits accepted verification authority from implementer tools", () =>
    Effect.gen(function* () {
      const surfaces = (yield* BackstopControlAdapters.Service).materialize("implementer")
      expect(Object.keys(surfaces.tools)).toContain("verification_diagnose")
      expect(Object.keys(surfaces.tools)).not.toContain("verification_accept")
    }),
  )
})
