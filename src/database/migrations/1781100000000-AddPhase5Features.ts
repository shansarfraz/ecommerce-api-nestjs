import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase5Features1781100000000 implements MigrationInterface {
  name = 'AddPhase5Features1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User: Google OAuth + Stripe customer
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_googleId" ON "users" ("googleId") WHERE "googleId" IS NOT NULL`);

    // Saved payment methods
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "providerMethodId" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'card',
        "details" jsonb,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_payment_methods" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_saved_methods_userId" ON "saved_payment_methods" ("userId")`);
    await queryRunner.query(`ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "FK_saved_methods_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "saved_payment_methods" DROP CONSTRAINT IF EXISTS "FK_saved_methods_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_payment_methods"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripeCustomerId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`);
  }
}
