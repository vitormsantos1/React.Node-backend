import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { UsersRepository } from 'src/users/users.repository';
import { AuthRepository } from './auth.repository';
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

describe('AuthService', () => {
  let service: AuthService;

  const authRepository = {
    findUserByEmail: jest.fn(),
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

  const usersRepository = {
    updatePassword: jest.fn(),
  };

  const mailService = {
    sendPasswordRecoveryEmail: jest.fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    name: 'Teste',
    email: 'teste@example.com',
    password: 'hashedPassword',
    role: 'USER',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        {
          provide: PasswordResetTokenRepository,
          useValue: passwordResetTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validarAcesso', () => {
    it('deve autenticar com sucesso e retornar access_token', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.validarAcesso({
        email: mockUser.email,
        password: 'senhaCorreta',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'senhaCorreta',
        mockUser.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({ access_token: 'mock-jwt-token' });
    });

    it('deve lançar UnauthorizedException se o e-mail não existir', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.validarAcesso({
          email: 'inexistente@example.com',
          password: 'senha',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se a senha for incorreta', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
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
      authRepository.findUserByEmail.mockResolvedValue(null);

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
      expect(mailService.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
    });

    it('deve invalidar tokens anteriores, criar código de 6 dígitos e enviar e-mail', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.invalidateUserTokens.mockResolvedValue({
        count: 1,
      });
      passwordResetTokenRepository.create.mockResolvedValue({
        id: 'token-id-1',
        token: '123456',
        userId: mockUser.id,
        expiresAt: new Date(),
        used: false,
      });
      mailService.sendPasswordRecoveryEmail.mockResolvedValue(undefined);

      const result = await service.solicitarRecuperacaoSenha({
        email: mockUser.email,
      });

      expect(
        passwordResetTokenRepository.invalidateUserTokens,
      ).toHaveBeenCalledWith(mockUser.id);
      expect(passwordResetTokenRepository.create).toHaveBeenCalledTimes(1);

      const [createdPayload] = passwordResetTokenRepository.create.mock
        .calls[0] as [{ userId: string; token: string; expiresAt: Date }];
      expect(createdPayload.userId).toBe(mockUser.id);
      expect(createdPayload.token).toMatch(/^\d{6}$/);
      expect(createdPayload.expiresAt).toBeInstanceOf(Date);

      expect(mailService.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
        mockUser.email,
        createdPayload.token,
      );
      expect(result).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      });
    });

    it('deve registrar erro no logger mas manter a resposta genérica se o envio de e-mail falhar', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.invalidateUserTokens.mockResolvedValue({
        count: 0,
      });
      passwordResetTokenRepository.create.mockResolvedValue({});
      mailService.sendPasswordRecoveryEmail.mockRejectedValue(
        new Error('Falha no Mailjet'),
      );

      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.solicitarRecuperacaoSenha({
        email: mockUser.email,
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        'Falha ao enviar e-mail de recuperação de senha.',
      );
      expect(result).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      });

      loggerSpy.mockRestore();
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
        expiresAt: new Date(Date.now() - 60000),
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