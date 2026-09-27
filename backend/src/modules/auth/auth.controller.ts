import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UnauthorizedException,
  UseGuards,
  Request,
  Response,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserSessionService } from './user-session.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth & Cookie Security')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userSessionService: UserSessionService,
  ) {}

  /**
   * Helper to set HttpOnly, Secure, SameSite=Strict Cookie
   */
  private setRefreshTokenCookie(res: any, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
    });
  }

  /**
   * Helper to clear Refresh Token Cookie on Logout
   */
  private clearRefreshTokenCookie(res: any) {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: 0,
      expires: new Date(0),
    };
    res.cookie('refresh_token', '', { ...cookieOpts, path: '/api/v1/auth' });
    res.cookie('refresh_token', '', { ...cookieOpts, path: '/' });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive Access Token (15m) + HttpOnly Refresh Token Cookie (7d)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
  ) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Login gagal. Periksa kembali email dan password Anda.');
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(user, ipAddress, userAgent);

    // Set HttpOnly, Secure, SameSite=Strict Cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate Refresh Token Cookie and receive NEW Access Token (Rate Limited max 5 req/min)' })
  @ApiResponse({ status: 200, description: 'Token refreshed and rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'] || req.body?.refreshToken;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing!');
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.refreshToken(rawRefreshToken, ipAddress, userAgent);

    // Rotate Cookie with NEW Refresh Token
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      statusCode: HttpStatus.OK,
      message: 'Token refreshed and rotated successfully',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout, invalidate session in DB, and clear HttpOnly Refresh Token Cookie' })
  async logout(
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'] || req.body?.refreshToken;
    const userId = req.user?.sub || req.user?.userId;
    await this.authService.logout(userId, rawRefreshToken);

    // Clear Refresh Token Cookie
    this.clearRefreshTokenCookie(res);

    return {
      statusCode: HttpStatus.OK,
      message: 'Logout successful and session invalidated.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req: any, @Body() updateDto: UpdateProfileDto) {
    try {
      const userId = req.user?.sub || req.user?.userId;
      const result = await this.authService.updateProfile(userId, updateDto);
      return {
        message: 'Profile updated successfully',
        data: result,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List all active multi-device sessions for logged in user' })
  async getActiveSessions(@Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const sessions = await this.userSessionService.getUserActiveSessions(userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Active sessions retrieved successfully',
      data: sessions,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke specific device session by session ID' })
  async revokeSession(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.userSessionService.revokeSession(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/all-others')
  @ApiOperation({ summary: 'Revoke all other active sessions (e.g. on password change)' })
  async revokeAllOtherSessions(@Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.userSessionService.revokeAllOtherSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sessions/force-logout')
  @ApiOperation({ summary: 'Force logout all sessions for current user' })
  async forceLogoutAllSessions(@Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.userSessionService.forceLogoutAllSessions(userId);
  }
}
