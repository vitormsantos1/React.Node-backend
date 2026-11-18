import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

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
  };
  const data = { name: 'Teste', email: 'teste@example.com', password: 'senha' };
  const user = { ...data, id: 'user-id', role: 'USER', password: 'hashed' };

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
    it('retorna os campos públicos do usuário encontrado', async () => {
      repository.findById.mockResolvedValue(user);

      const result = await service.findOne(user.id);

      expect(repository.findById).toHaveBeenCalledWith(user.id);
      expect({ ...result }).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('lança NotFoundException quando o usuário não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
