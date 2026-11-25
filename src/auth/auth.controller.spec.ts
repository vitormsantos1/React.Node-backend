import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/auth.guard';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class {},
}));

type AnyFn = (...args: any[]) => any;
const fn = () => jest.fn<AnyFn>();

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    validarAcesso: fn(),
    solicitarRecuperacaoSenha: fn(),
    redefinirSenha: fn(),
    logout: fn(),
    refreshTokens: fn(),
  };

  const tokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('fazerlogin', () => {
    it('deve chamar validarAcesso com as credenciais e retornar os tokens', async () => {
      const credenciais = { email: 'teste@example.com', password: 'senha123' };
      authService.validarAcesso.mockResolvedValue(tokens);

      const result = await controller.fazerlogin(credenciais);

      expect(authService.validarAcesso).toHaveBeenCalledWith(credenciais);
      expect(result).toEqual(tokens);
    });

    it('deve propagar UnauthorizedException quando as credenciais forem inválidas', async () => {
      authService.validarAcesso.mockRejectedValue(
        new UnauthorizedException('E-mail e/ou senha incorretos.'),
      );

      await expect(
        controller.fazerlogin({
          email: 'teste@example.com',
          password: 'senhaErrada',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('solicitarRecuperacao', () => {
    it('deve chamar solicitarRecuperacaoSenha e retornar a mensagem', async () => {
      const dto = { email: 'teste@example.com' };
      const resposta = {
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      };
      authService.solicitarRecuperacaoSenha.mockResolvedValue(resposta);

      const result = await controller.solicitarRecuperacao(dto);

      expect(authService.solicitarRecuperacaoSenha).toHaveBeenCalledWith(dto);
      expect(result).toEqual(resposta);
    });
  });

  describe('redefinirSenha', () => {
    it('deve chamar redefinirSenha e retornar a mensagem de sucesso', async () => {
      const dto = { token: '123456', password: 'novaSenha123' };
      const resposta = { message: 'Senha redefinida com sucesso.' };
      authService.redefinirSenha.mockResolvedValue(resposta);

      const result = await controller.redefinirSenha(dto);

      expect(authService.redefinirSenha).toHaveBeenCalledWith(dto);
      expect(result).toEqual(resposta);
    });

    it('deve propagar BadRequestException quando o token for inválido', async () => {
      authService.redefinirSenha.mockRejectedValue(
        new BadRequestException('Token inválido ou expirado.'),
      );

      await expect(
        controller.redefinirSenha({
          token: '000000',
          password: 'novaSenha123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('logout', () => {
    it('deve chamar logout com o id do usuário autenticado', async () => {
      const resposta = { message: 'Logout realizado com sucesso.' };
      authService.logout.mockResolvedValue(resposta);

      const result = await controller.logout({ user: { id: 'user-id-123' } });

      expect(authService.logout).toHaveBeenCalledWith('user-id-123');
      expect(result).toEqual(resposta);
    });
  });

  describe('refreshTokens', () => {
    it('deve chamar refreshTokens com o refresh token do body', async () => {
      authService.refreshTokens.mockResolvedValue(tokens);

      const result = await controller.refreshTokens({
        refreshToken: 'refresh-token',
      });

      expect(authService.refreshTokens).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(tokens);
    });

    it('deve propagar UnauthorizedException quando o refresh token for inválido', async () => {
      authService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Refresh token inválido ou expirado.'),
      );

      await expect(
        controller.refreshTokens({ refreshToken: 'token-invalido' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
