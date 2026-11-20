import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiResponseProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { updateUserDto } from './dto/update-user.dto';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: UserPayload }) {
    const { id, email, role } = req.user;
    return { id, email, role };
  }

  @Post()
  @ApiResponseProperty()
  @ApiConflictResponse({ description: 'Já existe um usuário com este e-mail' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiResponseProperty()
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Usuário não autorizado' })
  @UseGuards(JwtAuthGuard)
  updateUser(
    @Req() req: Request & { user: UserPayload },
    @Param('id') id: string,
    @Body() updateUserDto: updateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Usuário não autorizado' })
  findOne(
    @Req() req: Request & { user: UserPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(id, req.user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiResponseProperty()
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Usuário não autorizado' })
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: Request & { user: UserPayload }, @Param('id') id: string) {
    return this.usersService.remove(id, req.user);
  }
}
