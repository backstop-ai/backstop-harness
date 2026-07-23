import { Effect } from "effect"
import type { DatabaseMigration } from "./migration"

export default {
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`workspace\` (
          \`id\` text PRIMARY KEY,
          \`type\` text NOT NULL,
          \`name\` text DEFAULT '' NOT NULL,
          \`branch\` text,
          \`directory\` text,
          \`extra\` text,
          \`project_id\` text NOT NULL,
          \`time_used\` integer NOT NULL,
          CONSTRAINT \`fk_workspace_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`data_migration\` (
          \`name\` text PRIMARY KEY,
          \`time_completed\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`account_state\` (
          \`id\` integer PRIMARY KEY,
          \`active_account_id\` text,
          \`active_org_id\` text,
          CONSTRAINT \`fk_account_state_active_account_id_account_id_fk\` FOREIGN KEY (\`active_account_id\`) REFERENCES \`account\`(\`id\`) ON DELETE SET NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`account\` (
          \`id\` text PRIMARY KEY,
          \`email\` text NOT NULL,
          \`url\` text NOT NULL,
          \`access_token\` text NOT NULL,
          \`refresh_token\` text NOT NULL,
          \`token_expiry\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`control_account\` (
          \`email\` text NOT NULL,
          \`url\` text NOT NULL,
          \`access_token\` text NOT NULL,
          \`refresh_token\` text NOT NULL,
          \`token_expiry\` integer,
          \`active\` integer NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`control_account_pk\` PRIMARY KEY(\`email\`, \`url\`)
        );
      `)
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
          \`projection_status\` text NOT NULL,
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
      yield* tx.run(`
        CREATE TABLE \`credential\` (
          \`id\` text PRIMARY KEY,
          \`integration_id\` text,
          \`label\` text NOT NULL,
          \`value\` text NOT NULL,
          \`connector_id\` text,
          \`method_id\` text,
          \`active\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`event_sequence\` (
          \`aggregate_id\` text PRIMARY KEY,
          \`seq\` integer NOT NULL,
          \`owner_id\` text
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`event\` (
          \`id\` text PRIMARY KEY,
          \`aggregate_id\` text NOT NULL,
          \`seq\` integer NOT NULL,
          \`type\` text NOT NULL,
          \`data\` text NOT NULL,
          CONSTRAINT \`fk_event_aggregate_id_event_sequence_aggregate_id_fk\` FOREIGN KEY (\`aggregate_id\`) REFERENCES \`event_sequence\`(\`aggregate_id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`permission\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`action\` text NOT NULL,
          \`resource\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_permission_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`project_directory\` (
          \`project_id\` text NOT NULL,
          \`directory\` text NOT NULL,
          \`type\` text,
          \`strategy\` text,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`project_directory_pk\` PRIMARY KEY(\`project_id\`, \`directory\`),
          CONSTRAINT \`fk_project_directory_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`project\` (
          \`id\` text PRIMARY KEY,
          \`worktree\` text NOT NULL,
          \`vcs\` text,
          \`name\` text,
          \`icon_url\` text,
          \`icon_url_override\` text,
          \`icon_color\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_initialized\` integer,
          \`sandboxes\` text NOT NULL,
          \`commands\` text
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`message\` (
          \`id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`data\` text NOT NULL,
          CONSTRAINT \`fk_message_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`part\` (
          \`id\` text PRIMARY KEY,
          \`message_id\` text NOT NULL,
          \`session_id\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`data\` text NOT NULL,
          CONSTRAINT \`fk_part_message_id_message_id_fk\` FOREIGN KEY (\`message_id\`) REFERENCES \`message\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session_context_epoch\` (
          \`session_id\` text PRIMARY KEY,
          \`baseline\` text NOT NULL,
          \`snapshot\` text NOT NULL,
          \`baseline_seq\` integer NOT NULL,
          CONSTRAINT \`fk_session_context_epoch_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session_input\` (
          \`id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`prompt\` text NOT NULL,
          \`delivery\` text NOT NULL,
          \`admitted_seq\` integer NOT NULL,
          \`promoted_seq\` integer,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`fk_session_input_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session_message\` (
          \`id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`type\` text NOT NULL,
          \`seq\` integer NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`data\` text NOT NULL,
          CONSTRAINT \`fk_session_message_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`workspace_id\` text,
          \`parent_id\` text,
          \`slug\` text NOT NULL,
          \`directory\` text NOT NULL,
          \`path\` text,
          \`title\` text NOT NULL,
          \`version\` text NOT NULL,
          \`share_url\` text,
          \`summary_additions\` integer,
          \`summary_deletions\` integer,
          \`summary_files\` integer,
          \`summary_diffs\` text,
          \`metadata\` text,
          \`cost\` real DEFAULT 0 NOT NULL,
          \`tokens_input\` integer DEFAULT 0 NOT NULL,
          \`tokens_output\` integer DEFAULT 0 NOT NULL,
          \`tokens_reasoning\` integer DEFAULT 0 NOT NULL,
          \`tokens_cache_read\` integer DEFAULT 0 NOT NULL,
          \`tokens_cache_write\` integer DEFAULT 0 NOT NULL,
          \`revert\` text,
          \`permission\` text,
          \`agent\` text,
          \`model\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_compacting\` integer,
          \`time_archived\` integer,
          CONSTRAINT \`fk_session_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`todo\` (
          \`session_id\` text NOT NULL,
          \`content\` text NOT NULL,
          \`status\` text NOT NULL,
          \`priority\` text NOT NULL,
          \`position\` integer NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`todo_pk\` PRIMARY KEY(\`session_id\`, \`position\`),
          CONSTRAINT \`fk_todo_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`session_share\` (
          \`session_id\` text PRIMARY KEY,
          \`id\` text NOT NULL,
          \`secret\` text NOT NULL,
          \`url\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_session_share_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
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
      yield* tx.run(
        `CREATE INDEX \`backstop_autonomy_grant_project_family_idx\` ON \`backstop_autonomy_grant\` (\`project_id\`,\`command_family\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`backstop_autonomy_grant_project_work_unit_idx\` ON \`backstop_autonomy_grant\` (\`project_id\`,\`work_unit_id\`);`,
      )
      yield* tx.run(`CREATE UNIQUE INDEX \`event_aggregate_seq_idx\` ON \`event\` (\`aggregate_id\`,\`seq\`);`)
      yield* tx.run(`CREATE INDEX \`event_aggregate_type_seq_idx\` ON \`event\` (\`aggregate_id\`,\`type\`,\`seq\`);`)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_project_action_resource_idx\` ON \`permission\` (\`project_id\`,\`action\`,\`resource\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`message_session_time_created_id_idx\` ON \`message\` (\`session_id\`,\`time_created\`,\`id\`);`,
      )
      yield* tx.run(`CREATE INDEX \`part_message_id_id_idx\` ON \`part\` (\`message_id\`,\`id\`);`)
      yield* tx.run(`CREATE INDEX \`part_session_idx\` ON \`part\` (\`session_id\`);`)
      yield* tx.run(
        `CREATE INDEX \`session_input_session_pending_delivery_seq_idx\` ON \`session_input\` (\`session_id\`,\`promoted_seq\`,\`delivery\`,\`admitted_seq\`);`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`session_input_session_admitted_seq_idx\` ON \`session_input\` (\`session_id\`,\`admitted_seq\`);`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`session_input_session_promoted_seq_idx\` ON \`session_input\` (\`session_id\`,\`promoted_seq\`);`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`session_message_session_seq_idx\` ON \`session_message\` (\`session_id\`,\`seq\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`session_message_session_type_seq_idx\` ON \`session_message\` (\`session_id\`,\`type\`,\`seq\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`session_message_session_time_created_id_idx\` ON \`session_message\` (\`session_id\`,\`time_created\`,\`id\`);`,
      )
      yield* tx.run(`CREATE INDEX \`session_message_time_created_idx\` ON \`session_message\` (\`time_created\`);`)
      yield* tx.run(`CREATE INDEX \`session_project_idx\` ON \`session\` (\`project_id\`);`)
      yield* tx.run(`CREATE INDEX \`session_workspace_idx\` ON \`session\` (\`workspace_id\`);`)
      yield* tx.run(`CREATE INDEX \`session_parent_idx\` ON \`session\` (\`parent_id\`);`)
      yield* tx.run(`CREATE INDEX \`todo_session_idx\` ON \`todo\` (\`session_id\`);`)
    })
  },
} satisfies Omit<DatabaseMigration.Migration, "id">
