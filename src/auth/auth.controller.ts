import { Controller, Body, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('cadastro')
  async criarConta(@Body() dadosCadastro: CreateUserDto) {
    return await this.authService.registrar(dadosCadastro);
  }

  @Post('login')
  async fazerlogin(@Body() credenciais: LoginDto) {
    return await this.authService.validarAcesso(credenciais);
  }

  @Post('esqueci-minha-senha')
  async solicitarRecuperacao(@Body('email') email: string) {
    return await this.authService.recuperarSenha(email);
  }
}
