import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { updateUserDto } from './dto/update-user.dto';
import { UserPayload, UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class JwtAuthGuard {},
}));

describe('UsersController', () => {
  let controller: UsersController;
  const service = {
    create: jest.fn(),
    updateUser: jest.fn(),
    getUsers: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const publicUser = {
    id: 'user-id',
    name: 'Teste',
    email: 'teste@example.com',
    role: Role.USER,
  };

  const mockReq = {
    user: {
      id: 'user-id',
      email: 'teste@example.com',
      role: Role.USER,
    },
  } as unknown as Request & { user: UserPayload };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UsersController);
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'Teste',
      email: 'teste@example.com',
      password: 'senha',
    };

    it('repassa os dados ao service e retorna o usuário criado', async () => {
      service.create.mockResolvedValue(publicUser);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(publicUser);
    });

    it('propaga ConflictException quando o e-mail já está em uso', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Já existe um usuário com este e-mail'),
      );

      await expect(controller.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('updateUser', () => {
    const dto: updateUserDto = { name: 'Novo Nome' };

    it('repassa o id, os dados e o usuário autenticado ao service', async () => {
      const updatedUser = { ...publicUser, name: 'Novo Nome' };
      service.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(mockReq, 'user-id', dto);

      expect(service.updateUser).toHaveBeenCalledWith(
        'user-id',
        dto,
        mockReq.user,
      );
      expect(result).toEqual(updatedUser);
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      service.updateUser.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.updateUser(mockReq, 'missing-user', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propaga UnauthorizedException quando o usuário não tem permissão', async () => {
      service.updateUser.mockRejectedValue(
        new UnauthorizedException('usuário não autorizado'),
      );

      await expect(
        controller.updateUser(mockReq, 'other-user', dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getUsers', () => {
    it('retorna a lista de usuários vinda do service', async () => {
      service.getUsers.mockResolvedValue([publicUser]);

      const result = await controller.getUsers();

      expect(service.getUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual([publicUser]);
    });
  });

  describe('findOne', () => {
    it('repassa o id e o usuário autenticado ao service', async () => {
      service.findOne.mockResolvedValue(publicUser);

      const result = await controller.findOne(mockReq, 'user-id');

      expect(service.findOne).toHaveBeenCalledWith('user-id', mockReq.user);
      expect(result).toEqual(publicUser);
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.findOne(mockReq, 'missing-user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propaga UnauthorizedException quando o usuário não tem permissão', async () => {
      service.findOne.mockRejectedValue(
        new UnauthorizedException('Usuário não autorizado'),
      );

      await expect(
        controller.findOne(mockReq, 'other-user'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('remove', () => {
    it('repassa o id e o usuário autenticado ao service e retorna sucesso', async () => {
      const response = { message: 'Usuário removido com sucesso' };
      service.remove.mockResolvedValue(response);

      const result = await controller.remove(mockReq, 'user-id');

      expect(service.remove).toHaveBeenCalledWith('user-id', mockReq.user);
      expect(result).toEqual(response);
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.remove(mockReq, 'missing-user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propaga UnauthorizedException quando o usuário não tem permissão', async () => {
      service.remove.mockRejectedValue(
        new UnauthorizedException('Usuário não autorizado'),
      );

      await expect(
        controller.remove(mockReq, 'other-user'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});