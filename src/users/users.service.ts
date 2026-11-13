import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { hash } from 'bcrypt';
import { plainToInstance } from 'class-transformer';

import { CreateUserDto } from './dto/create-user.dto';
import { ResponseUserDto } from './dto/response-user.dto';
import { UsersRepository } from './users.repository';
import { updateUserDto } from './dto/update-user.dto';

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

  async updateUser(id: string, data: updateUserDto) {
    if (!(await this.usersRepository.findById(id))) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const newUser = await this.usersRepository.update(id, data);
    return plainToInstance(ResponseUserDto, newUser, {
      excludeExtraneousValues: true,
    });
  }

  async getUsers() {
    return await this.usersRepository.getAllUsers();
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return plainToInstance(ResponseUserDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
