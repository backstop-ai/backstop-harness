export * as BackstopCommandRegistry from "./registry"

import { BackstopControl } from "@opencode-ai/schema"
import { Context, Effect, Layer, Schema } from "effect"
import { makeGlobalNode, tags } from "../../effect/app-node"
import { LayerNode } from "../../effect/layer-node"

type InputSchema = Schema.Codec<unknown, unknown>

export interface Entry {
  readonly metadata: BackstopControl.CommandMetadata
  readonly input: InputSchema
}

export interface DispatchInput {
  readonly commandID: BackstopControl.CommandID
  readonly context: BackstopControl.CommandContext
  readonly input: unknown
}

export interface HandlerInterface {
  readonly handle: (input: {
    readonly commandID: BackstopControl.CommandID
    readonly context: BackstopControl.CommandContext
    readonly value: unknown
  }) => Effect.Effect<unknown>
}

export class Handler extends Context.Service<Handler, HandlerInterface>()("@opencode/v2/BackstopCommandHandler") {}
export const handlerNode = LayerNode.unbound(Handler, tags.values.global)

export interface Interface {
  readonly list: () => readonly Entry[]
  readonly materialize: (actor: BackstopControl.CommandActor) => readonly Entry[]
  readonly get: (id: BackstopControl.CommandID) => Entry | undefined
  readonly dispatch: (input: DispatchInput) => Effect.Effect<BackstopControl.CommandResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopCommandRegistry") {}

const objectInput = Schema.Record(Schema.String, Schema.Unknown)

function metadata(input: {
  id: string
  actors: readonly BackstopControl.CommandActor[]
  family: string
  risk?: BackstopControl.ConfirmationRisk
  workUnit?: boolean
  idempotency?: "none" | "required" | "derived"
  legalAction?: string
}): BackstopControl.CommandMetadata {
  return Schema.decodeUnknownSync(BackstopControl.CommandMetadata)({
    id: input.id,
    actors: input.actors,
    permission: `backstop.${input.family}`,
    commandFamily: input.family,
    idempotency: input.idempotency ?? "required",
    confirmationRisk: input.risk ?? "none",
    description: input.id.replaceAll(".", " "),
    requiresWorkUnit: input.workUnit ?? true,
    ...(input.legalAction ? { legalAction: input.legalAction } : {}),
  })
}

const humanPrimary = ["human", "primary"] as const
const runtime = ["orchestrator", "system"] as const

export const entries = Object.freeze(
  [
    metadata({
      id: "work.read",
      actors: [...humanPrimary, ...runtime, "writer", "reviewer", "implementer", "verifier"],
      family: "read",
      workUnit: false,
      idempotency: "none",
    }),
    metadata({ id: "work.explain", actors: humanPrimary, family: "read", workUnit: false, idempotency: "none" }),
    metadata({ id: "issue.capture", actors: humanPrimary, family: "capture", workUnit: false }),
    metadata({ id: "bundle.capture", actors: humanPrimary, family: "capture", workUnit: false }),
    metadata({ id: "focus.set", actors: humanPrimary, family: "focus", workUnit: false, idempotency: "derived" }),
    metadata({
      id: "artifact.reconcile",
      actors: [...humanPrimary, "orchestrator"],
      family: "revision",
      risk: "commitment",
      legalAction: "reconcile_revision",
    }),
    metadata({
      id: "bundle.approve",
      actors: ["human"],
      family: "signoff",
      risk: "commitment",
      legalAction: "approve_bundle",
    }),
    metadata({
      id: "directive.file",
      actors: ["human", "primary"],
      family: "commitment",
      risk: "commitment",
      legalAction: "file_directive",
    }),
    metadata({ id: "spec.draft", actors: ["orchestrator", "writer"], family: "artifact", legalAction: "draft_spec" }),
    metadata({ id: "review.submit", actors: ["reviewer"], family: "review", legalAction: "submit_review" }),
    metadata({ id: "plan.draft", actors: ["orchestrator", "writer"], family: "artifact", legalAction: "draft_plan" }),
    metadata({
      id: "implementation.start",
      actors: ["human", "orchestrator"],
      family: "implementation",
      risk: "commitment",
      legalAction: "start_implementation",
    }),
    metadata({ id: "task.close", actors: ["implementer"], family: "task", legalAction: "close_task" }),
    metadata({
      id: "blocker.report",
      actors: ["writer", "reviewer", "implementer", "verifier", "orchestrator"],
      family: "blocker",
      legalAction: "report_blocker",
    }),
    metadata({
      id: "verification.diagnose",
      actors: ["implementer"],
      family: "diagnostic",
      legalAction: "record_diagnostic",
    }),
    metadata({
      id: "verification.accept",
      actors: ["verifier", "system"],
      family: "verification",
      legalAction: "accept_evidence",
    }),
    metadata({
      id: "trace.read",
      actors: [...humanPrimary, ...runtime, "writer", "reviewer", "implementer", "verifier"],
      family: "read",
      idempotency: "none",
    }),
    metadata({ id: "work.pause", actors: humanPrimary, family: "lifecycle", risk: "reversible", legalAction: "pause" }),
    metadata({
      id: "work.resume",
      actors: humanPrimary,
      family: "lifecycle",
      risk: "reversible",
      legalAction: "resume",
    }),
    metadata({ id: "work.cancel", actors: ["human"], family: "lifecycle", risk: "terminal", legalAction: "cancel" }),
    metadata({ id: "grant.create", actors: ["human"], family: "grant", workUnit: false, risk: "commitment" }),
    metadata({ id: "grant.list", actors: humanPrimary, family: "grant", workUnit: false, idempotency: "none" }),
    metadata({ id: "grant.revoke", actors: ["human"], family: "grant", workUnit: false, risk: "reversible" }),
  ].map((item) => Object.freeze({ metadata: item, input: objectInput })),
)

const rejected = (commandID: BackstopControl.CommandID, reason: string): BackstopControl.CommandResult => ({
  _tag: "Rejected",
  commandID,
  reason,
})

const clarification = (commandID: BackstopControl.CommandID): BackstopControl.CommandResult => ({
  _tag: "ClarificationRequired",
  commandID,
  question: "Which work unit should this command target?",
})

export function make(input: readonly Entry[], handler: HandlerInterface): Interface {
  const registry = new Map<BackstopControl.CommandID, Entry>()
  for (const entry of input) {
    if (registry.has(entry.metadata.id)) throw new Error(`Duplicate Backstop command: ${entry.metadata.id}`)
    registry.set(entry.metadata.id, Object.freeze(entry))
  }
  const list = Object.freeze([...registry.values()].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id)))
  return Service.of({
    list: () => list,
    materialize: (actor) => list.filter((entry) => entry.metadata.actors.includes(actor)),
    get: (id) => registry.get(id),
    dispatch: Effect.fn("BackstopCommandRegistry.dispatch")(function* (command) {
      const entry = registry.get(command.commandID)
      if (!entry) return rejected(command.commandID, "unknown_command")
      if (!entry.metadata.actors.includes(command.context.actor)) return rejected(command.commandID, "actor_denied")
      if (entry.metadata.requiresWorkUnit && !command.context.workUnitID) return clarification(command.commandID)
      if (entry.metadata.idempotency === "required" && !command.context.idempotencyKey)
        return rejected(command.commandID, "idempotency_key_required")
      const decoded = yield* Schema.decodeUnknownEffect(entry.input)(command.input).pipe(
        Effect.mapError((error) => error.message),
        Effect.option,
      )
      if (decoded._tag === "None") return rejected(command.commandID, "invalid_input")
      return {
        _tag: "Accepted",
        commandID: command.commandID,
        value: yield* handler.handle({ commandID: command.commandID, context: command.context, value: decoded.value }),
      }
    }),
  })
}

const layer = Layer.effect(
  Service,
  Effect.map(Handler, (handler) => make(entries, handler)),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [handlerNode] })
