import { Injectable, Logger } from '@nestjs/common';
import Mailjet from 'node-mailjet';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mailjet: Mailjet;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    const apiKey = process.env.MJ_APIKEY_PUBLIC;
    const apiSecret = process.env.MJ_APIKEY_PRIVATE;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    if (!apiKey || !apiSecret || !fromEmail) {
      throw new Error('Variáveis do Mailjet não configuradas');
    }

    this.mailjet = new Mailjet({ apiKey, apiSecret });
    this.fromEmail = fromEmail;
    this.fromName = process.env.MAIL_FROM_NAME || 'VetCare';
  }

  async sendPasswordRecoveryEmail(to: string, code: string): Promise<void> {
    try {
      await this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: { Email: this.fromEmail, Name: this.fromName },
            To: [{ Email: to }],
            Subject: 'Recuperação de senha - VetCare',
            TextPart: `Seu código de recuperação é ${code}.`,
            HTMLPart: `
              <h2>Recuperação de senha - VetCare</h2>
              <p>Seu código de recuperação é:</p>
              <h1>${code}</h1>
              <p>Se você não solicitou essa recuperação, ignore este e-mail.</p>
            `,
          },
        ],
      });
    } catch (error) {
      this.logger.error('Falha ao enviar e-mail de recuperação', error);
      throw error;
    }
  }
}
