import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

import { AuthRepository } from './auth.repository';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersRepository } from 'src/users/users.repository';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly jwtService: JwtService,
    private readonly userRepository: UsersRepository,
    private readonly mailService: MailService,
  ) {}

  async validarAcesso(credenciais: LoginDto) {
    const usuario = await this.authRepository.findUserByEmail(
      credenciais.email,
    );

    if (!usuario) {
      throw new UnauthorizedException('E-mail e/ou senha incorretos.');
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

  async solicitarRecuperacaoSenha(dto: ForgotPasswordDto) {
    const usuario = await this.authRepository.findUserByEmail(dto.email);

    if (!usuario) {
      return {
        message:
          'Se o e-mail informado estiver cadastrado, você receberá as instruções para recuperação de senha.',
      };
    }

    await this.passwordResetTokenRepository.invalidateUserTokens(usuario.id);

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.passwordResetTokenRepository.create({
      token: code,
      userId: usuario.id,
      expiresAt,
    });

    try {
      await this.mailService.sendPasswordRecoveryEmail(dto.email, code);
    } catch {
      this.logger.error('Falha ao enviar e-mail de recuperação de senha.');
    }

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

    await this.userRepository.updatePassword(resetToken.userId, hashedPassword);

    await this.passwordResetTokenRepository.markAsUsed(resetToken.id);

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }
}
