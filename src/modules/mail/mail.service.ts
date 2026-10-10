import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

/** Envío de correo (recuperación de acceso). En desarrollo apunta a Mailpit. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const smtp = config.getOrThrow<{
      host: string;
      port: number;
      user: string;
      password: string;
      from: string;
    }>('smtp');
    this.from = smtp.from;
    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });
  }

  async send(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
    } catch (err) {
      // No se propaga: el flujo de recuperación nunca debe revelar si el correo existe.
      this.logger.error(`No se pudo enviar correo a ${to}: ${(err as Error).message}`);
    }
  }
}
