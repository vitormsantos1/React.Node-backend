import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from 'src/users/users.repository';
import { AuthService } from './auth.service';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
  })),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  const usersRepository = {
    findByEmail: jest.fn(),
    updatePassword: jest.fn(),
  };

  const passwordResetTokenRepository = {
    create: jest.fn(),
    findByToken: jest.fn(),
    markAsUsed: jest.fn(),
    invalidateUserTokens: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    name: 'Teste',
    email: 'teste@example.com',
    password: 'hashedPassword',
    role: 'USER',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepository },
        {
          provide: PasswordResetTokenRepository,
          useValue: passwordResetTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validarAcesso', () => {
    it('deve autenticar com sucesso e retornar accessToken', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.validarAcesso({
        email: mockUser.email,
        password: 'senhaCorreta',
      });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'senhaCorreta',
        mockUser.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });

    it('deve lançar UnauthorizedException se o e-mail não existir', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.validarAcesso({
          email: 'inexistente@example.com',
          password: 'senha',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se a senha for incorreta', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validarAcesso({
          email: mockUser.email,
          password: 'senhaErrada',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('solicitarRecuperacaoSenha', () => {
    it('deve responder com sucesso mesmo se o usuário não for encontrado (anti-enumeração)', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      const result = await service.solicitarRecuperacaoSenha({
        email: 'inexistente@example.com',
      });

      expect(result).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      });
      expect(
        passwordResetTokenRepository.invalidateUserTokens,
      ).not.toHaveBeenCalled();
      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    });

    it('deve invalidar tokens anteriores, criar novo token e retornar mensagem de sucesso', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.invalidateUserTokens.mockResolvedValue({
        count: 1,
      });
      passwordResetTokenRepository.create.mockResolvedValue({
        id: 'token-id-1',
        token: 'token-gerado',
        userId: mockUser.id,
        expiresAt: new Date(),
        used: false,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.solicitarRecuperacaoSenha({
        email: mockUser.email,
      });

      expect(
        passwordResetTokenRepository.invalidateUserTokens,
      ).toHaveBeenCalledWith(mockUser.id);
      expect(passwordResetTokenRepository.create).toHaveBeenCalledTimes(1);
      const lastCall = passwordResetTokenRepository.create.mock.calls[0] as [
        { userId: string; token: string; expiresAt: Date },
      ];
      expect(lastCall[0].userId).toBe(mockUser.id);
      expect(typeof lastCall[0].token).toBe('string');
      expect(lastCall[0].expiresAt).toBeInstanceOf(Date);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULAÇÃO DE E-MAIL]'),
      );
      expect(result).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('redefinirSenha', () => {
    it('deve lançar BadRequestException se o token não existir', async () => {
      passwordResetTokenRepository.findByToken.mockResolvedValue(null);

      await expect(
        service.redefinirSenha({
          token: 'token-invalido',
          password: 'novaSenha123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve lançar BadRequestException se o token já foi utilizado', async () => {
      passwordResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        token: 'token-usado',
        userId: 'user-id-123',
        used: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.redefinirSenha({
          token: 'token-usado',
          password: 'novaSenha123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve lançar BadRequestException se o token estiver expirado', async () => {
      passwordResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        token: 'token-expirado',
        userId: 'user-id-123',
        used: false,
        expiresAt: new Date(Date.now() - 60000), // expirou 1 min atrás
      });

      await expect(
        service.redefinirSenha({
          token: 'token-expirado',
          password: 'novaSenha123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve atualizar a senha com hash e marcar o token como utilizado', async () => {
      const validToken = {
        id: 'token-id',
        token: 'token-valido',
        userId: 'user-id-123',
        used: false,
        expiresAt: new Date(Date.now() + 60000),
      };

      passwordResetTokenRepository.findByToken.mockResolvedValue(validToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash123');
      usersRepository.updatePassword.mockResolvedValue({
        ...mockUser,
        password: 'novoHash123',
      });
      passwordResetTokenRepository.markAsUsed.mockResolvedValue({
        ...validToken,
        used: true,
      });

      const result = await service.redefinirSenha({
        token: 'token-valido',
        password: 'novaSenha123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
      expect(usersRepository.updatePassword).toHaveBeenCalledWith(
        'user-id-123',
        'novoHash123',
      );
      expect(passwordResetTokenRepository.markAsUsed).toHaveBeenCalledWith(
        'token-id',
      );
      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
    });
  });
});
