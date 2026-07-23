export * as DurableEventManifest from "./durable-event-manifest"

import { Event } from "./event"
import { BackstopEvent } from "./backstop-event"
import { BackstopControl } from "./backstop-control"
import { SessionEvent } from "./session-event"
import { SessionV1 } from "./session-v1"

export const SessionDurable = {
  definitions: Event.durable(SessionEvent.DurableDefinitions),
  schema: SessionEvent.Durable,
} as const

export const Durable = Event.durable([
  ...BackstopControl.DurableDefinitions,
  ...BackstopEvent.DurableDefinitions,
  ...SessionV1.Event.Definitions.filter((definition) => definition.durable !== undefined),
  ...SessionEvent.DurableDefinitions,
])
