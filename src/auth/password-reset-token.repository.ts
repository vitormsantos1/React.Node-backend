import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { token: string; userId: string; expiresAt: Date }) {
    return this.prisma.passwordResetToken.create({
      data,
    });
  }

  async findByToken(token: string) {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
  }

  async markAsUsed(id: string) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { used: true },
    });
  }

  async invalidateUserTokens(userId: string) {
    return this.prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });
  }
}
