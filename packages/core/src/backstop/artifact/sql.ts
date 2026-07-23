import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { BackstopEvent } from "@opencode-ai/schema"
import type { ArtifactProjection, ImportDiagnostic } from "./model"

export const ArtifactFileTable = sqliteTable(
  "backstop_artifact_file",
  {
    id: text().$type<BackstopEvent.ArtifactFileID>().primaryKey(),
    project_id: text().notNull(),
    work_unit_id: text().$type<BackstopEvent.WorkUnitID>().notNull(),
    artifact_path: text().notNull(),
    artifact_kind: text().$type<BackstopEvent.ArtifactKind>().notNull(),
    authored_id: text().notNull(),
    current_revision_id: text().$type<BackstopEvent.ArtifactRevisionID>(),
    candidate_revision_id: text().$type<BackstopEvent.ArtifactRevisionID>(),
    time_created: integer().notNull(),
    time_updated: integer().notNull(),
  },
  (table) => [
    uniqueIndex("backstop_artifact_file_project_work_unit_path_idx").on(
      table.project_id,
      table.work_unit_id,
      table.artifact_path,
    ),
    index("backstop_artifact_file_project_work_unit_idx").on(table.project_id, table.work_unit_id),
  ],
)

export const ArtifactRevisionTable = sqliteTable(
  "backstop_artifact_revision",
  {
    artifact_file_id: text()
      .$type<BackstopEvent.ArtifactFileID>()
      .notNull()
      .references(() => ArtifactFileTable.id, { onDelete: "cascade" }),
    revision_id: text().$type<BackstopEvent.ArtifactRevisionID>().notNull(),
    schema_version: text().notNull(),
    normalized_content_base64: text().notNull(),
    normalized_byte_length: integer().notNull(),
    projection: text({ mode: "json" }).$type<ArtifactProjection>().notNull(),
    diagnostics: text({ mode: "json" }).$type<readonly ImportDiagnostic[]>().notNull(),
    projection_status: text().$type<"parsed" | "parse_failed">().notNull(),
    canonical_validation: text().$type<"unknown" | "passed" | "failed">().notNull(),
    imported_at: text().notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.artifact_file_id, table.revision_id] }),
    index("backstop_artifact_revision_revision_idx").on(table.revision_id),
  ],
)

export const TraceNodeTable = sqliteTable(
  "backstop_trace_node",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    work_unit_id: text().$type<BackstopEvent.WorkUnitID>().notNull(),
    artifact_file_id: text()
      .$type<BackstopEvent.ArtifactFileID>()
      .references(() => ArtifactFileTable.id, { onDelete: "cascade" }),
    revision_id: text().$type<BackstopEvent.ArtifactRevisionID>(),
    node_type: text().$type<"artifact" | "requirement" | "claim" | "task" | "test">().notNull(),
    local_id: text().notNull(),
  },
  (table) => [
    index("backstop_trace_node_project_work_unit_idx").on(table.project_id, table.work_unit_id),
    index("backstop_trace_node_revision_idx").on(table.revision_id),
  ],
)

export const TraceEdgeTable = sqliteTable(
  "backstop_trace_edge",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    work_unit_id: text().$type<BackstopEvent.WorkUnitID>().notNull(),
    edge_type: text().notNull(),
    from_node_id: text()
      .notNull()
      .references(() => TraceNodeTable.id, { onDelete: "cascade" }),
    to_node_id: text()
      .notNull()
      .references(() => TraceNodeTable.id, { onDelete: "cascade" }),
    source_revision_id: text().$type<BackstopEvent.ArtifactRevisionID>().notNull(),
    source_path: text().notNull(),
    source_location: text().notNull(),
  },
  (table) => [
    uniqueIndex("backstop_trace_edge_unique_idx").on(
      table.from_node_id,
      table.edge_type,
      table.to_node_id,
      table.source_revision_id,
    ),
    index("backstop_trace_edge_project_work_unit_idx").on(table.project_id, table.work_unit_id),
    index("backstop_trace_edge_revision_idx").on(table.source_revision_id),
  ],
)

export const ImportDiagnosticTable = sqliteTable(
  "backstop_import_diagnostic",
  {
    artifact_file_id: text()
      .$type<BackstopEvent.ArtifactFileID>()
      .notNull()
      .references(() => ArtifactFileTable.id, { onDelete: "cascade" }),
    revision_id: text().$type<BackstopEvent.ArtifactRevisionID>().notNull(),
    position: integer().notNull(),
    code: text().notNull(),
    location: text().notNull(),
    message: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.artifact_file_id, table.revision_id, table.position] })],
)

export * as BackstopArtifactSql from "./sql"
