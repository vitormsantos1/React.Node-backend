import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { updateUserDto } from './dto/update-user.dto';
import { UserPayload, UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class {},
}));

type AnyFn = (...args: any[]) => any;
const fn = () => jest.fn<AnyFn>();

type AuthRequest = Request & { user: UserPayload };
const makeReq = (user: UserPayload) => ({ user }) as AuthRequest;

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    create: fn(),
    updateUser: fn(),
    getUsers: fn(),
    findOne: fn(),
    remove: fn(),
  };

  const userLogado: UserPayload = {
    id: 'user-id-123',
    email: 'teste@example.com',
    role: 'USER',
  };

  const usuario = {
    id: 'user-id-123',
    name: 'Teste',
    email: 'teste@example.com',
    role: 'USER',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('me', () => {
    it('deve retornar apenas id, email e role do usuário autenticado', () => {
      const req = makeReq({
        ...userLogado,
        hashedRefreshToken: 'nao-deve-vazar',
      } as UserPayload);

      const result = controller.me(req);

      expect(result).toEqual(userLogado);
    });
  });

  describe('create', () => {
    it('deve chamar create com o DTO e retornar o usuário criado', async () => {
      const dto = {
        name: 'Teste',
        email: 'teste@example.com',
        password: 'senha123',
      };
      usersService.create.mockResolvedValue(usuario);

      const result = await controller.create(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(usuario);
    });

    it('deve propagar ConflictException quando o e-mail já existir', async () => {
      usersService.create.mockRejectedValue(
        new ConflictException('Já existe um usuário com este e-mail'),
      );

      await expect(
        controller.create({ email: 'teste@example.com' } as CreateUserDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateUser', () => {
    it('deve chamar updateUser com id, DTO e usuário autenticado', async () => {
      const dto = { name: 'Novo Nome' } as updateUserDto;
      usersService.updateUser.mockResolvedValue({
        ...usuario,
        name: 'Novo Nome',
      });

      const result = await controller.updateUser(
        makeReq(userLogado),
        'user-id-123',
        dto,
      );

      expect(usersService.updateUser).toHaveBeenCalledWith(
        'user-id-123',
        dto,
        userLogado,
      );
      expect(result).toEqual({ ...usuario, name: 'Novo Nome' });
    });

    it('deve propagar NotFoundException quando o usuário não existir', async () => {
      usersService.updateUser.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.updateUser(makeReq(userLogado), 'id-inexistente', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getUsers', () => {
    it('deve retornar a lista de usuários', async () => {
      usersService.getUsers.mockResolvedValue([usuario]);

      const result = await controller.getUsers();

      expect(usersService.getUsers).toHaveBeenCalled();
      expect(result).toEqual([usuario]);
    });
  });

  describe('findOne', () => {
    it('deve chamar findOne com id e usuário autenticado', async () => {
      usersService.findOne.mockResolvedValue(usuario);

      const result = await controller.findOne(
        makeReq(userLogado),
        'user-id-123',
      );

      expect(usersService.findOne).toHaveBeenCalledWith(
        'user-id-123',
        userLogado,
      );
      expect(result).toEqual(usuario);
    });

    it('deve propagar NotFoundException quando o usuário não existir', async () => {
      usersService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.findOne(makeReq(userLogado), 'id-inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve chamar remove com id e usuário autenticado', async () => {
      usersService.remove.mockResolvedValue(usuario);

      const result = await controller.remove(
        makeReq(userLogado),
        'user-id-123',
      );

      expect(usersService.remove).toHaveBeenCalledWith(
        'user-id-123',
        userLogado,
      );
      expect(result).toEqual(usuario);
    });
  });
});
