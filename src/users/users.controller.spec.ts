import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { updateUserDto } from './dto/update-user.dto';
import { UsersController } from './users.controller';
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
  };

  const publicUser = {
    id: 'user-id',
    name: 'Teste',
    email: 'teste@example.com',
    role: 'USER',
  };

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

    it('repassa o id e os dados ao service e retorna o usuário atualizado', async () => {
      const updatedUser = { ...publicUser, name: 'Novo Nome' };
      service.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser('user-id', dto);

      expect(service.updateUser).toHaveBeenCalledWith('user-id', dto);
      expect(result).toEqual(updatedUser);
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      service.updateUser.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(
        controller.updateUser('missing-user', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
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
    it('repassa o id ao service e retorna o usuário encontrado', async () => {
      service.findOne.mockResolvedValue(publicUser);

      const result = await controller.findOne('user-id');

      expect(service.findOne).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(publicUser);
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      await expect(controller.findOne('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});