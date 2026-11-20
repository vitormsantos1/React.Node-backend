import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UserPayload } from './users.controller';
import { Role } from '@prisma/client';

jest.mock('bcrypt', () => ({ hash: jest.fn() }));

const hashMock = hash as unknown as jest.Mock<
  Promise<string>,
  [string, number]
>;

describe('UsersService', () => {
  let service: UsersService;
  const repository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getAllUsers: jest.fn(),
    remove: jest.fn(),
  };
  const data = { name: 'Teste', email: 'teste@example.com', password: 'senha' };
  const user = { ...data, id: 'user-id', role: 'USER', password: 'hashed' };

  const ownerPayload = { id: user.id, role: Role.USER } as UserPayload;
  const otherPayload = { id: 'other-id', role: Role.USER } as UserPayload;
  const adminPayload = { id: 'admin-id', role: Role.ADMIN } as UserPayload;

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue(user);
    hashMock.mockResolvedValue('hashed');
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('salva o hash e retorna apenas os campos públicos', async () => {
    const result = await service.create(data);
    expect(repository.findByEmail).toHaveBeenCalledWith(data.email);
    expect(hashMock).toHaveBeenCalledWith(data.password, 12);
    expect(repository.create).toHaveBeenCalledWith({
      ...data,
      password: 'hashed',
    });
    expect({ ...result }).toEqual({
      id: 'user-id',
      name: data.name,
      email: data.email,
      role: 'USER',
    });
    expect(result).not.toHaveProperty('password');
    expect(data.password).toBe('senha');
  });

  it('rejeita e-mail existente antes de gerar hash ou salvar', async () => {
    repository.findByEmail.mockResolvedValue(user);
    await expect(service.create(data)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(hashMock).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('retorna conflito quando outra requisição cadastra o mesmo e-mail', async () => {
    repository.create.mockResolvedValue(null);
    await expect(service.create(data)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('propaga erros de persistência', async () => {
    const error = new Error('Falha de persistência');
    repository.create.mockRejectedValue(error);
    await expect(service.create(data)).rejects.toBe(error);
  });

  it('não salva quando o hash falha', async () => {
    const error = new Error('Falha no hash');
    hashMock.mockRejectedValue(error);
    await expect(service.create(data)).rejects.toBe(error);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('não gera hash nem salva quando a consulta falha', async () => {
    const error = new Error('Falha na consulta');
    repository.findByEmail.mockRejectedValue(error);
    await expect(service.create(data)).rejects.toBe(error);
    expect(hashMock).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  describe('findOne', () => {
    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    it('retorna os campos públicos quando o usuário busca a si mesmo', async () => {
      repository.findById.mockResolvedValue(user);

      const result = await service.findOne(user.id, ownerPayload);

      expect(repository.findById).toHaveBeenCalledWith(user.id);
      expect({ ...result }).toEqual(publicUser);
      expect(result).not.toHaveProperty('password');
    });

    it('permite que um admin busque outro usuário', async () => {
      repository.findById.mockResolvedValue(user);

      const result = await service.findOne(user.id, adminPayload);

      expect({ ...result }).toEqual(publicUser);
    });

    it('rejeita quando um usuário comum busca outro usuário', async () => {
      repository.findById.mockResolvedValue(user);

      await expect(
        service.findOne(user.id, otherPayload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lança NotFoundException sem chamar update quando o usuário não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne('missing-user', adminPayload),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove o próprio usuário', async () => {
      repository.findById.mockResolvedValue(user);

      const result = await service.remove(user.id, ownerPayload);

      expect(repository.remove).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ message: 'Usuário removido com sucesso' });
    });

    it('permite que um admin remova outro usuário', async () => {
      repository.findById.mockResolvedValue(user);

      await service.remove(user.id, adminPayload);

      expect(repository.remove).toHaveBeenCalledWith(user.id);
    });

    it('não remove quando um usuário comum tenta remover outro', async () => {
      repository.findById.mockResolvedValue(user);

      await expect(
        service.remove(user.id, otherPayload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('não remove quando o usuário não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.remove('missing-user', adminPayload),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    const updateData = { name: 'Nome Atualizado' };

    it('atualiza o usuário e retorna apenas os campos públicos', async () => {
      repository.findById.mockResolvedValue(user);
      repository.update.mockResolvedValue({ ...user, ...updateData });

      const result = await service.updateUser(user.id, updateData);

      expect(repository.findById).toHaveBeenCalledWith(user.id);
      expect(repository.update).toHaveBeenCalledWith(user.id, updateData);
      expect({ ...result }).toEqual({
        id: user.id,
        name: updateData.name,
        email: user.email,
        role: user.role,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('lança NotFoundException sem chamar update quando o usuário não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateUser('missing-user', updateData),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('propaga erros de persistência ao atualizar', async () => {
      const error = new Error('Falha ao atualizar');
      repository.findById.mockResolvedValue(user);
      repository.update.mockRejectedValue(error);

      await expect(service.updateUser(user.id, updateData)).rejects.toBe(error);
    });
  });

  describe('getUsers', () => {
    it('retorna todos os usuários do repositório', async () => {
      repository.getAllUsers.mockResolvedValue([user]);

      const result = await service.getUsers();

      expect(repository.getAllUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual([user]);
    });
  });
});
