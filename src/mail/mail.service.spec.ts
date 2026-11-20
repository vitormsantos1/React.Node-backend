import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Mailjet from 'node-mailjet';
import { MailService } from './mail.service';

jest.mock('node-mailjet', () => jest.fn());

const MailjetMock = Mailjet as unknown as jest.Mock;

describe('MailService', () => {
  let service: MailService;
  const originalEnv = process.env;
  const requestMock = jest.fn();
  const postMock = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      MJ_APIKEY_PUBLIC: 'public-key',
      MJ_APIKEY_PRIVATE: 'private-key',
      MAIL_FROM_EMAIL: 'noreply@vetcare.com',
      MAIL_FROM_NAME: 'VetCare Teste',
    };

    postMock.mockReturnValue({ request: requestMock });
    MailjetMock.mockImplementation(() => ({ post: postMock }));

    const module = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get(MailService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it.each(['MJ_APIKEY_PUBLIC', 'MJ_APIKEY_PRIVATE', 'MAIL_FROM_EMAIL'])(
      'lança erro quando a variável %s não está configurada',
      (missingVar) => {
        delete process.env[missingVar];

        expect(() => new MailService()).toThrow(
          'Variáveis do Mailjet não configuradas',
        );
      },
    );

    it('usa "VetCare" como nome padrão quando MAIL_FROM_NAME não é definido', async () => {
      delete process.env.MAIL_FROM_NAME;
      requestMock.mockResolvedValue({});

      const customService = new MailService();
      await customService.sendPasswordRecoveryEmail(
        'user@vetcare.com',
        '123456',
      );

      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Messages: [
            expect.objectContaining({
              From: { Email: 'noreply@vetcare.com', Name: 'VetCare' },
            }),
          ],
        }),
      );
    });
  });

  describe('sendPasswordRecoveryEmail', () => {
    it('envia o e-mail de recuperação com o código e os dados configurados', async () => {
      requestMock.mockResolvedValue({
        body: { Messages: [{ Status: 'success' }] },
      });

      await service.sendPasswordRecoveryEmail('cliente@vetcare.com', '654321');

      expect(MailjetMock).toHaveBeenCalledWith({
        apiKey: 'public-key',
        apiSecret: 'private-key',
      });
      expect(postMock).toHaveBeenCalledWith('send', { version: 'v3.1' });
      expect(requestMock).toHaveBeenCalledWith({
        Messages: [
          {
            From: { Email: 'noreply@vetcare.com', Name: 'VetCare Teste' },
            To: [{ Email: 'cliente@vetcare.com' }],
            Subject: 'Recuperação de senha - VetCare',
            TextPart: 'Seu código de recuperação é 654321.',
            HTMLPart: expect.stringContaining('<h1>654321</h1>'),
          },
        ],
      });
    });

    it('registra o erro no logger e propaga a exceção quando o envio falha', async () => {
      const error = new Error('Falha na API do Mailjet');
      requestMock.mockRejectedValue(error);
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await expect(
        service.sendPasswordRecoveryEmail('cliente@vetcare.com', '654321'),
      ).rejects.toBe(error);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Falha ao enviar e-mail de recuperação',
        error,
      );

      loggerSpy.mockRestore();
    });
  });
});