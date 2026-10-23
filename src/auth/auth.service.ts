import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';

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

    return { access_token: accessToken };
  }

  async registrar(dadosCadastro: CreateUserDto) {
    const senhaCriptografada = await bcrypt.hash(dadosCadastro.password, 10);

    const novoUsuario = await this.prisma.user.create({
      data: {
        name: dadosCadastro.name,
        email: dadosCadastro.email,
        password: senhaCriptografada,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSemSenha } = novoUsuario;
    return usuarioSemSenha;
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async recuperarSenha(email: string) {
    return { mensagem: 'Instruções enviadas para o e-mail informado.' };
  }
}
