import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase2Features1780800000000 implements MigrationInterface {
  name = 'AddPhase2Features1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Order: idempotency key + human-readable number
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" character varying`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderNumber" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_idempotency" ON "orders" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_orderNumber" ON "orders" ("orderNumber")`);

    // Users: email verification
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_orderNumber"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_idempotency"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "orderNumber"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyKey"`);
  }
}
