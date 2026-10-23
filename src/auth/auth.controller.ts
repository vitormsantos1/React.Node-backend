import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Realiza login na aplicação' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async fazerlogin(@Body() credenciais: LoginDto) {
    return this.authService.validarAcesso(credenciais);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicita recuperação de senha e gera token de redefinição',
  })
  @ApiResponse({
    status: 200,
    description: 'Instruções de recuperação enviadas se o e-mail existir',
  })
  async solicitarRecuperacao(@Body() dto: ForgotPasswordDto) {
    return this.authService.solicitarRecuperacaoSenha(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefine a senha com base em um token válido' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso' })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado' })
  async redefinirSenha(@Body() dto: ResetPasswordDto) {
    return this.authService.redefinirSenha(dto);
  }
}
