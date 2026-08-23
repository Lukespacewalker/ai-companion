CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_prompt_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"companion_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(500) NOT NULL,
	"avatar_url" text,
	"model" varchar(120) DEFAULT 'auto' NOT NULL,
	"response_style" varchar(24) DEFAULT 'balanced' NOT NULL,
	"memory_mode" varchar(32) DEFAULT 'shared_profile' NOT NULL,
	"memory_instructions" text DEFAULT '' NOT NULL,
	"active_prompt_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companion_prompt_versions" ADD CONSTRAINT "companion_prompt_versions_companion_id_companions_id_fk" FOREIGN KEY ("companion_id") REFERENCES "public"."companions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companion_prompt_versions_companion_version_uidx" ON "companion_prompt_versions" USING btree ("companion_id","version");--> statement-breakpoint
CREATE INDEX "companion_prompt_versions_companion_idx" ON "companion_prompt_versions" USING btree ("companion_id");--> statement-breakpoint
CREATE INDEX "companions_user_id_idx" ON "companions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "companions_user_archived_idx" ON "companions" USING btree ("user_id","archived_at");