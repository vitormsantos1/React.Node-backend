import { Controller, Body, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('login')
  async fazerlogin(@Body() credenciais: LoginDto) {
    return await this.authService.validarAcesso(credenciais);
  }
}
