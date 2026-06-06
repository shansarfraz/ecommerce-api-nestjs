import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase4Features1781000000000 implements MigrationInterface {
  name = 'AddPhase4Features1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Vendor: Stripe Connect account ID
    await queryRunner.query(`ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "stripeAccountId" character varying`);

    // User: login lockout
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "lockedUntil"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failedLoginAttempts"`);
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN IF EXISTS "stripeAccountId"`);
  }
}
