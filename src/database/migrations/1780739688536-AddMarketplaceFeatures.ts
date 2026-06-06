import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketplaceFeatures1780739688536 implements MigrationInterface {
    name = 'AddMarketplaceFeatures1780739688536'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" character varying NOT NULL, "template" character varying NOT NULL, "toAddress" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'sent', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f761cfbbd064e0f326960877d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7b6f554b394c2bc45cde64e11b" ON "notification_log" ("channel", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "tax_zones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country" character varying(2) NOT NULL, "state" character varying, "name" character varying NOT NULL, "rate" numeric(6,4) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_296c319803beb55a548f4bb0a20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_611e358b777a96089cc408979c" ON "tax_zones" ("country", "state") `);
        await queryRunner.query(`CREATE TYPE "public"."shipping_methods_calculator_enum" AS ENUM('flat', 'per_item', 'free_over')`);
        await queryRunner.query(`CREATE TABLE "shipping_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendorId" uuid, "name" character varying NOT NULL, "calculator" "public"."shipping_methods_calculator_enum" NOT NULL, "baseAmount" numeric(10,2) NOT NULL, "freeOverSubtotal" numeric(10,2) NOT NULL DEFAULT '0', "countries" text array NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5bee9dd62a8b72d6d9caabd63cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ddfd7ff9795a3d2a1a15350612" ON "shipping_methods" ("vendorId", "isActive") `);
        await queryRunner.query(`CREATE TYPE "public"."promotions_type_enum" AS ENUM('percent', 'fixed', 'free_shipping')`);
        await queryRunner.query(`CREATE TYPE "public"."promotions_status_enum" AS ENUM('active', 'disabled')`);
        await queryRunner.query(`CREATE TABLE "promotions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "type" "public"."promotions_type_enum" NOT NULL, "value" numeric(10,2) NOT NULL DEFAULT '0', "minOrderSubtotal" numeric(10,2) NOT NULL DEFAULT '0', "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT '0', "perUserLimit" integer, "startsAt" TIMESTAMP WITH TIME ZONE, "endsAt" TIMESTAMP WITH TIME ZONE, "vendorId" uuid, "status" "public"."promotions_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_380cecbbe3ac11f0e5a7c452c34" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ab10e580f70c3d2e2e4b31ebf" ON "promotions" ("code") `);
        await queryRunner.query(`CREATE TABLE "promotion_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "promotionId" uuid NOT NULL, "userId" uuid NOT NULL, "orderId" uuid NOT NULL, "discountAmount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_17e98da71097f78ff330df148f7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_23dfe92cd6846732619687d237" ON "promotion_redemptions" ("promotionId", "userId") `);
        await queryRunner.query(`CREATE TYPE "public"."commission_entries_status_enum" AS ENUM('pending', 'available', 'paid', 'reversed')`);
        await queryRunner.query(`CREATE TABLE "commission_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendorId" uuid NOT NULL, "orderId" uuid NOT NULL, "orderItemId" uuid NOT NULL, "grossAmount" numeric(10,2) NOT NULL, "commissionRate" numeric(5,2) NOT NULL, "commissionAmount" numeric(10,2) NOT NULL, "netAmount" numeric(10,2) NOT NULL, "status" "public"."commission_entries_status_enum" NOT NULL DEFAULT 'pending', "payoutId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_35b5372834c1af9e381d1bd2f97" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_81103516f5bf44fd8589f50f1a" ON "commission_entries" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2504bb795062c518a7b206cc4" ON "commission_entries" ("vendorId", "status") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD "providerIntentId" character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "refundedAmount" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."payments_status_enum" RENAME TO "payments_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" TYPE "public"."payments_status_enum" USING "status"::"text"::"public"."payments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_e15b831e2febeec51538470de2" ON "payments" ("providerIntentId") `);
        await queryRunner.query(`ALTER TABLE "shipping_methods" ADD CONSTRAINT "FK_0c237c8afad1c72b9035acc0c45" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "FK_b6fe6571338dcc58ad782a14a83" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "FK_5695a542b7477ef875553598e55" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "FK_eb85a339708ce0f0cb4ca55c59d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_aa315b2d5974e96b1fa68e374af" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_81103516f5bf44fd8589f50f1af" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_46fab37f16724ff545bab4907b0" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_46fab37f16724ff545bab4907b0"`);
        await queryRunner.query(`ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_81103516f5bf44fd8589f50f1af"`);
        await queryRunner.query(`ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_aa315b2d5974e96b1fa68e374af"`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" DROP CONSTRAINT "FK_eb85a339708ce0f0cb4ca55c59d"`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" DROP CONSTRAINT "FK_5695a542b7477ef875553598e55"`);
        await queryRunner.query(`ALTER TABLE "promotion_redemptions" DROP CONSTRAINT "FK_b6fe6571338dcc58ad782a14a83"`);
        await queryRunner.query(`ALTER TABLE "shipping_methods" DROP CONSTRAINT "FK_0c237c8afad1c72b9035acc0c45"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e15b831e2febeec51538470de2"`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum_old" AS ENUM('pending', 'completed', 'failed', 'refunded')`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" TYPE "public"."payments_status_enum_old" USING "status"::"text"::"public"."payments_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payments_status_enum_old" RENAME TO "payments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "refundedAmount"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "providerIntentId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2504bb795062c518a7b206cc4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81103516f5bf44fd8589f50f1a"`);
        await queryRunner.query(`DROP TABLE "commission_entries"`);
        await queryRunner.query(`DROP TYPE "public"."commission_entries_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_23dfe92cd6846732619687d237"`);
        await queryRunner.query(`DROP TABLE "promotion_redemptions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ab10e580f70c3d2e2e4b31ebf"`);
        await queryRunner.query(`DROP TABLE "promotions"`);
        await queryRunner.query(`DROP TYPE "public"."promotions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."promotions_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddfd7ff9795a3d2a1a15350612"`);
        await queryRunner.query(`DROP TABLE "shipping_methods"`);
        await queryRunner.query(`DROP TYPE "public"."shipping_methods_calculator_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_611e358b777a96089cc408979c"`);
        await queryRunner.query(`DROP TABLE "tax_zones"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b6f554b394c2bc45cde64e11b"`);
        await queryRunner.query(`DROP TABLE "notification_log"`);
    }

}
