import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import * as Revision from "../../../src/backstop/domain/artifact-revision"
import * as Domain from "../../../src/backstop/domain/schema"

const artifactFileID = Schema.decodeUnknownSync(Domain.ArtifactFileID)("FILE-001")
const commandID = Schema.decodeUnknownSync(Domain.CommandID)("CMD-001")
const workUnitID = Schema.decodeUnknownSync(Domain.WorkUnitID)("BUNDLE-001")

describe("artifact revision identity", () => {
  test("normalizes line endings before hashing complete bytes", () => {
    expect(Revision.hashArtifactRevision("title: Test\nbody\n")).toBe(
      Revision.hashArtifactRevision("title: Test\r\nbody\r\n"),
    )
    expect(Revision.hashArtifactRevision("title: Test\nbody\n")).not.toBe(
      Revision.hashArtifactRevision("title: Test\nbody\nextra\n"),
    )
  })

  test("preserves non-UTF-8 bytes while normalizing line endings", () => {
    expect(Revision.hashArtifactRevision(Uint8Array.from([255, 13, 10, 128]))).toBe(
      Revision.hashArtifactRevision(Uint8Array.from([255, 10, 128])),
    )
    expect(Revision.hashArtifactRevision(Uint8Array.from([255, 10, 128]))).not.toBe(
      Revision.hashArtifactRevision(Uint8Array.from([239, 191, 189, 10, 239, 191, 189])),
    )
  })

  test("creates typed candidate revisions", () => {
    expect(
      Revision.candidateArtifactRevision({
        artifact_file_id: artifactFileID,
        artifact_path: "specs/SPEC-001.spec.md",
        content: "title: Test\r\nbody\r\n",
      }),
    ).toMatchObject({
      artifact_file_id: "FILE-001",
      artifact_path: "specs/SPEC-001.spec.md",
      normalized_byte_length: 17,
    })
  })

  test("rejects stale content-dependent commands", () => {
    const expected_revision_id = Revision.hashArtifactRevision("before\n")
    const actual_revision_id = Revision.hashArtifactRevision("after\n")
    expect(
      Revision.requireCurrentArtifactRevision({
        command_id: commandID,
        work_unit_id: workUnitID,
        artifact_file_id: artifactFileID,
        expected_revision_id,
        actual_revision_id,
      }),
    ).toEqual({
      ok: false,
      rejection: {
        reason: "stale_artifact_revision",
        command_id: commandID,
        work_unit_id: workUnitID,
        artifact_file_id: artifactFileID,
        expected_revision_id,
        actual_revision_id,
      },
    })
  })
})
