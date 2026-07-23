import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260723010014_backstop-autonomy-grants",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`backstop_autonomy_grant\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`command_family\` text NOT NULL,
          \`scope\` text NOT NULL,
          \`work_unit_id\` text,
          \`grantor\` text NOT NULL,
          \`time_created\` text NOT NULL,
          \`time_consumed\` text,
          \`time_revoked\` text
        );
      `)
      yield* tx.run(
        `CREATE INDEX \`backstop_autonomy_grant_project_family_idx\` ON \`backstop_autonomy_grant\` (\`project_id\`,\`command_family\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_autonomy_grant_project_work_unit_idx\` ON \`backstop_autonomy_grant\` (\`project_id\`,\`work_unit_id\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
