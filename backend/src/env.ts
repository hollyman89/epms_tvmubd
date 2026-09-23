import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log('ENV LOADED from:', envPath, 'USER:', process.env.DATABASE_USER);
