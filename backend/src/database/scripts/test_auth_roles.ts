import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { AuthService } from '../../modules/auth/auth.service';

async function testAuth() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  const testAccounts = [
    { email: 'pm@tvmubd.com', pass: '123456', expectedRole: 'PROJECT_MANAGER' },
    { email: 'gm@tvmubd.com', pass: '123456', expectedRole: 'GENERAL_MANAGER' },
    { email: 'procurement@tvmubd.com', pass: '123456', expectedRole: 'PROCUREMENT' },
    { email: 'finance@tvmubd.com', pass: '123456', expectedRole: 'FINANCE' },
    { email: 'director@tvmubd.com', pass: '123456', expectedRole: 'DIRECTOR' },
    { email: 'marketing@tvmubd.com', pass: '123456', expectedRole: 'MARKETING' },
    { email: 'legal@epms.com', pass: '123456', expectedRole: 'LEGAL' },
    { email: 'manager@epms.com', pass: '123456', expectedRole: 'MANAGER' },
    { email: 'director@epms.com', pass: '123456', expectedRole: 'DIRECTOR' },
  ];

  console.log('=== AUTHENTICATION & JWT VERIFICATION ===');
  for (const acc of testAccounts) {
    try {
      const user = await authService.validateUser(acc.email, acc.pass);
      if (!user) {
        console.log(`[${acc.email}] ValidateUser failed (null user)`);
        continue;
      }
      const loginRes = await authService.login(user, '127.0.0.1', 'TestRunner/1.0');
      const tokenPayload = loginRes.user;
      const rolesMatch = tokenPayload.roles.includes(acc.expectedRole);
      console.log(`[${acc.email}] Expected: ${acc.expectedRole} | Actual Roles in JWT: [${tokenPayload.roles.join(', ')}] | Permissions count: ${tokenPayload.permissions.length}`);
    } catch (err: any) {
      console.log(`[${acc.email}] Login failed: ${err.message}`);
    }
  }

  await app.close();
}

testAuth();
