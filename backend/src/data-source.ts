import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST || "127.0.0.1",
  port: parseInt(process.env.DATABASE_PORT || "3306", 10),
  username: process.env.DATABASE_USER || "epms_app_user",
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || "epms_tvmubd_db",
  entities: [path.join(__dirname, "entities/**/*.entity{.ts,.js}")],
  migrations: [path.join(__dirname, "migrations/*{.ts,.js}")],
  synchronize: false,
  logging: true,
});

export default AppDataSource;
