import { createHash } from "node:crypto"
import { Schema } from "effect"
import { ArtifactRevisionID } from "./schema"
import type { ArtifactFileID, CommandID, WorkUnitID } from "./schema"

export type ArtifactRevisionContent = string | Uint8Array

export interface CandidateArtifactRevision {
  artifact_file_id: ArtifactFileID
  artifact_path: string
  revision_id: ArtifactRevisionID
  normalized_byte_length: number
}

export type ArtifactRevisionComparison =
  | { status: "current" }
  | {
      status: "stale"
      reason: "stale_artifact_revision"
      artifact_file_id: ArtifactFileID
      expected_revision_id: ArtifactRevisionID
      actual_revision_id: ArtifactRevisionID
    }

export function normalizedArtifactContent(content: ArtifactRevisionContent) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content
  const normalized: number[] = []
  bytes.forEach((byte, index) => {
    if (byte === 13) {
      normalized.push(10)
      return
    }
    if (byte === 10 && bytes[index - 1] === 13) return
    normalized.push(byte)
  })
  return Uint8Array.from(normalized)
}

export function hashArtifactRevision(content: ArtifactRevisionContent): ArtifactRevisionID {
  return Schema.decodeUnknownSync(ArtifactRevisionID)(
    `sha256:${createHash("sha256").update(normalizedArtifactContent(content)).digest("hex")}`,
  )
}

export function candidateArtifactRevision(input: {
  artifact_file_id: ArtifactFileID
  artifact_path: string
  content: ArtifactRevisionContent
}): CandidateArtifactRevision {
  const normalized = normalizedArtifactContent(input.content)
  return {
    artifact_file_id: input.artifact_file_id,
    artifact_path: input.artifact_path,
    revision_id: hashArtifactRevision(input.content),
    normalized_byte_length: normalized.byteLength,
  }
}

export function compareArtifactRevision(input: {
  artifact_file_id: ArtifactFileID
  expected_revision_id: ArtifactRevisionID
  actual_revision_id: ArtifactRevisionID
}): ArtifactRevisionComparison {
  if (input.expected_revision_id === input.actual_revision_id) return { status: "current" }
  return { status: "stale", reason: "stale_artifact_revision", ...input }
}

export function requireCurrentArtifactRevision(input: {
  command_id: CommandID
  work_unit_id: WorkUnitID
  artifact_file_id: ArtifactFileID
  expected_revision_id: ArtifactRevisionID
  actual_revision_id: ArtifactRevisionID
}) {
  if (input.expected_revision_id === input.actual_revision_id) return { ok: true as const }
  return { ok: false as const, rejection: { reason: "stale_artifact_revision" as const, ...input } }
}

export * as ArtifactRevision from "./artifact-revision"
