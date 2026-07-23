import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260723000442_backstop-artifact-projection-status",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`backstop_artifact_revision\` ADD \`projection_status\` text NOT NULL;`)
    })
  },
} satisfies DatabaseMigration.Migration
