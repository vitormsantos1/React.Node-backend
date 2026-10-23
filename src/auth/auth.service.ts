import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersRepository } from 'src/users/users.repository';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validarAcesso(credenciais: LoginDto) {
    const usuario = await this.usersRepository.findByEmail(credenciais.email);

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
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async solicitarRecuperacaoSenha(dto: ForgotPasswordDto) {
    const usuario = await this.usersRepository.findByEmail(dto.email);

    if (!usuario) {
      return {
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      };
    }

    await this.passwordResetTokenRepository.invalidateUserTokens(usuario.id);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.passwordResetTokenRepository.create({
      token,
      userId: usuario.id,
      expiresAt,
    });

    console.log(
      `[SIMULAÇÃO DE E-MAIL] Para: ${usuario.email} | Token de recuperação: ${token}`,
    );

    return {
      message:
        'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
    };
  }

  async redefinirSenha(dto: ResetPasswordDto) {
    const resetToken = await this.passwordResetTokenRepository.findByToken(
      dto.token,
    );

    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.usersRepository.updatePassword(
      resetToken.userId,
      hashedPassword,
    );

    await this.passwordResetTokenRepository.markAsUsed(resetToken.id);

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }
}
