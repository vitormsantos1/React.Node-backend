import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validarAcesso(credenciais: LoginDto) {
    const usuario = await this.prisma.user.findUnique({
      where: { email: credenciais.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('e-mail e/ou senha incorretos.');
    }

    const senhaValida = await bcrypt.compare(
      credenciais.password,
      usuario.password,
    );

    if (!senhaValida) {
      throw new UnauthorizedException('E-mail e/ou senha incorretos.');
    }

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
