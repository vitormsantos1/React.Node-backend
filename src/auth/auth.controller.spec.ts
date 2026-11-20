import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
  })),
}));

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    validarAcesso: jest.fn(),
    solicitarRecuperacaoSenha: jest.fn(),
    redefinirSenha: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('fazerlogin', () => {
    const credenciais: LoginDto = {
      email: 'teste@example.com',
      password: 'senha',
    };

    it('repassa as credenciais ao service e retorna o access_token', async () => {
      authService.validarAcesso.mockResolvedValue({
        access_token: 'mock-jwt-token',
      });

      const result = await controller.fazerlogin(credenciais);

      expect(authService.validarAcesso).toHaveBeenCalledWith(credenciais);
      expect(result).toEqual({ access_token: 'mock-jwt-token' });
    });

    it('propaga UnauthorizedException quando as credenciais são inválidas', async () => {
      authService.validarAcesso.mockRejectedValue(
        new UnauthorizedException('E-mail e/ou senha incorretos.'),
      );

      await expect(controller.fazerlogin(credenciais)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('solicitarRecuperacao', () => {
    const dto: ForgotPasswordDto = { email: 'teste@example.com' };

    it('repassa o e-mail ao service e retorna a mensagem de confirmação', async () => {
      const response = {
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      };
      authService.solicitarRecuperacaoSenha.mockResolvedValue(response);

      const result = await controller.solicitarRecuperacao(dto);

      expect(authService.solicitarRecuperacaoSenha).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('redefinirSenha', () => {
    const dto: ResetPasswordDto = {
      token: '123456',
      password: 'novaSenha123',
    };

    it('repassa o token e a nova senha ao service e retorna sucesso', async () => {
      const response = { message: 'Senha redefinida com sucesso.' };
      authService.redefinirSenha.mockResolvedValue(response);

      const result = await controller.redefinirSenha(dto);

      expect(authService.redefinirSenha).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });

    it('propaga BadRequestException quando o token é inválido ou expirado', async () => {
      authService.redefinirSenha.mockRejectedValue(
        new BadRequestException('Token inválido ou expirado.'),
      );

      await expect(controller.redefinirSenha(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});