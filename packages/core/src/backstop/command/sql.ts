import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { BackstopControl, BackstopEvent } from "@opencode-ai/schema"

export const AutonomyGrantTable = sqliteTable(
  "backstop_autonomy_grant",
  {
    id: text().$type<BackstopControl.GrantID>().primaryKey(),
    project_id: text().notNull(),
    command_family: text().notNull(),
    scope: text().$type<BackstopControl.GrantScope>().notNull(),
    work_unit_id: text().$type<BackstopEvent.WorkUnitID>(),
    grantor: text().$type<BackstopControl.CommandActor>().notNull(),
    time_created: text().notNull(),
    time_consumed: text(),
    time_revoked: text(),
  },
  (table) => [
    index("backstop_autonomy_grant_project_family_idx").on(table.project_id, table.command_family),
    index("backstop_autonomy_grant_project_work_unit_idx").on(table.project_id, table.work_unit_id),
  ],
)

export * as BackstopCommandSql from "./sql"
