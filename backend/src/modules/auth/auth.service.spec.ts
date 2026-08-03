import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService Cookie & Token Security', () => {
  let service: AuthService;
  let userRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return access and refresh token on valid login with device fingerprinting', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        fullName: 'Test User',
        roles: [{ name: 'ADMIN' }]
      };

      jwtService.sign.mockReturnValueOnce('mocked_access_token');
      jwtService.sign.mockReturnValueOnce('mocked_refresh_token');

      userRepository.findOne.mockResolvedValueOnce(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed_refresh_token');

      const result = await service.login(mockUser, '127.0.0.1', 'jest-agent');

      expect(result).toHaveProperty('accessToken', 'mocked_access_token');
      expect(result).toHaveProperty('refreshToken', 'mocked_refresh_token');
      expect(result).toHaveProperty('user');
      expect(userRepository.save).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should return new rotated tokens if refresh token is valid', async () => {
      const fingerprint = service.generateDeviceFingerprint('127.0.0.1', 'jest-agent');
      const mockPayload = { sub: 1, fingerprint };
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        refreshToken: 'hashed_refresh_token',
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      jwtService.sign.mockReturnValueOnce('new_access_token');
      jwtService.sign.mockReturnValueOnce('new_refresh_token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_refresh_token');

      const result = await service.refreshToken('old_refresh_token', '127.0.0.1', 'jest-agent');

      expect(result).toHaveProperty('accessToken', 'new_access_token');
      expect(result).toHaveProperty('refreshToken', 'new_refresh_token');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found or session revoked', async () => {
      jwtService.verify.mockReturnValue({ sub: 1 });
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('token', '127.0.0.1', 'jest-agent')).rejects.toThrow(UnauthorizedException);
    });
  });
});
