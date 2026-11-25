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
    this.fromName = process.env.MAIL_FROM_NAME || 'cuidarVet';
  }

  async sendPasswordRecoveryEmail(
    to: string,
    code: string,
    expiresInMinutes = 15,
  ): Promise<void> {
    try {
      await this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: { Email: this.fromEmail, Name: this.fromName },
            To: [{ Email: to }],
            Subject: 'Recuperação de senha - cuidarVet',
            TextPart: [
              'cuidarVet - Recuperação de senha',
              '',
              'Recebemos uma solicitação para redefinir a senha da sua conta.',
              `Seu código de recuperação é: ${code}`,
              `Este código expira em ${expiresInMinutes} minutos.`,
              '',
              'Se você não solicitou essa recuperação, ignore este e-mail. Sua senha continuará a mesma.',
              'Nunca compartilhe este código com ninguém.',
            ].join('\n'),
            HTMLPart: this.buildPasswordRecoveryHtml(code, expiresInMinutes),
          },
        ],
      });
    } catch (error) {
      this.logger.error('Falha ao enviar e-mail de recuperação', error);
      throw error;
    }
  }

  private buildPasswordRecoveryHtml(
    code: string,
    expiresInMinutes: number,
  ): string {
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recuperação de senha - cuidarVet</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f4;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Seu código de recuperação da cuidarVet é ${code}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

            <!-- Cabeçalho -->
            <tr>
              <td align="center" style="background-color:#0f766e;padding:28px 24px;">
                <div style="font-size:30px;line-height:1;">🐾</div>
                <h1 style="margin:8px 0 0;font-size:26px;color:#ffffff;font-weight:bold;letter-spacing:0.5px;">cuidarVet</h1>
                <p style="margin:6px 0 0;font-size:13px;color:#ccfbf1;">Cuidado de verdade para quem você ama</p>
              </td>
            </tr>

            <!-- Conteúdo -->
            <tr>
              <td style="padding:32px 32px 8px;">
                <h2 style="margin:0 0 16px;font-size:20px;color:#1f2937;">Recuperação de senha</h2>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">Olá!</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
                  Recebemos uma solicitação para redefinir a senha da sua conta na <strong>cuidarVet</strong>.
                  Use o código abaixo para continuar:
                </p>
              </td>
            </tr>

            <!-- Código -->
            <tr>
              <td align="center" style="padding:24px 32px;">
                <div style="display:inline-block;background-color:#f0fdfa;border:2px dashed #14b8a6;border-radius:10px;padding:16px 32px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f766e;">
                  ${code}
                </div>
                <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">
                  Este código expira em <strong>${expiresInMinutes} minutos</strong>.
                </p>
              </td>
            </tr>

            <!-- Aviso -->
            <tr>
              <td style="padding:0 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#7c2d12;">
                      <strong>Não foi você?</strong> Ignore este e-mail, sua senha continuará a mesma.<br />
                      Nunca compartilhe este código: a equipe cuidarVet jamais vai pedi-lo a você.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Rodapé -->
            <tr>
              <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 24px;">
                <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Este é um e-mail automático, por favor não responda.</p>
                <p style="margin:0;font-size:12px;color:#9ca3af;">© ${year} cuidarVet · Clínica Veterinária</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
</html>
    `;
  }
}
