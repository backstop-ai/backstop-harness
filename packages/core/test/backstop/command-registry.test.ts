import { describe, expect, test } from "bun:test"
import { BackstopControl, BackstopEvent } from "@opencode-ai/schema"
import { Effect, Schema } from "effect"
import * as Registry from "../../src/backstop/command/registry"

const id = (value: string) => Schema.decodeUnknownSync(BackstopControl.CommandID)(value)
const workUnitID = Schema.decodeUnknownSync(BackstopEvent.WorkUnitID)("BUNDLE-001")
const context = (actor: BackstopControl.CommandActor, workUnit = true): BackstopControl.CommandContext => ({
  actor,
  projectID: "project-1",
  ...(workUnit ? { workUnitID } : {}),
  idempotencyKey: "command-1",
})

const handler: Registry.HandlerInterface = {
  handle: (input) => Effect.succeed({ handled: input.commandID, value: input.value }),
}

describe("Backstop semantic command registry", () => {
  test("rejects duplicate or incomplete semantic command entries", () => {
    expect(() => Registry.make([Registry.entries[0], Registry.entries[0]], handler)).toThrow(
      "Duplicate Backstop command",
    )
    expect(Registry.entries.every((entry) => entry.metadata.actors.length > 0 && entry.metadata.permission)).toBe(true)
    expect(Registry.entries.some((entry) => String(entry.metadata.id).includes("complete"))).toBe(false)
  })

  test("routes every control surface through one typed command handler", async () => {
    const registry = Registry.make(Registry.entries, handler)
    const result = await Effect.runPromise(
      registry.dispatch({ commandID: id("issue.capture"), context: context("primary", false), input: {} }),
    )
    expect(result).toMatchObject({ _tag: "Accepted", value: { handled: "issue.capture" } })
  })

  test("omits accepted verification authority from implementer tools", () => {
    const commands = Registry.make(Registry.entries, handler)
      .materialize("implementer")
      .map((entry) => entry.metadata.id)
    expect(commands).toContain(id("verification.diagnose"))
    expect(commands).not.toContain(id("verification.accept"))
  })

  test("keeps exploration fluid before a durable capture command", async () => {
    const registry = Registry.make(Registry.entries, handler)
    expect(
      await Effect.runPromise(
        registry.dispatch({ commandID: id("work.read"), context: context("primary", false), input: {} }),
      ),
    ).toMatchObject({ _tag: "Accepted" })
    expect(
      await Effect.runPromise(
        registry.dispatch({ commandID: id("issue.capture"), context: context("primary", false), input: {} }),
      ),
    ).toMatchObject({ _tag: "Accepted" })
  })

  test("rejects ambiguous work-unit targets without global fallback", async () => {
    expect(
      await Effect.runPromise(
        Registry.make(Registry.entries, handler).dispatch({
          commandID: id("work.pause"),
          context: context("primary", false),
          input: {},
        }),
      ),
    ).toMatchObject({ _tag: "ClarificationRequired" })
  })

  test("keeps autonomy grants subordinate to lifecycle gates and actor policy", async () => {
    expect(
      await Effect.runPromise(
        Registry.make(Registry.entries, handler).dispatch({
          commandID: id("bundle.approve"),
          context: context("implementer"),
          input: { grant: "always" },
        }),
      ),
    ).toEqual({ _tag: "Rejected", commandID: id("bundle.approve"), reason: "actor_denied" })
  })

  test("keeps shared controls independent from workflow execution", () => {
    expect(Object.keys(Registry)).not.toEqual(
      expect.arrayContaining(["startWorker", "runVerifier", "publishChat", "renderControlPlane"]),
    )
  })
})
