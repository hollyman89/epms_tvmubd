"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log('✅ ENV LOADED from:', envPath, 'USER:', process.env.DATABASE_USER);
//# sourceMappingURL=env.js.map