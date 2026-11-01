import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiConflictResponse, ApiResponseProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiResponseProperty()
  @ApiConflictResponse({ description: 'Já existe um usuário com este e-mail' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }
}
