import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { BackstopControl } from "../src/backstop-control"
import { DurableEventManifest } from "../src/durable-event-manifest"

describe("Backstop control contracts", () => {
  test("decodes stable semantic command metadata", () => {
    expect(
      Schema.decodeUnknownSync(BackstopControl.CommandMetadata)({
        id: "issue.capture",
        actors: ["human", "primary"],
        permission: "backstop.capture",
        commandFamily: "capture",
        idempotency: "required",
        confirmationRisk: "none",
        description: "Capture a durable issue",
        requiresWorkUnit: false,
      }),
    ).toMatchObject({ id: "issue.capture", actors: ["human", "primary"] })
    expect(() =>
      Schema.decodeUnknownSync(BackstopControl.CommandMetadata)({
        id: "complete",
        actors: ["implementer"],
        permission: "backstop.complete",
        commandFamily: "completion",
        idempotency: "none",
        confirmationRisk: "none",
        description: "Invalid completion authority",
        requiresWorkUnit: true,
      }),
    ).toThrow()
  })

  test("models durable revocable grant scopes", () => {
    expect(
      Schema.decodeUnknownSync(BackstopControl.AutonomyGrant)({
        id: BackstopControl.GrantID.create(),
        projectID: "project-1",
        commandFamily: "implementation",
        scope: "work_unit",
        workUnitID: "BUNDLE-001",
        grantor: "human",
        timeCreated: "2026-07-22T00:00:00.000Z",
      }),
    ).toMatchObject({ scope: "work_unit", workUnitID: "BUNDLE-001" })
  })

  test("registers grant lifecycle as durable project events", () => {
    expect(BackstopControl.DurableDefinitions.map((definition) => definition.type)).toEqual([
      "backstop.autonomy.grant.created",
      "backstop.autonomy.grant.consumed",
      "backstop.autonomy.grant.revoked",
    ])
    for (const definition of BackstopControl.DurableDefinitions) {
      expect(definition.durable).toEqual({ aggregate: "projectID", version: 1 })
      expect(DurableEventManifest.Durable.get(`${definition.type}.1`)).toBe(definition)
    }
  })
})
