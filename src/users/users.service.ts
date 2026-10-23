import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dto/create-user.dto';
import { ResponseUserDto } from './dto/response-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(data: CreateUserDto) {
    const existingUser = await this.usersRepository.findByEmail(data.email);

    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }

    const hashedPassword = await hash(data.password, 12);
    const user = await this.usersRepository.create({
      ...data,
      password: hashedPassword,
    });

    if (!user) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }

    return plainToInstance(ResponseUserDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
