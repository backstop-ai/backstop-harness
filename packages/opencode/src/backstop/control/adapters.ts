export * as BackstopControlAdapters from "./adapters"

import { BackstopControl, BackstopEvent } from "@opencode-ai/schema"
import { BackstopCommandRegistry } from "@opencode-ai/core/backstop/command/registry"
import { makeLocationNode } from "@opencode-ai/core/effect/app-node"
import { Location } from "@opencode-ai/core/location"
import { Tool } from "@opencode-ai/core/tool/tool"
import { Context, Effect, Layer, Schema } from "effect"

const SurfaceInput = Schema.Struct({
  workUnitID: BackstopEvent.WorkUnitID.pipe(Schema.optional),
  idempotencyKey: Schema.String.pipe(Schema.optional),
  value: Schema.Unknown,
})
type SurfaceInput = typeof SurfaceInput.Type

export interface Descriptor {
  readonly name: string
  readonly commandID: BackstopControl.CommandID
  readonly description: string
  readonly permission: string
  readonly confirmationRisk: BackstopControl.ConfirmationRisk
  readonly execute: (input: SurfaceInput) => Effect.Effect<BackstopControl.CommandResult>
}

export interface Materialization {
  readonly tools: Readonly<Record<string, Tool.AnyTool>>
  readonly slashCommands: readonly Descriptor[]
  readonly directActions: readonly Descriptor[]
  readonly uiActions: readonly Descriptor[]
}

export interface Interface {
  readonly materialize: (actor: BackstopControl.CommandActor) => Materialization
  readonly dispatch: (input: BackstopCommandRegistry.DispatchInput) => Effect.Effect<BackstopControl.CommandResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopControlAdapters") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const registry = yield* BackstopCommandRegistry.Service
    const location = yield* Location.Service

    const dispatch = registry.dispatch
    const materialize = (actor: BackstopControl.CommandActor): Materialization => {
      const descriptors = registry.materialize(actor).map((entry): Descriptor => {
        const execute = (input: SurfaceInput) =>
          dispatch({
            commandID: entry.metadata.id,
            context: {
              actor,
              projectID: location.project.id,
              ...(input.workUnitID ? { workUnitID: input.workUnitID } : {}),
              ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
            },
            input: input.value,
          })
        return Object.freeze({
          name: entry.metadata.id,
          commandID: entry.metadata.id,
          description: entry.metadata.description,
          permission: entry.metadata.permission,
          confirmationRisk: entry.metadata.confirmationRisk,
          execute,
        })
      })
      return {
        tools: Object.fromEntries(
          descriptors.map((descriptor) => [
            descriptor.name.replaceAll(".", "_"),
            Tool.withPermission(
              Tool.make({
                description: descriptor.description,
                input: SurfaceInput,
                output: BackstopControl.CommandResult,
                execute: descriptor.execute,
              }),
              descriptor.permission,
            ),
          ]),
        ),
        slashCommands: descriptors,
        directActions: descriptors,
        uiActions: descriptors,
      }
    }

    return Service.of({ materialize, dispatch })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [BackstopCommandRegistry.node, Location.node],
})
