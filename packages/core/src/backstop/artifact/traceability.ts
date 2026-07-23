export * as BackstopTraceability from "./traceability"

import type { ArtifactFileID, ArtifactRevision, ArtifactRevisionID } from "./model"

export type TraceNodeType = "artifact" | "requirement" | "claim" | "task" | "test"
export type TraceEdgeType =
  | "requirement_supports"
  | "claim_verifies"
  | "claim_mandates_test"
  | "plan_targets"
  | "task_delivers_claim"
  | "task_names_test"
  | "directive_sources"
  | "issue_delivered_by"

export interface TraceNode {
  readonly id: string
  readonly type: TraceNodeType
  readonly projectID: string
  readonly workUnitID: string
  readonly artifactFileID?: ArtifactFileID
  readonly revisionID?: ArtifactRevisionID
  readonly localID: string
}

export interface TraceEdge {
  readonly id: string
  readonly type: TraceEdgeType
  readonly from: string
  readonly to: string
  readonly sourceRevisionID: ArtifactRevisionID
  readonly sourcePath: string
  readonly sourceLocation: string
}

export type ResolutionStatus =
  | "resolved"
  | "missing_artifact"
  | "ambiguous_artifact"
  | "missing_node"
  | "invalid_ref"
  | "version_unlogged"
  | "semantic_pin_stale"
  | "retired_target"

export interface ReferenceResolution {
  readonly sourceRevisionID: ArtifactRevisionID
  readonly sourceLocation: string
  readonly reference: string
  readonly status: ResolutionStatus
  readonly targetNodeID?: string
}

export interface TraceabilityGraph {
  readonly revisions: readonly ArtifactRevision[]
  readonly nodes: readonly TraceNode[]
  readonly edges: readonly TraceEdge[]
  readonly resolutions: readonly ReferenceResolution[]
}

export interface EvidenceRecord {
  readonly evidenceID: string
  readonly workUnitID: string
  readonly artifactRevisions: readonly { artifactFileID: ArtifactFileID; revisionID: ArtifactRevisionID }[]
  readonly claimNodeIDs: readonly string[]
  readonly taskNodeIDs: readonly string[]
  readonly name: string
  readonly repositoryRevision?: string
  readonly semanticScope: "repair" | "final"
  readonly result: "passed" | "failed" | "interrupted"
}

export interface CompletenessGap {
  readonly rootNodeID: string
  readonly kind:
    | "bundle_requirement_uncovered"
    | "spec_requirement_without_claim"
    | "claim_without_test"
    | "claim_not_scheduled"
    | "evidence_missing"
    | "issue_missing_trace_or_repair_obligation"
}

export interface StaleEvidence {
  readonly evidenceID: string
  readonly reasons: readonly (
    | "artifact_revision_changed"
    | "artifact_revision_missing"
    | "repository_revision_changed"
    | "repair_scope_not_final"
    | "failed"
    | "interrupted"
  )[]
}

function artifactNodeID(revision: ArtifactRevision) {
  return `artifact:${revision.projectID}:${revision.workUnitID}:${revision.revisionID}`
}

function childNodeID(type: "requirement" | "claim" | "task", revision: ArtifactRevision, localID: string) {
  return `${type}:${revision.projectID}:${revision.workUnitID}:${revision.revisionID}:${localID}`
}

function testNodeID(projectID: string, workUnitID: string, name: string) {
  return `test:${projectID}:${workUnitID}:${name}`
}

function edge(input: Omit<TraceEdge, "id">): TraceEdge {
  return { ...input, id: `${input.type}:${input.from}:${input.to}:${input.sourceRevisionID}` }
}

function parseSupport(reference: string) {
  const match = /^([^:]+):(REQ-\d+)@(\d+\.\d+\.\d+)$/.exec(reference)
  return match ? { bundleName: match[1], requirementID: match[2], version: match[3] } : undefined
}

function artifactMatches(revisions: readonly ArtifactRevision[], authoredID: string) {
  return revisions.filter((revision) => revision.authoredID === authoredID)
}

export function buildTraceabilityGraph(input: readonly ArtifactRevision[]): TraceabilityGraph {
  const revisions = [...input].sort((left, right) =>
    `${left.projectID}:${left.workUnitID}:${left.artifactPath}:${left.revisionID}`.localeCompare(
      `${right.projectID}:${right.workUnitID}:${right.artifactPath}:${right.revisionID}`,
    ),
  )
  const nodes: TraceNode[] = []
  const edges: TraceEdge[] = []
  const resolutions: ReferenceResolution[] = []

  for (const revision of revisions) {
    const ownership = { projectID: revision.projectID, workUnitID: revision.workUnitID }
    nodes.push({
      id: artifactNodeID(revision),
      type: "artifact",
      ...ownership,
      artifactFileID: revision.artifactFileID,
      revisionID: revision.revisionID,
      localID: revision.authoredID,
    })
    for (const requirement of revision.projection.requirements) {
      nodes.push({
        id: childNodeID("requirement", revision, requirement.id),
        type: "requirement",
        ...ownership,
        artifactFileID: revision.artifactFileID,
        revisionID: revision.revisionID,
        localID: requirement.id,
      })
    }
    for (const claim of revision.projection.claims) {
      const claimID = childNodeID("claim", revision, claim.id)
      nodes.push({
        id: claimID,
        type: "claim",
        ...ownership,
        artifactFileID: revision.artifactFileID,
        revisionID: revision.revisionID,
        localID: claim.id,
      })
      const requirementID = childNodeID("requirement", revision, claim.requirementID)
      if (revision.projection.requirements.some((requirement) => requirement.id === claim.requirementID)) {
        edges.push(
          edge({
            type: "claim_verifies",
            from: claimID,
            to: requirementID,
            sourceRevisionID: revision.revisionID,
            sourcePath: revision.artifactPath,
            sourceLocation: `claims.${claim.id}.requirement`,
          }),
        )
      } else {
        resolutions.push({
          sourceRevisionID: revision.revisionID,
          sourceLocation: `claims.${claim.id}.requirement`,
          reference: claim.requirementID,
          status: "missing_node",
        })
      }
      for (const name of claim.tests) {
        const testID = testNodeID(revision.projectID, revision.workUnitID, name)
        nodes.push({ id: testID, type: "test", ...ownership, localID: name })
        edges.push(
          edge({
            type: "claim_mandates_test",
            from: claimID,
            to: testID,
            sourceRevisionID: revision.revisionID,
            sourcePath: revision.artifactPath,
            sourceLocation: `claims.${claim.id}.tests`,
          }),
        )
      }
    }
  }

  for (const revision of revisions) {
    for (const requirement of revision.projection.requirements) {
      for (const reference of requirement.supports) {
        const parsed = parseSupport(reference)
        const base = {
          sourceRevisionID: revision.revisionID,
          sourceLocation: `requirements.${requirement.id}.supports`,
          reference,
        }
        if (!parsed) {
          resolutions.push({ ...base, status: "invalid_ref" })
          continue
        }
        const candidates = revisions.filter((candidate) => candidate.projection.bundleName === parsed.bundleName)
        if (candidates.length === 0) {
          resolutions.push({ ...base, status: "missing_artifact" })
          continue
        }
        if (candidates.length > 1) {
          resolutions.push({ ...base, status: "ambiguous_artifact" })
          continue
        }
        const target = candidates[0]
        const targetRequirement = target.projection.requirements.find((item) => item.id === parsed.requirementID)
        if (!targetRequirement) {
          resolutions.push({ ...base, status: "missing_node" })
          continue
        }
        if (targetRequirement.version !== parsed.version) {
          resolutions.push({ ...base, status: "semantic_pin_stale" })
          continue
        }
        const targetID = childNodeID("requirement", target, targetRequirement.id)
        edges.push(
          edge({
            type: "requirement_supports",
            from: childNodeID("requirement", revision, requirement.id),
            to: targetID,
            sourceRevisionID: revision.revisionID,
            sourcePath: revision.artifactPath,
            sourceLocation: base.sourceLocation,
          }),
        )
        resolutions.push({ ...base, status: "resolved", targetNodeID: targetID })
      }
    }

    if (revision.projection.targetArtifactID) {
      const matches = artifactMatches(revisions, revision.projection.targetArtifactID)
      const base = {
        sourceRevisionID: revision.revisionID,
        sourceLocation: "spec_id",
        reference: revision.projection.targetArtifactID,
      }
      if (matches.length !== 1) {
        resolutions.push({ ...base, status: matches.length === 0 ? "missing_artifact" : "ambiguous_artifact" })
      } else {
        edges.push(
          edge({
            type: "plan_targets",
            from: artifactNodeID(revision),
            to: artifactNodeID(matches[0]),
            sourceRevisionID: revision.revisionID,
            sourcePath: revision.artifactPath,
            sourceLocation: "spec_id",
          }),
        )
        resolutions.push({ ...base, status: "resolved", targetNodeID: artifactNodeID(matches[0]) })
        for (const task of revision.projection.tasks) {
          const taskID = childNodeID("task", revision, task.id)
          nodes.push({
            id: taskID,
            type: "task",
            projectID: revision.projectID,
            workUnitID: revision.workUnitID,
            artifactFileID: revision.artifactFileID,
            revisionID: revision.revisionID,
            localID: task.id,
          })
          for (const claim of task.claims) {
            const targetClaim = matches[0].projection.claims.find((item) => item.id === claim)
            if (targetClaim)
              edges.push(
                edge({
                  type: "task_delivers_claim",
                  from: taskID,
                  to: childNodeID("claim", matches[0], claim),
                  sourceRevisionID: revision.revisionID,
                  sourcePath: revision.artifactPath,
                  sourceLocation: `tasks.${task.id}.claims`,
                }),
              )
            else
              resolutions.push({
                sourceRevisionID: revision.revisionID,
                sourceLocation: `tasks.${task.id}.claims`,
                reference: claim,
                status: "missing_node",
              })
          }
          for (const name of task.testNames) {
            const testID = testNodeID(revision.projectID, revision.workUnitID, name)
            nodes.push({
              id: testID,
              type: "test",
              projectID: revision.projectID,
              workUnitID: revision.workUnitID,
              localID: name,
            })
            edges.push(
              edge({
                type: "task_names_test",
                from: taskID,
                to: testID,
                sourceRevisionID: revision.revisionID,
                sourcePath: revision.artifactPath,
                sourceLocation: `tasks.${task.id}.test_names`,
              }),
            )
          }
        }
      }
    }
  }

  return {
    revisions,
    nodes: [...new Map(nodes.map((node) => [node.id, node])).values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...new Map(edges.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id)),
    resolutions: resolutions.sort((a, b) =>
      `${a.sourceRevisionID}:${a.sourceLocation}:${a.reference}:${a.status}`.localeCompare(
        `${b.sourceRevisionID}:${b.sourceLocation}:${b.reference}:${b.status}`,
      ),
    ),
  }
}

export function queryCompleteness(input: { graph: TraceabilityGraph; evidence: readonly EvidenceRecord[] }) {
  const gaps: CompletenessGap[] = []
  for (const node of input.graph.nodes) {
    if (node.type === "requirement") {
      const revision = input.graph.revisions.find((item) => item.revisionID === node.revisionID)
      const incomingSupport = input.graph.edges.some(
        (item) => item.type === "requirement_supports" && item.to === node.id,
      )
      const verified = input.graph.edges.some((item) => item.type === "claim_verifies" && item.to === node.id)
      if (revision?.artifactKind === "bundle" && !incomingSupport)
        gaps.push({ rootNodeID: node.id, kind: "bundle_requirement_uncovered" })
      if (revision?.artifactKind === "spec" && !verified)
        gaps.push({ rootNodeID: node.id, kind: "spec_requirement_without_claim" })
    }
    if (node.type === "claim") {
      const tests = input.graph.edges.some((item) => item.type === "claim_mandates_test" && item.from === node.id)
      const scheduled = input.graph.edges.some((item) => item.type === "task_delivers_claim" && item.to === node.id)
      const evidence = input.evidence.some(
        (item) => item.claimNodeIDs.includes(node.id) && item.result === "passed" && item.semanticScope === "final",
      )
      if (!tests) gaps.push({ rootNodeID: node.id, kind: "claim_without_test" })
      if (!scheduled) gaps.push({ rootNodeID: node.id, kind: "claim_not_scheduled" })
      if (!evidence) gaps.push({ rootNodeID: node.id, kind: "evidence_missing" })
    }
  }
  return gaps.sort((a, b) => `${a.rootNodeID}:${a.kind}`.localeCompare(`${b.rootNodeID}:${b.kind}`))
}

export function queryStaleEvidence(input: {
  readonly evidence: readonly EvidenceRecord[]
  readonly currentRevisions: ReadonlyMap<ArtifactFileID, ArtifactRevisionID>
  readonly currentRepositoryRevision?: string
}): readonly StaleEvidence[] {
  return input.evidence
    .map((evidence) => {
      const reasons: StaleEvidence["reasons"][number][] = []
      for (const revision of evidence.artifactRevisions) {
        const current = input.currentRevisions.get(revision.artifactFileID)
        if (!current) reasons.push("artifact_revision_missing")
        else if (current !== revision.revisionID) reasons.push("artifact_revision_changed")
      }
      if (input.currentRepositoryRevision && evidence.repositoryRevision !== input.currentRepositoryRevision)
        reasons.push("repository_revision_changed")
      if (evidence.semanticScope !== "final") reasons.push("repair_scope_not_final")
      if (evidence.result === "failed") reasons.push("failed")
      if (evidence.result === "interrupted") reasons.push("interrupted")
      return { evidenceID: evidence.evidenceID, reasons: [...new Set(reasons)].sort() }
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => a.evidenceID.localeCompare(b.evidenceID))
}
