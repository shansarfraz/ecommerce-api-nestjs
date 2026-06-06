import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentsLayer1781300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Store credits
    await queryRunner.query(`
      CREATE TYPE store_credit_type_enum AS ENUM ('earned', 'issued', 'refund', 'adjusted');
    `);
    await queryRunner.query(`
      CREATE TYPE store_credit_status_enum AS ENUM ('active', 'used', 'expired', 'voided');
    `);
    await queryRunner.query(`
      CREATE TABLE store_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        "usedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
        type store_credit_type_enum NOT NULL,
        status store_credit_status_enum NOT NULL DEFAULT 'active',
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        reason TEXT,
        "orderId" UUID,
        "expiresAt" TIMESTAMP,
        "issuedByAdminId" UUID,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_store_credits_user ON store_credits ("userId")`);
    await queryRunner.query(`CREATE INDEX idx_store_credits_status ON store_credits (status)`);

    // Store credit transactions
    await queryRunner.query(`
      CREATE TYPE store_credit_tx_type_enum AS ENUM ('credit', 'debit');
    `);
    await queryRunner.query(`
      CREATE TABLE store_credit_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "creditId" UUID NOT NULL REFERENCES store_credits(id) ON DELETE CASCADE,
        "userId" UUID NOT NULL,
        "txType" store_credit_tx_type_enum NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        "orderId" UUID,
        note TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_sct_user ON store_credit_transactions ("userId")`);
    await queryRunner.query(`CREATE INDEX idx_sct_credit ON store_credit_transactions ("creditId")`);

    // Order adjustments
    await queryRunner.query(`
      CREATE TYPE adjustment_type_enum AS ENUM ('discount', 'surcharge');
    `);
    await queryRunner.query(`
      CREATE TABLE order_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        type adjustment_type_enum NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        label VARCHAR(255) NOT NULL,
        "createdByAdminId" UUID,
        note TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_order_adj_order ON order_adjustments ("orderId")`);

    // Order timeline events
    await queryRunner.query(`
      CREATE TYPE timeline_event_type_enum AS ENUM (
        'status_change', 'note', 'payment', 'shipment',
        'return', 'adjustment', 'store_credit'
      );
    `);
    await queryRunner.query(`
      CREATE TABLE order_timeline_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "eventType" timeline_event_type_enum NOT NULL,
        description TEXT NOT NULL,
        metadata JSONB,
        "actorId" UUID,
        "actorRole" VARCHAR(50),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_timeline_order ON order_timeline_events ("orderId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_timeline_events`);
    await queryRunner.query(`DROP TYPE IF EXISTS timeline_event_type_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_adjustments`);
    await queryRunner.query(`DROP TYPE IF EXISTS adjustment_type_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_credit_transactions`);
    await queryRunner.query(`DROP TYPE IF EXISTS store_credit_tx_type_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_credits`);
    await queryRunner.query(`DROP TYPE IF EXISTS store_credit_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS store_credit_type_enum`);
  }
}
