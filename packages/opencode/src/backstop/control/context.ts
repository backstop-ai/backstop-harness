export * as BackstopAmbientContext from "./context"

import { BackstopEvent } from "@opencode-ai/schema"
import { makeLocationNode, tags } from "@opencode-ai/core/effect/app-node"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SystemContext } from "@opencode-ai/core/system-context"
import { SystemContextRegistry } from "@opencode-ai/core/system-context/registry"
import { Context, Effect, Layer, Schema } from "effect"

export const FocusedState = Schema.Struct({
  focused: Schema.Literal(true),
  workUnitID: BackstopEvent.WorkUnitID,
  state: Schema.String,
  activeAttempt: Schema.String.pipe(Schema.optional),
  blockers: Schema.Array(Schema.String),
  legalActions: Schema.Array(Schema.String),
  pendingDecisions: Schema.Array(Schema.String),
  verificationSummary: Schema.String.pipe(Schema.optional),
})
export type FocusedState = typeof FocusedState.Type

export const State = Schema.Union([Schema.Struct({ focused: Schema.Literal(false) }), FocusedState])
export type State = typeof State.Type

export interface ReadModelInterface {
  readonly load: () => Effect.Effect<State>
}

export class ReadModel extends Context.Service<ReadModel, ReadModelInterface>()(
  "@opencode/v2/BackstopContextReadModel",
) {}
export const readModelNode = LayerNode.unbound(ReadModel, tags.values.location)

export interface Interface {
  readonly context: SystemContext.SystemContext
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopAmbientContext") {}

function bounded(values: readonly string[]) {
  return [...new Set(values)].sort().slice(0, 20)
}

function normalize(state: State): State {
  if (!state.focused) return state
  return {
    ...state,
    blockers: bounded(state.blockers),
    legalActions: bounded(state.legalActions),
    pendingDecisions: bounded(state.pendingDecisions),
  }
}

function render(state: State) {
  if (!state.focused) {
    return [
      "<backstop>",
      "  No work unit is focused. Freeform exploration is active.",
      "  Capture a durable issue, requirement, decision, or commitment only when warranted.",
      "</backstop>",
    ].join("\n")
  }
  return [
    "<backstop>",
    `  Focus: ${state.workUnitID}`,
    `  State: ${state.state}`,
    ...(state.activeAttempt ? [`  Active attempt: ${state.activeAttempt}`] : []),
    `  Blockers: ${state.blockers.length ? state.blockers.join("; ") : "none"}`,
    `  Legal actions: ${state.legalActions.length ? state.legalActions.join(", ") : "none"}`,
    `  Pending decisions: ${state.pendingDecisions.length ? state.pendingDecisions.join("; ") : "none"}`,
    ...(state.verificationSummary ? [`  Verification: ${state.verificationSummary}`] : []),
    "</backstop>",
  ].join("\n")
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const readModel = yield* ReadModel
    const registry = yield* SystemContextRegistry.Service
    const context = SystemContext.make({
      key: SystemContext.Key.make("backstop/focus"),
      codec: Schema.toCodecJson(State),
      load: readModel.load().pipe(Effect.map(normalize)),
      baseline: render,
      update: (_previous, current) => render(current),
    })
    yield* registry.register({ key: SystemContext.Key.make("backstop/focus"), load: Effect.succeed(context) })
    return Service.of({ context })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [readModelNode, SystemContextRegistry.node],
})
