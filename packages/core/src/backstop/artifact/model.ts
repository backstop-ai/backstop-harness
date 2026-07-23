export * as BackstopArtifactModel from "./model"

import type { BackstopEvent } from "@opencode-ai/schema"

export type ArtifactKind = BackstopEvent.ArtifactKind
export type WorkUnitID = BackstopEvent.WorkUnitID
export type ArtifactFileID = BackstopEvent.ArtifactFileID
export type ArtifactRevisionID = BackstopEvent.ArtifactRevisionID

export interface RequirementProjection {
  readonly id: string
  readonly text: string
  readonly version?: string
  readonly supports: readonly string[]
}

export interface ClaimProjection {
  readonly id: string
  readonly requirementID: string
  readonly text: string
  readonly tests: readonly string[]
}

export interface TaskProjection {
  readonly id: string
  readonly claims: readonly string[]
  readonly testNames: readonly string[]
  readonly dependsOn: readonly string[]
}

export interface ArtifactProjection {
  readonly bundleName?: string
  readonly status?: string
  readonly targetArtifactID?: string
  readonly requirements: readonly RequirementProjection[]
  readonly claims: readonly ClaimProjection[]
  readonly tasks: readonly TaskProjection[]
  readonly sources: readonly string[]
  readonly deliveredBy?: string
  readonly resolvedBy?: string
  readonly repairObligations: readonly string[]
}

export interface ArtifactRevision {
  readonly projectID: string
  readonly workUnitID: WorkUnitID
  readonly artifactFileID: ArtifactFileID
  readonly artifactPath: string
  readonly artifactKind: ArtifactKind
  readonly authoredID: string
  readonly schemaVersion: string
  readonly revisionID: ArtifactRevisionID
  readonly normalizedContentBase64: string
  readonly normalizedByteLength: number
  readonly importedAt: string
  readonly canonicalValidation: "unknown" | "passed" | "failed"
  readonly projection: ArtifactProjection
}

export type ImportDiagnosticCode =
  | "malformed_document"
  | "unsupported_schema_version"
  | "malformed_requirement"
  | "malformed_claim"
  | "malformed_task"

export interface ImportDiagnostic {
  readonly code: ImportDiagnosticCode
  readonly location: string
  readonly message: string
}

export type ProjectArtifactResult =
  | { readonly status: "parsed"; readonly projection: ArtifactProjection; readonly diagnostics: readonly [] }
  | { readonly status: "parse_failed"; readonly diagnostics: readonly ImportDiagnostic[] }

export interface ProjectArtifactInput {
  readonly artifactKind: ArtifactKind
  readonly schemaVersion: string
  readonly document: unknown
}

const supportedVersions = {
  bundle: "bundle/v2",
  spec: "spec/v1",
  plan: "plan/v1",
  directive: "directive/v1",
  issue: "issue/v1",
} as const satisfies Record<ArtifactKind, string>

function record(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function strings(input: unknown): string[] | undefined {
  if (typeof input === "string") return [input]
  if (!Array.isArray(input)) return undefined
  const result = input.filter((value): value is string => typeof value === "string")
  return result.length === input.length ? result : undefined
}

function requirements(input: unknown): RequirementProjection[] | undefined {
  if (input === undefined) return []
  if (!Array.isArray(input)) return undefined
  const result = input
    .map((value) => (record(value) ? value : undefined))
    .map((item) => {
      if (!item || typeof item.id !== "string" || typeof item.text !== "string") return undefined
      const supports = item.supports === undefined ? [] : strings(item.supports)
      if (!supports) return undefined
      return {
        id: item.id,
        text: item.text,
        ...(typeof item.version === "string" ? { version: item.version } : {}),
        supports,
      }
    })
  return result.some((item) => item === undefined) ? undefined : result.filter((item) => item !== undefined)
}

function claims(input: unknown): ClaimProjection[] | undefined {
  if (input === undefined) return []
  if (!Array.isArray(input)) return undefined
  const result = input
    .map((value) => (record(value) ? value : undefined))
    .map((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        typeof item.requirement !== "string" ||
        typeof item.text !== "string"
      ) {
        return undefined
      }
      const tests = strings(item.tests)
      if (!tests) return undefined
      return { id: item.id, requirementID: item.requirement, text: item.text, tests }
    })
  return result.some((item) => item === undefined) ? undefined : result.filter((item) => item !== undefined)
}

function tasks(input: unknown): TaskProjection[] | undefined {
  if (input === undefined) return []
  const phases = Array.isArray(input) ? input : undefined
  if (!phases) return undefined
  const values = phases.flatMap((phase) => {
    return record(phase) && Array.isArray(phase.tasks) ? phase.tasks : []
  })
  const result = values
    .map((value) => (record(value) ? value : undefined))
    .map((item) => {
      if (!item || typeof item.id !== "string") return undefined
      const claimIDs = strings(item.claims)
      const testNames = strings(item.test_names)
      const dependsOn = strings(item.depends_on)
      if (!claimIDs || !testNames || !dependsOn) return undefined
      return { id: item.id, claims: claimIDs, testNames, dependsOn }
    })
  return result.some((item) => item === undefined) ? undefined : result.filter((item) => item !== undefined)
}

export function projectArtifact(input: ProjectArtifactInput): ProjectArtifactResult {
  if (supportedVersions[input.artifactKind] !== input.schemaVersion) {
    return {
      status: "parse_failed",
      diagnostics: [{ code: "unsupported_schema_version", location: "schema_version", message: input.schemaVersion }],
    }
  }
  if (!record(input.document)) {
    return {
      status: "parse_failed",
      diagnostics: [{ code: "malformed_document", location: "$", message: "artifact projection must be an object" }],
    }
  }
  const document = input.document

  const projectedRequirements = requirements(document.requirements)
  if (!projectedRequirements) {
    return {
      status: "parse_failed",
      diagnostics: [
        { code: "malformed_requirement", location: "requirements", message: "invalid requirement projection" },
      ],
    }
  }
  const projectedClaims = claims(document.claims)
  if (!projectedClaims) {
    return {
      status: "parse_failed",
      diagnostics: [{ code: "malformed_claim", location: "claims", message: "invalid claim projection" }],
    }
  }
  const projectedTasks = tasks(document.phases)
  if (!projectedTasks) {
    return {
      status: "parse_failed",
      diagnostics: [{ code: "malformed_task", location: "phases", message: "invalid task projection" }],
    }
  }

  const bundle = record(document.bundle) ? document.bundle : undefined
  const directive = record(document.directive) ? document.directive : undefined
  const issue = record(document.issue) ? document.issue : undefined
  return {
    status: "parsed",
    diagnostics: [],
    projection: {
      ...(typeof bundle?.name === "string" ? { bundleName: bundle.name } : {}),
      ...(typeof document.status === "string"
        ? { status: document.status }
        : typeof issue?.status === "string"
          ? { status: issue.status }
          : {}),
      ...(typeof document.spec_id === "string"
        ? { targetArtifactID: document.spec_id }
        : typeof directive?.spec === "string"
          ? { targetArtifactID: directive.spec }
          : {}),
      requirements: projectedRequirements,
      claims: projectedClaims,
      tasks: projectedTasks,
      sources: strings(directive?.source) ?? [],
      ...(typeof issue?.delivered_by === "string" ? { deliveredBy: issue.delivered_by } : {}),
      ...(typeof issue?.["resolved-by"] === "string" ? { resolvedBy: issue["resolved-by"] } : {}),
      repairObligations: strings(issue?.repair_obligations) ?? [],
    },
  }
}
