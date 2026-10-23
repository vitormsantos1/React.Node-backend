import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token recebido para redefinição de senha',
    example: 'd9b7f5e8c1a243b68f9e1234567890abcdef',
  })
  @IsString({ message: 'O token deve ser uma string' })
  @IsNotEmpty({ message: 'O token não pode estar vazio' })
  token!: string;

  @ApiProperty({
    description: 'Nova senha do usuário',
    example: '123456',
  })
  @IsString({ message: 'A nova senha deve ser uma string' })
  @IsNotEmpty({ message: 'A nova senha não pode estar vazia' })
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres' })
  password!: string;
}
