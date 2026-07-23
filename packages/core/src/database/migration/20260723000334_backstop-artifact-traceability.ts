import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260723000334_backstop-artifact-traceability",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`backstop_artifact_file\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`work_unit_id\` text NOT NULL,
          \`artifact_path\` text NOT NULL,
          \`artifact_kind\` text NOT NULL,
          \`authored_id\` text NOT NULL,
          \`current_revision_id\` text,
          \`candidate_revision_id\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`backstop_artifact_revision\` (
          \`artifact_file_id\` text NOT NULL,
          \`revision_id\` text NOT NULL,
          \`schema_version\` text NOT NULL,
          \`normalized_content_base64\` text NOT NULL,
          \`normalized_byte_length\` integer NOT NULL,
          \`projection\` text NOT NULL,
          \`diagnostics\` text NOT NULL,
          \`canonical_validation\` text NOT NULL,
          \`imported_at\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`backstop_artifact_revision_pk\` PRIMARY KEY(\`artifact_file_id\`, \`revision_id\`),
          CONSTRAINT \`fk_backstop_artifact_revision_artifact_file_id_backstop_artifact_file_id_fk\` FOREIGN KEY (\`artifact_file_id\`) REFERENCES \`backstop_artifact_file\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`backstop_import_diagnostic\` (
          \`artifact_file_id\` text NOT NULL,
          \`revision_id\` text NOT NULL,
          \`position\` integer NOT NULL,
          \`code\` text NOT NULL,
          \`location\` text NOT NULL,
          \`message\` text NOT NULL,
          CONSTRAINT \`backstop_import_diagnostic_pk\` PRIMARY KEY(\`artifact_file_id\`, \`revision_id\`, \`position\`),
          CONSTRAINT \`fk_backstop_import_diagnostic_artifact_file_id_backstop_artifact_file_id_fk\` FOREIGN KEY (\`artifact_file_id\`) REFERENCES \`backstop_artifact_file\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`backstop_trace_edge\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`work_unit_id\` text NOT NULL,
          \`edge_type\` text NOT NULL,
          \`from_node_id\` text NOT NULL,
          \`to_node_id\` text NOT NULL,
          \`source_revision_id\` text NOT NULL,
          \`source_path\` text NOT NULL,
          \`source_location\` text NOT NULL,
          CONSTRAINT \`fk_backstop_trace_edge_from_node_id_backstop_trace_node_id_fk\` FOREIGN KEY (\`from_node_id\`) REFERENCES \`backstop_trace_node\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_backstop_trace_edge_to_node_id_backstop_trace_node_id_fk\` FOREIGN KEY (\`to_node_id\`) REFERENCES \`backstop_trace_node\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`backstop_trace_node\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`work_unit_id\` text NOT NULL,
          \`artifact_file_id\` text,
          \`revision_id\` text,
          \`node_type\` text NOT NULL,
          \`local_id\` text NOT NULL,
          CONSTRAINT \`fk_backstop_trace_node_artifact_file_id_backstop_artifact_file_id_fk\` FOREIGN KEY (\`artifact_file_id\`) REFERENCES \`backstop_artifact_file\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`backstop_artifact_file_project_work_unit_path_idx\` ON \`backstop_artifact_file\` (\`project_id\`,\`work_unit_id\`,\`artifact_path\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_artifact_file_project_work_unit_idx\` ON \`backstop_artifact_file\` (\`project_id\`,\`work_unit_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_artifact_revision_revision_idx\` ON \`backstop_artifact_revision\` (\`revision_id\`);`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`backstop_trace_edge_unique_idx\` ON \`backstop_trace_edge\` (\`from_node_id\`,\`edge_type\`,\`to_node_id\`,\`source_revision_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_trace_edge_project_work_unit_idx\` ON \`backstop_trace_edge\` (\`project_id\`,\`work_unit_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_trace_edge_revision_idx\` ON \`backstop_trace_edge\` (\`source_revision_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_trace_node_project_work_unit_idx\` ON \`backstop_trace_node\` (\`project_id\`,\`work_unit_id\`);`,
      )
      yield* tx.run(`CREATE INDEX \`backstop_trace_node_revision_idx\` ON \`backstop_trace_node\` (\`revision_id\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
