import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShipments1781200000000 implements MigrationInterface {
  name = 'AddShipments1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shipments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "vendorId" uuid NOT NULL,
        "shippingCost" numeric(10,2) NOT NULL DEFAULT 0,
        "shippingMethodName" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "trackingNumber" character varying,
        "carrier" character varying,
        "address" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_orderId" ON "shipments" ("orderId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_vendorId" ON "shipments" ("vendorId")`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_vendor" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "FK_shipments_vendor"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT IF EXISTS "FK_shipments_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipments"`);
  }
}
