import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791603434074 implements MigrationInterface {
  name = 'InitialSchema1791603434074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."alert_type_enum" AS ENUM('SHORTAGE', 'MIN_STOCK', 'DELAY', 'ABNORMAL_CONSUMPTION', 'DIFFERENCE', 'PENDING_OPERATION', 'PURITY_NON_CONFORMING', 'QUALITY_REJECTED', 'REQUEST_DEVIATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_severity_enum" AS ENUM('INFO', 'WARNING', 'CRITICAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_status_enum" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "alert" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "type" "public"."alert_type_enum" NOT NULL, "severity" "public"."alert_severity_enum" NOT NULL DEFAULT 'WARNING', "status" "public"."alert_status_enum" NOT NULL DEFAULT 'OPEN', "title" character varying(200) NOT NULL, "message" text NOT NULL, "entity_type" character varying(40), "entity_id" uuid, "workshop_id" uuid, "dedup_key" character varying(160), "data" jsonb, "resolved_by_id" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_notes" text, CONSTRAINT "PK_ad91cad659a3536465d564a4b2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0eaee3b3fe61eb74723fe719ce" ON "alert"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9fb2a74288f33c00b281b4ba02" ON "alert"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4daf4209ed6cace5035cbba124" ON "alert"  ("dedup_key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_action_enum" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'REVERSE', 'ACCESS', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'STATUS_CHANGE', 'SIGN', 'OVERRIDE', 'EXPORT', 'HIDE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "action" "public"."audit_log_action_enum" NOT NULL, "entity_type" character varying(80) NOT NULL, "entity_id" character varying(64), "user_id" uuid, "username" character varying(160), "workshop_id" uuid, "before" jsonb, "after" jsonb, "description" text, "ip" character varying(64), "user_agent" character varying(255), "path" character varying(200), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cbcf87a54ac23c6294ada82ee" ON "audit_log"  ("entity_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb11bd5b662431ea0ac455a27d" ON "audit_log"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_43fef0ec7f613c19c612fffe62" ON "audit_log"  ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "permissions" text array NOT NULL DEFAULT '{}', "is_system" boolean NOT NULL DEFAULT false, "is_workshop_role" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_ee999bb389d7ac0fd967172c41f" UNIQUE ("code"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_family_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_family" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "status" "public"."product_family_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_1ce910c34ac86d1284a327862be" UNIQUE ("code"), CONSTRAINT "PK_8feaa8e0119c4749efd738b5688" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."material_category_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "material_category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(100) NOT NULL, "is_precious_metal" boolean NOT NULL DEFAULT false, "status" "public"."material_category_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_b6c6ce22b149070b3b975cf2e1c" UNIQUE ("code"), CONSTRAINT "PK_f801cc3914e97d9ba4ba87c5d4d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."unit_kind_enum" AS ENUM('MASS', 'COUNT', 'LENGTH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."unit_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "unit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(12) NOT NULL, "name" character varying(60) NOT NULL, "kind" "public"."unit_kind_enum" NOT NULL DEFAULT 'MASS', "factor_to_gram" numeric(16,6) NOT NULL DEFAULT '1', "is_base" boolean NOT NULL DEFAULT false, "status" "public"."unit_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_dfb75cdb2a790fb84327e1d1b15" UNIQUE ("code"), CONSTRAINT "PK_4252c4be609041e559f0c80f58a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."material_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "material" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "category_id" uuid NOT NULL, "purity" numeric(7,3), "karat" smallint, "purity_tolerance" numeric(7,3), "base_unit_id" uuid NOT NULL, "reference_cost" numeric(16,2) NOT NULL DEFAULT '0', "min_stock" numeric(14,4) NOT NULL DEFAULT '0', "is_intermediate" boolean NOT NULL DEFAULT false, "tracks_lots" boolean NOT NULL DEFAULT false, "description" text, "status" "public"."material_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_35179a8a2535c1bc2ca56992cbd" UNIQUE ("code"), CONSTRAINT "PK_0343d0d577f3effc2054cbaca7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_variant_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_variant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "product_id" uuid NOT NULL, "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "standard_weight" numeric(14,4), "attributes" jsonb NOT NULL DEFAULT '{}', "status" "public"."product_variant_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_1ab69c9935c61f7c70791ae0a9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_02a5514d18fe143425c6800792" ON "product_variant"  ("product_id", "code") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."consumption_standard_basis_enum" AS ENUM('PER_GRAM', 'PER_UNIT', 'PER_LOT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "consumption_standard" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "product_id" uuid NOT NULL, "variant_id" uuid, "material_id" uuid NOT NULL, "basis" "public"."consumption_standard_basis_enum" NOT NULL DEFAULT 'PER_GRAM', "quantity" numeric(14,6) NOT NULL, "lot_size_grams" numeric(14,4), "tolerance_pct" numeric(6,3) NOT NULL DEFAULT '5', "notes" text, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_60aef9a9151f894be87d49dfa4c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(160) NOT NULL, "family_id" uuid NOT NULL, "description" text, "target_purity" numeric(7,3), "purity_tolerance" numeric(7,3), "requires_purity_check" boolean NOT NULL DEFAULT true, "requires_quality_check" boolean NOT NULL DEFAULT true, "loss_tolerance_pct" numeric(6,3) NOT NULL DEFAULT '2', "standard_weight" numeric(14,4), "output_material_id" uuid, "current_sheet_version" integer NOT NULL DEFAULT '0', "status" "public"."product_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_99c39b067cfa73c783f0fc49a61" UNIQUE ("code"), CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_workshop" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "product_id" uuid NOT NULL, "workshop_id" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "notes" text, CONSTRAINT "PK_0cf20ea0a3bcc53a3d9c8bd4911" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c5470df872eefb26e942b7c6fa" ON "product_workshop"  ("product_id", "workshop_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workshop_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workshop" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(20) NOT NULL, "name" character varying(120) NOT NULL, "responsible" character varying(120), "phone" character varying(40), "email" character varying(160), "address" character varying(200), "main_production" text, "conditions" text, "status" "public"."workshop_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_1d1787a84edd9fe0b8049ee538e" UNIQUE ("code"), CONSTRAINT "PK_e755b83ccf7c711f998012e1c92" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "app_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "username" character varying(60) NOT NULL, "email" character varying(160) NOT NULL, "full_name" character varying(160) NOT NULL, "phone" character varying(40), "password_hash" character varying(255) NOT NULL, "role_id" uuid NOT NULL, "workshop_id" uuid, "active" boolean NOT NULL DEFAULT true, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "password_changed_at" TIMESTAMP WITH TIME ZONE, "must_change_password" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_22a5c4a3d9b2fb8e4e73fc4ada1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c480e576dd71729addbc2d51b6" ON "app_user"  ("username") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3fa909d0e37c531ebc23770339" ON "app_user"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_838af121380dfe3a6330e04f5bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a802f319abf4af2432d629dfe5" ON "password_reset_token"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "family" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "rotated_at" TIMESTAMP WITH TIME ZONE, "user_agent" character varying(255), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f0812282fad2e352cdaf83ef0a" ON "refresh_token"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_407cbf7a33b94af93195029996" ON "refresh_token"  ("family") `,
    );
    await queryRunner.query(
      `CREATE TABLE "technical_sheet" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "version_number" integer NOT NULL, "standard_weight" numeric(14,4), "weight_tolerance" numeric(14,4), "diameter_mm" numeric(10,3), "length_mm" numeric(10,3), "width_mm" numeric(10,3), "thickness_mm" numeric(10,3), "measures" text, "target_purity" numeric(7,3), "purity_tolerance" numeric(7,3), "variables" jsonb NOT NULL DEFAULT '{}', "notes" text, "change_reason" text, "source_order_id" uuid, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cc27663cfbec0f6a45bb85e7dd6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_523925e24c35dd2c4cfe2b9315" ON "technical_sheet"  ("product_id", "version_number") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cost_entry_type_enum" AS ENUM('MATERIAL', 'LABOR', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cost_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."cost_entry_type_enum" NOT NULL, "order_id" uuid, "product_id" uuid, "workshop_id" uuid, "material_id" uuid, "grams" numeric(14,4), "amount" numeric(16,2) NOT NULL, "description" character varying(200) NOT NULL, "period_date" date NOT NULL, "source_type" character varying(40), "source_id" uuid, "approved_by_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d50422e9b63c3d4246f88cba33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b11b76951a4756fca4f5b57f12" ON "cost_entry"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f1daa3e062ee0e7c664379b72" ON "cost_entry"  ("period_date", "type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."finance_category_type_enum" AS ENUM('INCOME', 'EXPENSE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "type" "public"."finance_category_type_enum" NOT NULL, "is_operating_expense" boolean NOT NULL DEFAULT false, "is_system" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_fc257675ed7df5f75f1e84db884" UNIQUE ("code"), CONSTRAINT "PK_512af380143c8ff1fb30f04b5c5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_method" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(20) NOT NULL, "name" character varying(80) NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_9277a41c2299387b03dfa049a58" UNIQUE ("code"), CONSTRAINT "PK_7744c2b2dd932c9cf42f2b9bc3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_transaction_type_enum" AS ENUM('INCOME', 'EXPENSE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_transaction_source_enum" AS ENUM('MANUAL', 'CUSTOMER_PAYMENT', 'WORKSHOP_PAYMENT', 'MATERIAL_PURCHASE', 'REVERSAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_transaction_status_enum" AS ENUM('POSTED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_transaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "type" "public"."financial_transaction_type_enum" NOT NULL, "category_id" uuid NOT NULL, "concept" character varying(200) NOT NULL, "amount" numeric(16,2) NOT NULL, "transaction_date" date NOT NULL, "third_party_name" character varying(160), "customer_id" uuid, "workshop_id" uuid, "production_order_id" uuid, "payment_method_id" uuid, "support_reference" character varying(160), "source" "public"."financial_transaction_source_enum" NOT NULL DEFAULT 'MANUAL', "source_id" uuid, "status" "public"."financial_transaction_status_enum" NOT NULL DEFAULT 'POSTED', "reversal_of_id" uuid, "notes" text, "responsible_id" character varying NOT NULL, CONSTRAINT "PK_416074dbe39e9f3feb05dec80cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5f4297a70bc58dd73e0a299c71" ON "financial_transaction"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fb5628d7c3e92114db8ca835d" ON "financial_transaction"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ef69844dd2a0a8bf32c8073b4" ON "financial_transaction"  ("transaction_date", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "period_close" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "period" character varying(7) NOT NULL, "totals" jsonb NOT NULL, "notes" text, "closed_by_id" character varying NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8d4aaffb56b207e8c5cc59f1201" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a063c9b04b20d267cdbbb1a22a" ON "period_close"  ("period") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "document_type" character varying(10) NOT NULL DEFAULT 'CC', "document_number" character varying(30) NOT NULL, "name" character varying(160) NOT NULL, "phone" character varying(40), "email" character varying(160), "address" character varying(200), "city" character varying(80), "notes" text, "status" "public"."customer_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0e04c13f290c776ea82987303b" ON "customer"  ("document_type", "document_number") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."location_type_enum" AS ENUM('MOTHER_OFFICE', 'WORKSHOP', 'TRANSIT', 'CUSTOMER', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."location_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "location" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "type" "public"."location_type_enum" NOT NULL, "workshop_id" uuid, "customer_id" uuid, "status" "public"."location_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_50d67b2c22be390e74257516ab8" UNIQUE ("code"), CONSTRAINT "UQ_4b2ba3a79148522b0b27bd220fb" UNIQUE ("workshop_id"), CONSTRAINT "PK_876d7bdba03c72251ec4c2dc827" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "material_lot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(40) NOT NULL, "material_id" uuid NOT NULL, "purity" numeric(7,3), "origin" character varying(160), "customer_id" uuid, "production_order_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_686c5ce280a928e8f5db7e71060" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2d7104e12a6929737df474467f" ON "material_lot"  ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_balance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "location_id" uuid NOT NULL, "material_id" uuid NOT NULL, "lot_id" uuid, "lot_key" character varying(40) NOT NULL DEFAULT 'NONE', "grams" numeric(14,4) NOT NULL DEFAULT '0', "last_movement_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_8ff447107a590b9e90db9c8f914" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6b5a2330839898d8b98c5c3e9d" ON "inventory_balance"  ("location_id", "material_id", "lot_key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."weighing_purpose_enum" AS ENUM('ENTRY', 'DISPATCH', 'RECEPTION', 'CUSTOMER_MATERIAL', 'SALE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."weighing_source_enum" AS ENUM('SCALE', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "weighing" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying(30) NOT NULL, "purpose" "public"."weighing_purpose_enum" NOT NULL, "source" "public"."weighing_source_enum" NOT NULL, "material_id" uuid, "gross_grams" numeric(14,4) NOT NULL, "tare_grams" numeric(14,4) NOT NULL DEFAULT '0', "net_grams" numeric(14,4) NOT NULL, "current_net_grams" numeric(14,4) NOT NULL, "raw_reading" text, "device_info" character varying(120), "stable" boolean NOT NULL DEFAULT true, "manual_reason" text, "notes" text, "used_by_type" character varying(40), "used_by_id" uuid, "captured_by_id" uuid NOT NULL, "captured_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_600690680efe2fc76418a7b9b6a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ea95caccab7f07ce6fd23381be" ON "weighing"  ("number") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inventory_movement_type_enum" AS ENUM('ENTRY', 'DISPATCH', 'CUSTODY_ACCEPTANCE', 'DISPATCH_REJECTION', 'RETURN', 'CONSUMPTION', 'PRODUCTION_OUTPUT', 'TRANSFER', 'ADJUSTMENT', 'LOSS', 'CUSTOMER_CONTRIBUTION', 'REVERSAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inventory_movement_status_enum" AS ENUM('CONFIRMED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_movement" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying(30) NOT NULL, "type" "public"."inventory_movement_type_enum" NOT NULL, "status" "public"."inventory_movement_status_enum" NOT NULL DEFAULT 'CONFIRMED', "material_id" uuid NOT NULL, "lot_id" uuid, "grams" numeric(14,4) NOT NULL, "purity" numeric(7,3), "from_location_id" uuid, "to_location_id" uuid, "production_order_id" uuid, "customer_id" uuid, "weighing_id" uuid, "source_type" character varying(40), "source_id" uuid, "reference" character varying(120), "origin" character varying(160), "notes" text, "unit_cost" numeric(16,2), "override_applied" boolean NOT NULL DEFAULT false, "override_reason" text, "reversal_of_id" uuid, "responsible_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e17362693c889da517444ad8fb5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_77aad4e0f7a26adb84b0e56496" ON "inventory_movement"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_90535904e42b56006f605c3bb8" ON "inventory_movement"  ("production_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_207e432427be3701420e39daf2" ON "inventory_movement"  ("material_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."labor_rate_basis_enum" AS ENUM('GRAM', 'UNIT', 'LOT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "labor_rate" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "workshop_id" uuid NOT NULL, "product_id" uuid, "basis" "public"."labor_rate_basis_enum" NOT NULL DEFAULT 'GRAM', "rate" numeric(16,2) NOT NULL, "valid_from" date NOT NULL, "valid_to" date, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_476421ea94c45eb7e2f3642bdaf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "production_stage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "sequence" integer NOT NULL, "mandatory" boolean NOT NULL DEFAULT true, "requires_photo" boolean NOT NULL DEFAULT true, "requires_video" boolean NOT NULL DEFAULT false, "min_photos" integer NOT NULL DEFAULT '1', "is_final" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_9076ffb4b8f2c51e1bae930885c" UNIQUE ("code"), CONSTRAINT "PK_db6ae0d03dacfb15ef8e8bebe5a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "system_parameter" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "key" character varying(60) NOT NULL, "value" jsonb NOT NULL, "description" character varying(200) NOT NULL, "group_name" character varying(40) NOT NULL DEFAULT 'general', CONSTRAINT "UQ_ab2c102ddb09ec759bc54f107c3" UNIQUE ("key"), CONSTRAINT "PK_a7c7ca5a051cd68ffcf0521738d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."technical_variable_data_type_enum" AS ENUM('NUMBER', 'TEXT', 'BOOLEAN', 'SELECT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "technical_variable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "data_type" "public"."technical_variable_data_type_enum" NOT NULL DEFAULT 'NUMBER', "unit" character varying(20), "options" text array NOT NULL DEFAULT '{}', "required_on_finish" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_d44944d3b8029be3ab8e3d7a40a" UNIQUE ("code"), CONSTRAINT "PK_e872693564085ab76f4d2a0b019" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_file_kind_enum" AS ENUM('PHOTO', 'VIDEO', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_file_purpose_enum" AS ENUM('STAGE', 'PROGRESS', 'FINISHED', 'RECEPTION', 'QUALITY', 'PURITY_SUPPORT', 'CATALOG', 'FINANCE_SUPPORT', 'DISPATCH', 'SIGNATURE', 'ORDER_ATTACHMENT', 'CUSTOMER_MATERIAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "media_file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" "public"."media_file_kind_enum" NOT NULL, "purpose" "public"."media_file_purpose_enum" NOT NULL, "original_name" character varying(255) NOT NULL, "mime_type" character varying(120) NOT NULL, "size_bytes" bigint NOT NULL, "sha256" character varying(64) NOT NULL, "storage_path" character varying(255) NOT NULL, "web_path" character varying(255), "thumb_path" character varying(255), "width" integer, "height" integer, "captured_at" TIMESTAMP WITH TIME ZONE NOT NULL, "caption" text, "production_order_id" uuid, "product_id" uuid, "workshop_id" uuid, "stage_id" uuid, "progress_report_id" uuid, "finished_declaration_id" uuid, "receipt_id" uuid, "technical_sheet_id" uuid, "related_type" character varying(40), "related_id" uuid, "hidden" boolean NOT NULL DEFAULT false, "hidden_reason" text, "hidden_by_id" uuid, "hidden_at" TIMESTAMP WITH TIME ZONE, "public_visible" boolean NOT NULL DEFAULT true, "uploaded_by_id" uuid NOT NULL, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cac82b29eea888470cc40043b76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5451d661c891babc332b04c3d5" ON "media_file"  ("production_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fae3e3060b50b2998d2a89c73c" ON "media_file"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a6e8c18b1e3484e0838f05fbd8" ON "media_file"  ("production_order_id", "captured_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "story_share" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying(64) NOT NULL, "production_order_id" character varying NOT NULL, "title" character varying(160), "expires_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "views" integer NOT NULL DEFAULT '0', "created_by_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_438f2dc1a5c0cad03b3b0594a54" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_127f6f1acdc95b4ea9888409e6" ON "story_share"  ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "consumption_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "material_id" uuid NOT NULL, "grams" numeric(14,4) NOT NULL, "stage_id" uuid, "notes" text, "voided" boolean NOT NULL DEFAULT false, "void_reason" text, "reported_by_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f31e406c6756d48f5fb1b78dbd4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f5bb9e6d1432efe12da551f6a" ON "consumption_report"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "digital_acceptance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entity_type" character varying(40) NOT NULL, "entity_id" character varying NOT NULL, "decision" character varying(30) NOT NULL, "user_id" character varying NOT NULL, "signer_name" character varying(160) NOT NULL, "signature_image" text, "payload" jsonb NOT NULL, "payload_hash" character varying(64) NOT NULL, "observations" text, "ip" character varying(64), "user_agent" character varying(255), "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3f575b41372260caac82ba4535b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6967138e7804aef3d5b3a7c5ec" ON "digital_acceptance"  ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."discrepancy_type_enum" AS ENUM('PROCESS_LOSS', 'CUSTODY_SHORTAGE', 'CUSTODY_SURPLUS', 'DISPATCH_DIFFERENCE', 'RECEPTION_DIFFERENCE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."discrepancy_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "discrepancy" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "order_id" uuid, "workshop_id" uuid, "type" "public"."discrepancy_type_enum" NOT NULL, "material_id" uuid, "grams" numeric(14,4) NOT NULL, "percent" numeric(9,3), "tolerance_pct" numeric(6,3), "within_tolerance" boolean NOT NULL DEFAULT false, "reason" text, "justification" text, "responsible_party" character varying(160), "status" "public"."discrepancy_status_enum" NOT NULL DEFAULT 'PENDING', "source_type" character varying(40), "source_id" uuid, "registered_by_id" character varying NOT NULL, "approved_by_id" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "auto_approved" boolean NOT NULL DEFAULT false, "review_notes" text, "movement_id" uuid, CONSTRAINT "PK_f9bcdcffd5ef71dbab9e08f1df1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8820be991feddc38c4be12c0a0" ON "discrepancy"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_506259cb21a8523c8455dd3816" ON "discrepancy"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0a32f8114cfa522f0a4cf12e7" ON "discrepancy"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_material_requirement" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "order_id" uuid NOT NULL, "material_id" uuid NOT NULL, "required_grams" numeric(14,4) NOT NULL, "tolerance_pct" numeric(6,3) NOT NULL DEFAULT '5', "standard_id" uuid, "manual" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_4244490349642a3f306bcb0bce3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_70d2022dcf56400dbf1897eea6" ON "order_material_requirement"  ("order_id", "material_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."production_order_status_enum" AS ENUM('DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'APPROVED_CLOSED', 'REJECTED_ADJUSTMENT', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."production_order_priority_enum" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "production_order" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid, "workshop_id" uuid NOT NULL, "target_units" integer, "target_grams" numeric(14,4) NOT NULL, "commitment_date" date NOT NULL, "status" "public"."production_order_status_enum" NOT NULL DEFAULT 'DRAFT', "priority" "public"."production_order_priority_enum" NOT NULL DEFAULT 'NORMAL', "notes" text, "technical_sheet_id" uuid, "customer_operation_id" uuid, "parent_order_id" uuid, "created_by_id" uuid NOT NULL, "dispatched_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "started_at" TIMESTAMP WITH TIME ZONE, "finished_by_workshop_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, "approved_by_id" uuid, "rejection_reason" text, "cancellation_reason" text, "reconciliation_snapshot" jsonb, CONSTRAINT "PK_e90e1070bf38dd156947f1322b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_082cac3ff8e4c06faaaeaee982" ON "production_order"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9bb33fdfa4a49eb8a6e5986dc" ON "production_order"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_16dcccbacd108ca5cffca7fd85" ON "production_order"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."material_dispatch_status_enum" AS ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "material_dispatch" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "order_id" uuid, "workshop_id" uuid NOT NULL, "purpose" text NOT NULL, "status" "public"."material_dispatch_status_enum" NOT NULL DEFAULT 'PENDING_ACCEPTANCE', "material_request_id" uuid, "responsible_id" uuid NOT NULL, "notes" text, "responded_at" TIMESTAMP WITH TIME ZONE, "workshop_observations" text, "acceptance_id" uuid, CONSTRAINT "PK_dc10e6e2bc5331a346e27008074" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5f95fefb7440bf42fca90b7abe" ON "material_dispatch"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4e9edbf2b969de0fdadaef81f" ON "material_dispatch"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9bcc290f68435856764000ab2" ON "material_dispatch"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dispatch_line" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dispatch_id" uuid NOT NULL, "material_id" uuid NOT NULL, "lot_id" uuid, "grams" numeric(14,4) NOT NULL, "weighing_id" uuid, "received_grams" numeric(14,4), "override_applied" boolean NOT NULL DEFAULT false, "movement_id" uuid, CONSTRAINT "PK_5cf0180c59aa401abdd67d3a70a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "finished_declaration" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "units" integer, "grams" numeric(14,4) NOT NULL, "technical_values" jsonb NOT NULL DEFAULT '{}', "diameter_mm" numeric(10,3), "length_mm" numeric(10,3), "measures" text, "declared_leftovers" jsonb NOT NULL DEFAULT '[]', "notes" text, "current" boolean NOT NULL DEFAULT true, "declared_by_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0d13e061852380111a74a66097e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bda8079eae0373fdfaefe427a" ON "finished_declaration"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."finished_good_status_enum" AS ENUM('QUARANTINE', 'AVAILABLE', 'REJECTED', 'SOLD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."finished_good_quality_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."finished_good_purity_status_enum" AS ENUM('NOT_REQUIRED', 'PENDING', 'CONFORMING', 'NON_CONFORMING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "finished_good" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "code" character varying(30) NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid, "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "receipt_id" character varying NOT NULL, "location_id" uuid NOT NULL, "units" integer NOT NULL DEFAULT '0', "grams" numeric(14,4) NOT NULL, "available_units" integer NOT NULL DEFAULT '0', "available_grams" numeric(14,4) NOT NULL, "status" "public"."finished_good_status_enum" NOT NULL DEFAULT 'QUARANTINE', "quality_status" "public"."finished_good_quality_status_enum" NOT NULL DEFAULT 'PENDING', "purity_status" "public"."finished_good_purity_status_enum" NOT NULL DEFAULT 'PENDING', "verified_purity" numeric(7,3), "unit_cost_per_gram" numeric(16,2), "total_cost" numeric(16,2), CONSTRAINT "PK_411511f999a48c3ec9cd833d626" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4f5bc7805e742190e6c553db0b" ON "finished_good"  ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f562a1174486147bdf9767dc4" ON "finished_good"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."labor_cost_basis_enum" AS ENUM('GRAM', 'UNIT', 'LOT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."labor_cost_status_enum" AS ENUM('PROPOSED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "labor_cost" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "basis" "public"."labor_cost_basis_enum" NOT NULL, "rate" numeric(16,2) NOT NULL, "quantity" numeric(14,4) NOT NULL, "proposed_value" numeric(16,2) NOT NULL, "approved_value" numeric(16,2), "status" "public"."labor_cost_status_enum" NOT NULL DEFAULT 'PROPOSED', "notes" text, "proposed_by_id" character varying NOT NULL, "reviewed_by_id" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_notes" text, CONSTRAINT "PK_89c5b8cb90fc2266525b870afdf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d20c8839c0f756e855d502dd34" ON "labor_cost"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_afe115d6e6d9bfc8019207dc34" ON "labor_cost"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."material_request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'DISPATCHED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "material_request" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "order_id" uuid, "workshop_id" character varying NOT NULL, "material_id" uuid NOT NULL, "grams" numeric(14,4) NOT NULL, "reason" text NOT NULL, "status" "public"."material_request_status_enum" NOT NULL DEFAULT 'PENDING', "expected_grams" numeric(14,4), "already_delivered_grams" numeric(14,4), "deviation_pct" numeric(9,3), "exceeds_standard" boolean NOT NULL DEFAULT false, "requested_by_id" character varying NOT NULL, "reviewed_by_id" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_notes" text, "dispatch_id" uuid, CONSTRAINT "PK_0d050223cb749e754cb52e914df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f44c6a4f41fdc98d7f3674bc3f" ON "material_request"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_24be0c242438a97957239f6b09" ON "material_request"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fad173440406f2cff6e32ec90" ON "material_request"  ("workshop_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_decision_action_enum" AS ENUM('COMPLETE_FROM_INVENTORY', 'REQUEST_FABRICATION', 'MODIFY_ORDER', 'DISPATCH_PARTIAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_decision" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "action" "public"."order_decision_action_enum" NOT NULL, "material_id" uuid, "required_grams" numeric(14,4), "assigned_grams" numeric(14,4), "shortfall_grams" numeric(14,4), "justification" text NOT NULL, "details" jsonb, "generated_order_id" uuid, "decided_by_id" character varying NOT NULL, "authorized_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2af30770777239426e14b8475b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7553216857ac3e6e0c660f5b83" ON "order_decision"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_history_from_status_enum" AS ENUM('DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'APPROVED_CLOSED', 'REJECTED_ADJUSTMENT', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_history_to_status_enum" AS ENUM('DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'APPROVED_CLOSED', 'REJECTED_ADJUSTMENT', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "from_status" "public"."order_status_history_from_status_enum", "to_status" "public"."order_status_history_to_status_enum" NOT NULL, "reason" text, "user_id" character varying NOT NULL, "user_name" character varying(160) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e6c66d853f155531985fc4f6ec8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ca7d5228cf9dc589b60243933" ON "order_status_history"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."receipt_line_line_type_enum" AS ENUM('FINISHED_PRODUCT', 'LEFTOVER', 'UNUSED', 'RETURN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "receipt_line" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "receipt_id" uuid NOT NULL, "line_type" "public"."receipt_line_line_type_enum" NOT NULL, "material_id" uuid, "units" integer, "grams" numeric(14,4) NOT NULL, "weighing_id" uuid, "movement_id" uuid, "finished_good_id" uuid, CONSTRAINT "PK_a3268abea941f004250ff3135de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."production_receipt_type_enum" AS ENUM('PARTIAL', 'FINAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "production_receipt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "type" "public"."production_receipt_type_enum" NOT NULL, "notes" text, "comparison" jsonb, "received_by_id" character varying NOT NULL, CONSTRAINT "PK_cc05bad4aabcbe198cc3fc1e4ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3ee4cd879e798eb464bf64bfdd" ON "production_receipt"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3fdd95015abbe70126a5e202a8" ON "production_receipt"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "progress_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "workshop_id" character varying NOT NULL, "stage_id" uuid, "grams" numeric(14,4), "units" integer, "percent" numeric(5,2), "notes" text, "completes_stage" boolean NOT NULL DEFAULT false, "reported_by_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_de44d4f311d5a0132f49f9f0820" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54744af586a24e566eecf5a01f" ON "progress_report"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purity_verification_method_enum" AS ENUM('XRF', 'TOUCHSTONE', 'FIRE_ASSAY', 'DENSITY', 'ACID_TEST', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "purity_verification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "receipt_id" character varying NOT NULL, "product_id" character varying NOT NULL, "method" "public"."purity_verification_method_enum" NOT NULL, "support_reference" character varying(160), "support_media_id" uuid, "obtained_value" numeric(7,3) NOT NULL, "target_value" numeric(7,3) NOT NULL, "tolerance" numeric(7,3) NOT NULL, "conforming" boolean NOT NULL, "notes" text, "verified_by_id" character varying NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1a3d5b9184fdb9d65ad2b41f29f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_23dcc3c0e497d75d5f0b1d06d8" ON "purity_verification"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aaef72dafde98757b2ceabc3de" ON "purity_verification"  ("receipt_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quality_check_result_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "quality_check" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "receipt_id" character varying NOT NULL, "result" "public"."quality_check_result_enum" NOT NULL, "checklist" jsonb NOT NULL DEFAULT '[]', "notes" text, "inspector_id" character varying NOT NULL, "checked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_46244a39dc1749e2ba591574d16" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd3643324e9a791bb886782de3" ON "quality_check"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_73476d55329fa779a4d6937d88" ON "quality_check"  ("receipt_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stage_completion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" character varying NOT NULL, "stage_id" uuid NOT NULL, "photo_count" integer NOT NULL DEFAULT '0', "video_count" integer NOT NULL DEFAULT '0', "completed_by_id" character varying NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_34ffd7629df961f82bc5fde93b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_851053796aa665d25875ee7d85" ON "stage_completion"  ("order_id", "stage_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_material_contribution_timing_enum" AS ENUM('BEFORE_FABRICATION', 'AFTER_FABRICATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_material_contribution_status_enum" AS ENUM('POSTED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_material_contribution" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "customer_id" character varying NOT NULL, "operation_id" character varying NOT NULL, "material_id" uuid NOT NULL, "grams" numeric(14,4) NOT NULL, "declared_purity" numeric(7,3) NOT NULL, "verified_purity" numeric(7,3), "fine_grams" numeric(14,4) NOT NULL, "timing" "public"."customer_material_contribution_timing_enum" NOT NULL, "origin" character varying(200) NOT NULL, "contribution_date" date NOT NULL, "price_per_gram" numeric(16,2), "valuation" numeric(16,2), "production_order_id" uuid, "weighing_id" character varying NOT NULL, "movement_id" uuid, "lot_id" uuid, "notes" text, "status" "public"."customer_material_contribution_status_enum" NOT NULL DEFAULT 'POSTED', "received_by_id" character varying NOT NULL, CONSTRAINT "PK_a83377a37e708b5df8ea62358e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c63b185deca7f842a2e36c0753" ON "customer_material_contribution"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d2e73834e09d4384b3903cf97" ON "customer_material_contribution"  ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe0feb43d38d4c5fc20ae41966" ON "customer_material_contribution"  ("operation_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_operation_type_enum" AS ENUM('SALE', 'CUSTOM_ORDER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_operation_status_enum" AS ENUM('OPEN', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CLOSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_operation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "customer_id" uuid NOT NULL, "type" "public"."customer_operation_type_enum" NOT NULL DEFAULT 'SALE', "status" "public"."customer_operation_status_enum" NOT NULL DEFAULT 'OPEN', "description" character varying(200) NOT NULL, "total_value" numeric(16,2) NOT NULL DEFAULT '0', "committed_material_fine_grams" numeric(14,4) NOT NULL DEFAULT '0', "production_order_id" uuid, "due_date" date, "notes" text, "created_by_id" character varying NOT NULL, CONSTRAINT "PK_d7b80797da029f091a381d039d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2acab1bac3cda15f5b5e653d0a" ON "customer_operation"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff7d937a5fe631e090dcbc9566" ON "customer_operation"  ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_payment_status_enum" AS ENUM('POSTED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "customer_id" character varying NOT NULL, "operation_id" uuid, "amount" numeric(16,2) NOT NULL, "payment_method_id" uuid NOT NULL, "payment_date" date NOT NULL, "reference" character varying(120), "notes" text, "status" "public"."customer_payment_status_enum" NOT NULL DEFAULT 'POSTED', "financial_transaction_id" uuid, "received_by_id" character varying NOT NULL, CONSTRAINT "PK_1af087c643bcb1d0f6203ff97ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f37d2561f9665c4386d9605d03" ON "customer_payment"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45591a2495c7db7c063f0decb2" ON "customer_payment"  ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ec1e071aea3b1868f3750a03a2" ON "customer_payment"  ("operation_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sale_dispatch" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "number" character varying(30) NOT NULL, "operation_id" character varying NOT NULL, "customer_id" character varying NOT NULL, "dispatch_date" date NOT NULL, "total_value" numeric(16,2) NOT NULL, "notes" text, "responsible_id" character varying NOT NULL, "reversed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_bdde4a348a662c8f43a57bcc97a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_81ec1146dfd45637db651a49fc" ON "sale_dispatch"  ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_25b022670e6dfd1201cb4430cf" ON "sale_dispatch"  ("operation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb2ab7ec6f277d0fd32fa9b490" ON "sale_dispatch"  ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sale_dispatch_line" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dispatch_id" uuid NOT NULL, "finished_good_id" uuid NOT NULL, "units" integer NOT NULL DEFAULT '0', "grams" numeric(14,4) NOT NULL, "value" numeric(16,2) NOT NULL, "cost" numeric(16,2) NOT NULL DEFAULT '0', "weighing_id" uuid, CONSTRAINT "PK_a78b66e06743402ef1a6b1ab3f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "weighing_adjustment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "weighing_id" uuid NOT NULL, "previous_net_grams" numeric(14,4) NOT NULL, "new_net_grams" numeric(14,4) NOT NULL, "reason" text NOT NULL, "adjusted_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a672a10c2b700c164f4a9090a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_sequence" ("prefix" character varying(20) NOT NULL, "year" integer NOT NULL, "last_value" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_56fdccb7f3ebeddaf427403dee0" PRIMARY KEY ("prefix", "year"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "production_stage_family" ("production_stage_id" uuid NOT NULL, "product_family_id" uuid NOT NULL, CONSTRAINT "PK_ea9bc0f983b60dfea3cec7cf9c2" PRIMARY KEY ("production_stage_id", "product_family_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95df44af08f81dbfad096cadbb" ON "production_stage_family"  ("production_stage_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_21fbdc8a3ee5303208f1d0e550" ON "production_stage_family"  ("product_family_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "technical_variable_family" ("technical_variable_id" uuid NOT NULL, "product_family_id" uuid NOT NULL, CONSTRAINT "PK_5987f8be4592b07467ea9397f25" PRIMARY KEY ("technical_variable_id", "product_family_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_62312c3535121a6df06e3b5142" ON "technical_variable_family"  ("technical_variable_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de99123d5aa2192042272fa34a" ON "technical_variable_family"  ("product_family_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "material" ADD CONSTRAINT "FK_f801cc3914e97d9ba4ba87c5d4d" FOREIGN KEY ("category_id") REFERENCES "material_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material" ADD CONSTRAINT "FK_8e8334ad32e4acd6e5ec458e8ea" FOREIGN KEY ("base_unit_id") REFERENCES "unit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant" ADD CONSTRAINT "FK_ca67dd080aac5ecf99609960cd2" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" ADD CONSTRAINT "FK_a4f34d7aba2da5495f58f4a8b85" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" ADD CONSTRAINT "FK_0d17e86032179041d8348bbf126" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" ADD CONSTRAINT "FK_56266c0b808aa2219e5c7d137b6" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "FK_8feaa8e0119c4749efd738b5688" FOREIGN KEY ("family_id") REFERENCES "product_family"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "FK_c29414eacef0571e86c90476f27" FOREIGN KEY ("output_material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_workshop" ADD CONSTRAINT "FK_4d0679b850d3d750e1e507b14d7" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_workshop" ADD CONSTRAINT "FK_7ae623320a0251a205209321f76" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD CONSTRAINT "FK_00b3d05ef2cf349712d4bd2513f" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD CONSTRAINT "FK_7d22c1b54e1733effebeef88feb" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_7eabb22ed38459ffc24dc8b415d" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_sheet" ADD CONSTRAINT "FK_fa382e057693aeaf2bf30621fe5" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_sheet" ADD CONSTRAINT "FK_10a6ec2ca5c9da8333d702efad5" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_transaction" ADD CONSTRAINT "FK_bc9cac3ceab46ae97edf05089a2" FOREIGN KEY ("category_id") REFERENCES "finance_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_transaction" ADD CONSTRAINT "FK_8bb112cd57841bc52f5adf0a0f8" FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "location" ADD CONSTRAINT "FK_4b2ba3a79148522b0b27bd220fb" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "location" ADD CONSTRAINT "FK_94e2397e21928f8285f1e45306b" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_lot" ADD CONSTRAINT "FK_40e21add1ac3919efc02fe74f43" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_lot" ADD CONSTRAINT "FK_5db0dad54ba4c0c9d8f519d90f4" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" ADD CONSTRAINT "FK_9beb9c9c5b6add4b9e4193fd485" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" ADD CONSTRAINT "FK_ee8677880b11cec8b8a62c70f43" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" ADD CONSTRAINT "FK_97294d0ff4928083b91445f6095" FOREIGN KEY ("lot_id") REFERENCES "material_lot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing" ADD CONSTRAINT "FK_3e9f15b779d6b8bbc5edb9a7fa9" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing" ADD CONSTRAINT "FK_d41de1a88aa8ad2f5040fb11e64" FOREIGN KEY ("captured_by_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_2d5a47ecd4e8e5e609ab5dfc553" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_16b378b8bb11fe226d4c6a68d95" FOREIGN KEY ("lot_id") REFERENCES "material_lot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_1745a1f0289966868c0de620e2c" FOREIGN KEY ("from_location_id") REFERENCES "location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_70e63319f8ae6ae3c7dd0cbc5c5" FOREIGN KEY ("to_location_id") REFERENCES "location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_cb0369db9386b23c5adebbf73c8" FOREIGN KEY ("weighing_id") REFERENCES "weighing"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD CONSTRAINT "FK_affd5000f6b2e7550201d76b711" FOREIGN KEY ("responsible_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "labor_rate" ADD CONSTRAINT "FK_a3d9f212bbd280eb59f8a7dc796" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "labor_rate" ADD CONSTRAINT "FK_e86a0b505edce47aa3f95841315" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_file" ADD CONSTRAINT "FK_cbe4e7c1a0cfadf9ee32986812e" FOREIGN KEY ("uploaded_by_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_report" ADD CONSTRAINT "FK_27d5fcf51d2eae8ff133fa7c680" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discrepancy" ADD CONSTRAINT "FK_76b55ba6a2f00070f8a7be00a62" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_material_requirement" ADD CONSTRAINT "FK_9e7d46074b5f0aef284baeddeae" FOREIGN KEY ("order_id") REFERENCES "production_order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_material_requirement" ADD CONSTRAINT "FK_3214a0860469554fa1bd96c31eb" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" ADD CONSTRAINT "FK_ce05612aefa4b63528b3f39bd5b" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" ADD CONSTRAINT "FK_130b82831e13b249618777ce3fb" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" ADD CONSTRAINT "FK_f9bb33fdfa4a49eb8a6e5986dc6" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" ADD CONSTRAINT "FK_4b3ec89538fe9cfc708953ade8f" FOREIGN KEY ("technical_sheet_id") REFERENCES "technical_sheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" ADD CONSTRAINT "FK_2e19783d0285616e5c2d54e8d07" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" ADD CONSTRAINT "FK_b4e9edbf2b969de0fdadaef81f6" FOREIGN KEY ("order_id") REFERENCES "production_order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" ADD CONSTRAINT "FK_b9bcc290f68435856764000ab24" FOREIGN KEY ("workshop_id") REFERENCES "workshop"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" ADD CONSTRAINT "FK_8ef1a5f8e0cf425e790a35c97f2" FOREIGN KEY ("responsible_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" ADD CONSTRAINT "FK_f50542ff34b26867444585fc386" FOREIGN KEY ("acceptance_id") REFERENCES "digital_acceptance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" ADD CONSTRAINT "FK_2c7c2d6d1a8aa03280bee103dab" FOREIGN KEY ("dispatch_id") REFERENCES "material_dispatch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" ADD CONSTRAINT "FK_643c3315df93d44bb6232a49ebc" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" ADD CONSTRAINT "FK_2781333fc4dc4cf90d2c29a632c" FOREIGN KEY ("lot_id") REFERENCES "material_lot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" ADD CONSTRAINT "FK_e0060fda3a4200a3fae87d2e681" FOREIGN KEY ("weighing_id") REFERENCES "weighing"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" ADD CONSTRAINT "FK_c9ce5ee9f9689c5b495a86aa6cf" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" ADD CONSTRAINT "FK_ed03ba28e9025cbf9b41a0a9c56" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" ADD CONSTRAINT "FK_8d54d5478700dcc75a96f9dc557" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_request" ADD CONSTRAINT "FK_24be0c242438a97957239f6b097" FOREIGN KEY ("order_id") REFERENCES "production_order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_request" ADD CONSTRAINT "FK_232e4df4d614ae7388c49b48ebe" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" ADD CONSTRAINT "FK_94172cf5d5fdf40f16eb2e549d9" FOREIGN KEY ("receipt_id") REFERENCES "production_receipt"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" ADD CONSTRAINT "FK_bb4da2747130fd9eeb1bb798512" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" ADD CONSTRAINT "FK_bfa223bac7ccb63b7b950631db7" FOREIGN KEY ("weighing_id") REFERENCES "weighing"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_report" ADD CONSTRAINT "FK_1454e6b3ae23f9e2a0f28509e2b" FOREIGN KEY ("stage_id") REFERENCES "production_stage"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_completion" ADD CONSTRAINT "FK_83f6a036e17780b314de9b20aea" FOREIGN KEY ("stage_id") REFERENCES "production_stage"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_material_contribution" ADD CONSTRAINT "FK_ed362dbc632290e790ba2e34209" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_operation" ADD CONSTRAINT "FK_ff7d937a5fe631e090dcbc9566e" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_payment" ADD CONSTRAINT "FK_363d8fbc99d73055f6d2be82680" FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_dispatch_line" ADD CONSTRAINT "FK_ff9f056145d8202e60193f30757" FOREIGN KEY ("dispatch_id") REFERENCES "sale_dispatch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_dispatch_line" ADD CONSTRAINT "FK_7dab2b14e2d2c5782692243e929" FOREIGN KEY ("finished_good_id") REFERENCES "finished_good"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_adjustment" ADD CONSTRAINT "FK_2489d92af471ebeb119821f0e20" FOREIGN KEY ("weighing_id") REFERENCES "weighing"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_adjustment" ADD CONSTRAINT "FK_92765a52f92b36fea82df8b8177" FOREIGN KEY ("adjusted_by_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_stage_family" ADD CONSTRAINT "FK_95df44af08f81dbfad096cadbb4" FOREIGN KEY ("production_stage_id") REFERENCES "production_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_stage_family" ADD CONSTRAINT "FK_21fbdc8a3ee5303208f1d0e550b" FOREIGN KEY ("product_family_id") REFERENCES "product_family"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_variable_family" ADD CONSTRAINT "FK_62312c3535121a6df06e3b51426" FOREIGN KEY ("technical_variable_id") REFERENCES "technical_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_variable_family" ADD CONSTRAINT "FK_de99123d5aa2192042272fa34a1" FOREIGN KEY ("product_family_id") REFERENCES "product_family"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "technical_variable_family" DROP CONSTRAINT "FK_de99123d5aa2192042272fa34a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_variable_family" DROP CONSTRAINT "FK_62312c3535121a6df06e3b51426"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_stage_family" DROP CONSTRAINT "FK_21fbdc8a3ee5303208f1d0e550b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_stage_family" DROP CONSTRAINT "FK_95df44af08f81dbfad096cadbb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_adjustment" DROP CONSTRAINT "FK_92765a52f92b36fea82df8b8177"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing_adjustment" DROP CONSTRAINT "FK_2489d92af471ebeb119821f0e20"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_dispatch_line" DROP CONSTRAINT "FK_7dab2b14e2d2c5782692243e929"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_dispatch_line" DROP CONSTRAINT "FK_ff9f056145d8202e60193f30757"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_payment" DROP CONSTRAINT "FK_363d8fbc99d73055f6d2be82680"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_operation" DROP CONSTRAINT "FK_ff7d937a5fe631e090dcbc9566e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_material_contribution" DROP CONSTRAINT "FK_ed362dbc632290e790ba2e34209"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stage_completion" DROP CONSTRAINT "FK_83f6a036e17780b314de9b20aea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "progress_report" DROP CONSTRAINT "FK_1454e6b3ae23f9e2a0f28509e2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" DROP CONSTRAINT "FK_bfa223bac7ccb63b7b950631db7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" DROP CONSTRAINT "FK_bb4da2747130fd9eeb1bb798512"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_line" DROP CONSTRAINT "FK_94172cf5d5fdf40f16eb2e549d9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_request" DROP CONSTRAINT "FK_232e4df4d614ae7388c49b48ebe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_request" DROP CONSTRAINT "FK_24be0c242438a97957239f6b097"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" DROP CONSTRAINT "FK_8d54d5478700dcc75a96f9dc557"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" DROP CONSTRAINT "FK_ed03ba28e9025cbf9b41a0a9c56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_good" DROP CONSTRAINT "FK_c9ce5ee9f9689c5b495a86aa6cf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" DROP CONSTRAINT "FK_e0060fda3a4200a3fae87d2e681"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" DROP CONSTRAINT "FK_2781333fc4dc4cf90d2c29a632c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" DROP CONSTRAINT "FK_643c3315df93d44bb6232a49ebc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_line" DROP CONSTRAINT "FK_2c7c2d6d1a8aa03280bee103dab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" DROP CONSTRAINT "FK_f50542ff34b26867444585fc386"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" DROP CONSTRAINT "FK_8ef1a5f8e0cf425e790a35c97f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" DROP CONSTRAINT "FK_b9bcc290f68435856764000ab24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_dispatch" DROP CONSTRAINT "FK_b4e9edbf2b969de0fdadaef81f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" DROP CONSTRAINT "FK_2e19783d0285616e5c2d54e8d07"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" DROP CONSTRAINT "FK_4b3ec89538fe9cfc708953ade8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" DROP CONSTRAINT "FK_f9bb33fdfa4a49eb8a6e5986dc6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" DROP CONSTRAINT "FK_130b82831e13b249618777ce3fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_order" DROP CONSTRAINT "FK_ce05612aefa4b63528b3f39bd5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_material_requirement" DROP CONSTRAINT "FK_3214a0860469554fa1bd96c31eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_material_requirement" DROP CONSTRAINT "FK_9e7d46074b5f0aef284baeddeae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discrepancy" DROP CONSTRAINT "FK_76b55ba6a2f00070f8a7be00a62"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_report" DROP CONSTRAINT "FK_27d5fcf51d2eae8ff133fa7c680"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_file" DROP CONSTRAINT "FK_cbe4e7c1a0cfadf9ee32986812e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "labor_rate" DROP CONSTRAINT "FK_e86a0b505edce47aa3f95841315"`,
    );
    await queryRunner.query(
      `ALTER TABLE "labor_rate" DROP CONSTRAINT "FK_a3d9f212bbd280eb59f8a7dc796"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_affd5000f6b2e7550201d76b711"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_cb0369db9386b23c5adebbf73c8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_70e63319f8ae6ae3c7dd0cbc5c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_1745a1f0289966868c0de620e2c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_16b378b8bb11fe226d4c6a68d95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT "FK_2d5a47ecd4e8e5e609ab5dfc553"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing" DROP CONSTRAINT "FK_d41de1a88aa8ad2f5040fb11e64"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weighing" DROP CONSTRAINT "FK_3e9f15b779d6b8bbc5edb9a7fa9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" DROP CONSTRAINT "FK_97294d0ff4928083b91445f6095"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" DROP CONSTRAINT "FK_ee8677880b11cec8b8a62c70f43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balance" DROP CONSTRAINT "FK_9beb9c9c5b6add4b9e4193fd485"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_lot" DROP CONSTRAINT "FK_5db0dad54ba4c0c9d8f519d90f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_lot" DROP CONSTRAINT "FK_40e21add1ac3919efc02fe74f43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "location" DROP CONSTRAINT "FK_94e2397e21928f8285f1e45306b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "location" DROP CONSTRAINT "FK_4b2ba3a79148522b0b27bd220fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_transaction" DROP CONSTRAINT "FK_8bb112cd57841bc52f5adf0a0f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_transaction" DROP CONSTRAINT "FK_bc9cac3ceab46ae97edf05089a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_sheet" DROP CONSTRAINT "FK_10a6ec2ca5c9da8333d702efad5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "technical_sheet" DROP CONSTRAINT "FK_fa382e057693aeaf2bf30621fe5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_7eabb22ed38459ffc24dc8b415d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" DROP CONSTRAINT "FK_7d22c1b54e1733effebeef88feb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" DROP CONSTRAINT "FK_00b3d05ef2cf349712d4bd2513f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_workshop" DROP CONSTRAINT "FK_7ae623320a0251a205209321f76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_workshop" DROP CONSTRAINT "FK_4d0679b850d3d750e1e507b14d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_c29414eacef0571e86c90476f27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_8feaa8e0119c4749efd738b5688"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" DROP CONSTRAINT "FK_56266c0b808aa2219e5c7d137b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" DROP CONSTRAINT "FK_0d17e86032179041d8348bbf126"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_standard" DROP CONSTRAINT "FK_a4f34d7aba2da5495f58f4a8b85"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant" DROP CONSTRAINT "FK_ca67dd080aac5ecf99609960cd2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material" DROP CONSTRAINT "FK_8e8334ad32e4acd6e5ec458e8ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material" DROP CONSTRAINT "FK_f801cc3914e97d9ba4ba87c5d4d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de99123d5aa2192042272fa34a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_62312c3535121a6df06e3b5142"`,
    );
    await queryRunner.query(`DROP TABLE "technical_variable_family"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_21fbdc8a3ee5303208f1d0e550"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95df44af08f81dbfad096cadbb"`,
    );
    await queryRunner.query(`DROP TABLE "production_stage_family"`);
    await queryRunner.query(`DROP TABLE "document_sequence"`);
    await queryRunner.query(`DROP TABLE "weighing_adjustment"`);
    await queryRunner.query(`DROP TABLE "sale_dispatch_line"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb2ab7ec6f277d0fd32fa9b490"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_25b022670e6dfd1201cb4430cf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_81ec1146dfd45637db651a49fc"`,
    );
    await queryRunner.query(`DROP TABLE "sale_dispatch"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ec1e071aea3b1868f3750a03a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45591a2495c7db7c063f0decb2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f37d2561f9665c4386d9605d03"`,
    );
    await queryRunner.query(`DROP TABLE "customer_payment"`);
    await queryRunner.query(
      `DROP TYPE "public"."customer_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ff7d937a5fe631e090dcbc9566"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2acab1bac3cda15f5b5e653d0a"`,
    );
    await queryRunner.query(`DROP TABLE "customer_operation"`);
    await queryRunner.query(
      `DROP TYPE "public"."customer_operation_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."customer_operation_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe0feb43d38d4c5fc20ae41966"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d2e73834e09d4384b3903cf97"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c63b185deca7f842a2e36c0753"`,
    );
    await queryRunner.query(`DROP TABLE "customer_material_contribution"`);
    await queryRunner.query(
      `DROP TYPE "public"."customer_material_contribution_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."customer_material_contribution_timing_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_851053796aa665d25875ee7d85"`,
    );
    await queryRunner.query(`DROP TABLE "stage_completion"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_73476d55329fa779a4d6937d88"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd3643324e9a791bb886782de3"`,
    );
    await queryRunner.query(`DROP TABLE "quality_check"`);
    await queryRunner.query(`DROP TYPE "public"."quality_check_result_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aaef72dafde98757b2ceabc3de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_23dcc3c0e497d75d5f0b1d06d8"`,
    );
    await queryRunner.query(`DROP TABLE "purity_verification"`);
    await queryRunner.query(
      `DROP TYPE "public"."purity_verification_method_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54744af586a24e566eecf5a01f"`,
    );
    await queryRunner.query(`DROP TABLE "progress_report"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3fdd95015abbe70126a5e202a8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ee4cd879e798eb464bf64bfdd"`,
    );
    await queryRunner.query(`DROP TABLE "production_receipt"`);
    await queryRunner.query(
      `DROP TYPE "public"."production_receipt_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "receipt_line"`);
    await queryRunner.query(`DROP TYPE "public"."receipt_line_line_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ca7d5228cf9dc589b60243933"`,
    );
    await queryRunner.query(`DROP TABLE "order_status_history"`);
    await queryRunner.query(
      `DROP TYPE "public"."order_status_history_to_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."order_status_history_from_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7553216857ac3e6e0c660f5b83"`,
    );
    await queryRunner.query(`DROP TABLE "order_decision"`);
    await queryRunner.query(`DROP TYPE "public"."order_decision_action_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fad173440406f2cff6e32ec90"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_24be0c242438a97957239f6b09"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f44c6a4f41fdc98d7f3674bc3f"`,
    );
    await queryRunner.query(`DROP TABLE "material_request"`);
    await queryRunner.query(
      `DROP TYPE "public"."material_request_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_afe115d6e6d9bfc8019207dc34"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d20c8839c0f756e855d502dd34"`,
    );
    await queryRunner.query(`DROP TABLE "labor_cost"`);
    await queryRunner.query(`DROP TYPE "public"."labor_cost_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."labor_cost_basis_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f562a1174486147bdf9767dc4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f5bc7805e742190e6c553db0b"`,
    );
    await queryRunner.query(`DROP TABLE "finished_good"`);
    await queryRunner.query(
      `DROP TYPE "public"."finished_good_purity_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."finished_good_quality_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."finished_good_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7bda8079eae0373fdfaefe427a"`,
    );
    await queryRunner.query(`DROP TABLE "finished_declaration"`);
    await queryRunner.query(`DROP TABLE "dispatch_line"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b9bcc290f68435856764000ab2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4e9edbf2b969de0fdadaef81f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f95fefb7440bf42fca90b7abe"`,
    );
    await queryRunner.query(`DROP TABLE "material_dispatch"`);
    await queryRunner.query(
      `DROP TYPE "public"."material_dispatch_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_16dcccbacd108ca5cffca7fd85"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f9bb33fdfa4a49eb8a6e5986dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_082cac3ff8e4c06faaaeaee982"`,
    );
    await queryRunner.query(`DROP TABLE "production_order"`);
    await queryRunner.query(
      `DROP TYPE "public"."production_order_priority_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."production_order_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_70d2022dcf56400dbf1897eea6"`,
    );
    await queryRunner.query(`DROP TABLE "order_material_requirement"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0a32f8114cfa522f0a4cf12e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_506259cb21a8523c8455dd3816"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8820be991feddc38c4be12c0a0"`,
    );
    await queryRunner.query(`DROP TABLE "discrepancy"`);
    await queryRunner.query(`DROP TYPE "public"."discrepancy_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."discrepancy_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6967138e7804aef3d5b3a7c5ec"`,
    );
    await queryRunner.query(`DROP TABLE "digital_acceptance"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9f5bb9e6d1432efe12da551f6a"`,
    );
    await queryRunner.query(`DROP TABLE "consumption_report"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_127f6f1acdc95b4ea9888409e6"`,
    );
    await queryRunner.query(`DROP TABLE "story_share"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a6e8c18b1e3484e0838f05fbd8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fae3e3060b50b2998d2a89c73c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5451d661c891babc332b04c3d5"`,
    );
    await queryRunner.query(`DROP TABLE "media_file"`);
    await queryRunner.query(`DROP TYPE "public"."media_file_purpose_enum"`);
    await queryRunner.query(`DROP TYPE "public"."media_file_kind_enum"`);
    await queryRunner.query(`DROP TABLE "technical_variable"`);
    await queryRunner.query(
      `DROP TYPE "public"."technical_variable_data_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "system_parameter"`);
    await queryRunner.query(`DROP TABLE "production_stage"`);
    await queryRunner.query(`DROP TABLE "labor_rate"`);
    await queryRunner.query(`DROP TYPE "public"."labor_rate_basis_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_207e432427be3701420e39daf2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90535904e42b56006f605c3bb8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77aad4e0f7a26adb84b0e56496"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_movement"`);
    await queryRunner.query(
      `DROP TYPE "public"."inventory_movement_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."inventory_movement_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ea95caccab7f07ce6fd23381be"`,
    );
    await queryRunner.query(`DROP TABLE "weighing"`);
    await queryRunner.query(`DROP TYPE "public"."weighing_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."weighing_purpose_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6b5a2330839898d8b98c5c3e9d"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_balance"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d7104e12a6929737df474467f"`,
    );
    await queryRunner.query(`DROP TABLE "material_lot"`);
    await queryRunner.query(`DROP TABLE "location"`);
    await queryRunner.query(`DROP TYPE "public"."location_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."location_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e04c13f290c776ea82987303b"`,
    );
    await queryRunner.query(`DROP TABLE "customer"`);
    await queryRunner.query(`DROP TYPE "public"."customer_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a063c9b04b20d267cdbbb1a22a"`,
    );
    await queryRunner.query(`DROP TABLE "period_close"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ef69844dd2a0a8bf32c8073b4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fb5628d7c3e92114db8ca835d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f4297a70bc58dd73e0a299c71"`,
    );
    await queryRunner.query(`DROP TABLE "financial_transaction"`);
    await queryRunner.query(
      `DROP TYPE "public"."financial_transaction_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."financial_transaction_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."financial_transaction_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "payment_method"`);
    await queryRunner.query(`DROP TABLE "finance_category"`);
    await queryRunner.query(`DROP TYPE "public"."finance_category_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f1daa3e062ee0e7c664379b72"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b11b76951a4756fca4f5b57f12"`,
    );
    await queryRunner.query(`DROP TABLE "cost_entry"`);
    await queryRunner.query(`DROP TYPE "public"."cost_entry_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_523925e24c35dd2c4cfe2b9315"`,
    );
    await queryRunner.query(`DROP TABLE "technical_sheet"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_407cbf7a33b94af93195029996"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0812282fad2e352cdaf83ef0a"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a802f319abf4af2432d629dfe5"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_token"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3fa909d0e37c531ebc23770339"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c480e576dd71729addbc2d51b6"`,
    );
    await queryRunner.query(`DROP TABLE "app_user"`);
    await queryRunner.query(`DROP TABLE "workshop"`);
    await queryRunner.query(`DROP TYPE "public"."workshop_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5470df872eefb26e942b7c6fa"`,
    );
    await queryRunner.query(`DROP TABLE "product_workshop"`);
    await queryRunner.query(`DROP TABLE "product"`);
    await queryRunner.query(`DROP TYPE "public"."product_status_enum"`);
    await queryRunner.query(`DROP TABLE "consumption_standard"`);
    await queryRunner.query(
      `DROP TYPE "public"."consumption_standard_basis_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_02a5514d18fe143425c6800792"`,
    );
    await queryRunner.query(`DROP TABLE "product_variant"`);
    await queryRunner.query(`DROP TYPE "public"."product_variant_status_enum"`);
    await queryRunner.query(`DROP TABLE "material"`);
    await queryRunner.query(`DROP TYPE "public"."material_status_enum"`);
    await queryRunner.query(`DROP TABLE "unit"`);
    await queryRunner.query(`DROP TYPE "public"."unit_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."unit_kind_enum"`);
    await queryRunner.query(`DROP TABLE "material_category"`);
    await queryRunner.query(
      `DROP TYPE "public"."material_category_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "product_family"`);
    await queryRunner.query(`DROP TYPE "public"."product_family_status_enum"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_43fef0ec7f613c19c612fffe62"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb11bd5b662431ea0ac455a27d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cbcf87a54ac23c6294ada82ee"`,
    );
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4daf4209ed6cace5035cbba124"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9fb2a74288f33c00b281b4ba02"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0eaee3b3fe61eb74723fe719ce"`,
    );
    await queryRunner.query(`DROP TABLE "alert"`);
    await queryRunner.query(`DROP TYPE "public"."alert_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."alert_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."alert_type_enum"`);
  }
}
