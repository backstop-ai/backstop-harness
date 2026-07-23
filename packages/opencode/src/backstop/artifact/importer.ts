export * as BackstopArtifactImporter from "./importer"

import { BackstopEvent } from "@opencode-ai/schema"
import { BackstopArtifactRepository } from "@opencode-ai/core/backstop/artifact/repository"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { makeLocationNode } from "@opencode-ai/core/effect/app-node"
import { Location } from "@opencode-ai/core/location"
import { RelativePath } from "@opencode-ai/core/schema"
import { Context, Effect, Layer, Schema } from "effect"
import { hashArtifactRevision, normalizedArtifactContent } from "../domain/artifact-revision"

export class MalformedArtifact extends Schema.TaggedErrorClass<MalformedArtifact>()(
  "BackstopArtifactImporter.MalformedArtifact",
  {
    artifactPath: Schema.String,
    message: Schema.String,
  },
) {}

export interface ParsedArtifact {
  readonly artifactKind: BackstopEvent.ArtifactKind
  readonly authoredID: string
  readonly schemaVersion: string
  readonly document: Record<string, unknown>
}

export interface ImportInput {
  readonly workUnitID: BackstopEvent.WorkUnitID
  readonly artifactFileID: BackstopEvent.ArtifactFileID
  readonly artifactPath: string
  readonly expectedAggregateVersion: number
  readonly importedAt: string
}

export interface Interface {
  readonly importArtifact: (
    input: ImportInput,
  ) => Effect.Effect<
    BackstopEvent.ArtifactRevisionImported,
    MalformedArtifact | BackstopArtifactRepository.AggregateVersionConflict
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/BackstopArtifactImporter") {}

function record(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function kind(path: string): BackstopEvent.ArtifactKind | undefined {
  if (path.endsWith(".bundle.md")) return "bundle"
  if (path.endsWith(".spec.md")) return "spec"
  if (path.endsWith(".plan.yml") || path.endsWith(".plan.yaml")) return "plan"
  if (path.endsWith(".directive.md")) return "directive"
  if (path.endsWith(".issue.md")) return "issue"
  return undefined
}

function frontmatter(content: string) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content)
  return match?.[1]
}

export function parseArtifactContent(input: { artifactPath: string; content: string }): ParsedArtifact | undefined {
  const artifactKind = kind(input.artifactPath)
  if (!artifactKind) return undefined
  const source = artifactKind === "plan" ? input.content : frontmatter(input.content)
  if (!source) return undefined
  const document = Bun.YAML.parse(source)
  if (!record(document) || (typeof document.schema_version !== "string" && artifactKind !== "plan")) return undefined

  const issue = record(document.issue) ? document.issue : undefined
  const authoredID = artifactKind === "plan" ? document.plan_id : artifactKind === "issue" ? issue?.id : document.number
  if (typeof authoredID !== "string") return undefined
  return {
    artifactKind,
    authoredID,
    schemaVersion: artifactKind === "plan" ? "plan/v1" : String(document.schema_version),
    document,
  }
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const filesystem = yield* FileSystem.Service
    const location = yield* Location.Service
    const repository = yield* BackstopArtifactRepository.Service

    const importArtifact = Effect.fn("BackstopArtifactImporter.importArtifact")(function* (input: ImportInput) {
      const file = yield* filesystem.read({ path: RelativePath.make(input.artifactPath) })
      const normalized = normalizedArtifactContent(file.content)
      const content = new TextDecoder("utf-8", { fatal: true }).decode(normalized)
      const parsed = parseArtifactContent({ artifactPath: input.artifactPath, content })
      if (!parsed) {
        return yield* new MalformedArtifact({
          artifactPath: input.artifactPath,
          message: "Unsupported path or malformed artifact frontmatter",
        })
      }
      return yield* repository.importRevision({
        projectID: location.project.id,
        workUnitID: input.workUnitID,
        artifactFileID: input.artifactFileID,
        expectedAggregateVersion: input.expectedAggregateVersion,
        artifactPath: input.artifactPath,
        artifactKind: parsed.artifactKind,
        authoredID: parsed.authoredID,
        schemaVersion: parsed.schemaVersion,
        revisionID: Schema.decodeUnknownSync(BackstopEvent.ArtifactRevisionID)(
          String(hashArtifactRevision(normalized)),
        ),
        normalizedContent: normalized,
        importedAt: input.importedAt,
        document: parsed.document,
      })
    })

    return Service.of({ importArtifact })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [FileSystem.node, Location.node, BackstopArtifactRepository.node],
})
