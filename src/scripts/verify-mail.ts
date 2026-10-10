/**
 * Verificación del correo de producción (SMTP real).
 * Uso: node dist/scripts/verify-mail.js destino@dominio.com   (lee SMTP_* del entorno / .env)
 * Comprueba conexión, TLS (STARTTLS obligatorio en producción) y autenticación, y envía un correo de prueba.
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import configuration from '../config/configuration';
import { MailService } from '../modules/mail/mail.service';

async function main() {
  const to = process.argv[2];
  if (!to)
    throw new Error('Indique el destinatario: verify-mail destino@dominio.com');
  const config = new ConfigService(configuration());
  const mail = new MailService(config);
  await mail.verify();
  console.log('✔ SMTP: conexión, TLS y autenticación correctas');
  await mail.sendOrThrow(
    to,
    'Prestige Gold · prueba de correo',
    '<p>Correo de prueba de <strong>Prestige Gold</strong>: la configuración SMTP funciona.</p>',
    'Correo de prueba de Prestige Gold: la configuración SMTP funciona.',
  );
  console.log(`✔ Correo de prueba enviado a ${to}`);
}

main().catch((e: Error) => {
  console.error(`✘ ${e.message}`);
  process.exit(1);
});
