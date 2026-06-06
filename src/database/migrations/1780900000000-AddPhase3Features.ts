import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase3Features1780900000000 implements MigrationInterface {
  name = 'AddPhase3Features1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Return requests table
    await queryRunner.query(`
      CREATE TYPE "public"."return_requests_status_enum" AS ENUM('requested','approved','rejected','completed')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "return_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "requestedById" uuid NOT NULL,
        "status" "public"."return_requests_status_enum" NOT NULL DEFAULT 'requested',
        "reason" text NOT NULL,
        "adminNotes" text,
        "refundAmount" numeric(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_return_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_return_requests_orderId" ON "return_requests" ("orderId")`);
    await queryRunner.query(`ALTER TABLE "return_requests" ADD CONSTRAINT "FK_return_orders" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "return_requests" ADD CONSTRAINT "FK_return_users" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    // Guest checkout: guestEmail on orders
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestEmail" character varying`);

    // Full-text search index on products
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_fts" ON "products"
      USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_fts"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "guestEmail"`);
    await queryRunner.query(`ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "FK_return_users"`);
    await queryRunner.query(`ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "FK_return_orders"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_return_requests_orderId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."return_requests_status_enum"`);
  }
}
