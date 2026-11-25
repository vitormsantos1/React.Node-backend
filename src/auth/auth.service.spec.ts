import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { UsersRepository } from 'src/users/users.repository';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

type AnyFn = (...args: any[]) => any;
const fn = () => jest.fn<AnyFn>();

const bcryptMock = bcrypt as unknown as {
  compare: jest.Mock<AnyFn>;
  hash: jest.Mock<AnyFn>;
};

describe('AuthService', () => {
  let service: AuthService;

  const authRepository = {
    findUserByEmail: fn(),
  };

  const usersRepository = {
    findByEmail: fn(),
    updatePassword: fn(),
    updateRefreshToken: fn(),
  };

  const passwordResetTokenRepository = {
    create: fn(),
    findByToken: fn(),
    markAsUsed: fn(),
    invalidateUserTokens: fn(),
  };

  const jwtService = {
    signAsync: fn(),
    verifyAsync: fn(),
  };

  const mailService = {
    sendPasswordRecoveryEmail: fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    name: 'Teste',
    email: 'teste@example.com',
    password: 'hashedPassword',
    role: 'USER',
    hashedRefreshToken: 'hashed-refresh-salvo',
  };

  const payload = {
    sub: mockUser.id,
    email: mockUser.email,
    role: mockUser.role,
  };

  const mensagemRecuperacao =
    'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.';

  const mockEmissaoDeTokens = () => {
    jwtService.signAsync
      .mockResolvedValueOnce('mock-access-token')
      .mockResolvedValueOnce('mock-refresh-token');
    bcryptMock.hash.mockResolvedValue('hashed-refresh');
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: UsersRepository, useValue: usersRepository },
        {
          provide: PasswordResetTokenRepository,
          useValue: passwordResetTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validarAcesso', () => {
    it('deve autenticar, salvar o refresh token e retornar os tokens', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);
      mockEmissaoDeTokens();

      const result = await service.validarAcesso({
        email: mockUser.email,
        password: 'senhaCorreta',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'senhaCorreta',
        mockUser.password,
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, payload, {
        expiresIn: '15m',
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        payload,
        expect.objectContaining({ expiresIn: '7d' }),
      );
      expect(usersRepository.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        'hashed-refresh',
      );
      expect(result).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });

    it('deve lançar UnauthorizedException se o e-mail não existir', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.validarAcesso({
          email: 'inexistente@example.com',
          password: 'senha',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se a senha for incorreta', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.validarAcesso({
          email: mockUser.email,
          password: 'senhaErrada',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('solicitarRecuperacaoSenha', () => {
    it('deve responder com sucesso mesmo se o usuário não for encontrado (anti-enumeração)', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      const result = await service.solicitarRecuperacaoSenha({
        email: 'inexistente@example.com',
      });

      expect(result).toEqual({ message: mensagemRecuperacao });
      expect(
        passwordResetTokenRepository.invalidateUserTokens,
      ).not.toHaveBeenCalled();
      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
      expect(mailService.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
    });

    it('deve invalidar tokens anteriores, criar novo código e enviar o e-mail', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.invalidateUserTokens.mockResolvedValue({
        count: 1,
      });
      passwordResetTokenRepository.create.mockResolvedValue({});
      mailService.sendPasswordRecoveryEmail.mockResolvedValue(undefined);

      const result = await service.solicitarRecuperacaoSenha({
        email: mockUser.email,
      });

      expect(
        passwordResetTokenRepository.invalidateUserTokens,
      ).toHaveBeenCalledWith(mockUser.id);
      expect(passwordResetTokenRepository.create).toHaveBeenCalledTimes(1);

      const [dadosToken] = passwordResetTokenRepository.create.mock
        .calls[0] as [{ userId: string; token: string; expiresAt: Date }];

      expect(dadosToken.userId).toBe(mockUser.id);
      expect(dadosToken.token).toMatch(/^\d{6}$/);
      expect(dadosToken.expiresAt).toBeInstanceOf(Date);
      expect(mailService.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
        mockUser.email,
        dadosToken.token,
      );
      expect(result).toEqual({ message: mensagemRecuperacao });
    });

    it('deve responder com sucesso mesmo se o envio do e-mail falhar', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      passwordResetTokenRepository.create.mockResolvedValue({});
      mailService.sendPasswordRecoveryEmail.mockRejectedValue(
        new Error('Mailjet fora do ar'),
      );

      const result = await service.solicitarRecuperacaoSenha({
        email: mockUser.email,
      });

      expect(result).toEqual({ message: mensagemRecuperacao });
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
        userId: mockUser.id,
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
        userId: mockUser.id,
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
      passwordResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        token: 'token-valido',
        userId: mockUser.id,
        used: false,
        expiresAt: new Date(Date.now() + 60000),
      });
      bcryptMock.hash.mockResolvedValue('novoHash123');
      usersRepository.updatePassword.mockResolvedValue({});
      passwordResetTokenRepository.markAsUsed.mockResolvedValue({});

      const result = await service.redefinirSenha({
        token: 'token-valido',
        password: 'novaSenha123',
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith('novaSenha123', 10);
      expect(usersRepository.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'novoHash123',
      );
      expect(passwordResetTokenRepository.markAsUsed).toHaveBeenCalledWith(
        'token-id',
      );
      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
    });
  });

  describe('logout', () => {
    it('deve remover o refresh token do usuário', async () => {
      usersRepository.updateRefreshToken.mockResolvedValue({});

      const result = await service.logout(mockUser.id);

      expect(usersRepository.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
    });
  });

  describe('refreshTokens', () => {
    it('deve lançar UnauthorizedException se o refresh token não for enviado', async () => {
      await expect(service.refreshTokens('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se o token for inválido ou expirado', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refreshTokens('token-invalido'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se o usuário fez logout (token revogado)', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: null,
      });

      await expect(
        service.refreshTokens('refresh-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se o token não bater com o salvo', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.refreshTokens('refresh-token-antigo'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('deve emitir um novo par de tokens se o refresh token for válido', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);
      mockEmissaoDeTokens();

      const result = await service.refreshTokens('refresh-token');

      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'refresh-token',
        mockUser.hashedRefreshToken,
      );
      expect(usersRepository.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        'hashed-refresh',
      );
      expect(result).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });
  });
});
