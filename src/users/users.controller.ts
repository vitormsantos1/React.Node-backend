import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiConflictResponse, ApiResponseProperty } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiResponseProperty()
  @ApiConflictResponse({ description: 'Já existe um usuário com este e-mail' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(AuthGuard)
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }
  
  @UseGuards(AuthGuard)
  @Get('meu-perfil')
 async buscarPerfil(@Request() req) {
   const idDoUsuario = req.user.sub || req.user.id;
   const perfilCompleto = await this.usersService.findOne(idDoUsuario);

   if (perfilCompleto && perfilCompleto.password) {
      delete perfilCompleto.password;
    }
   
    return {
      mensagem: 'Acesso autorizado ao perfil',
      perfil: perfilCompleto,
    };
  }
}
