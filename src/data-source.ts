import 'dotenv/config';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/database/migrations/*.{ts,js}'],
});

export default AppDataSource;
