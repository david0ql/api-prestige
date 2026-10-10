import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

export const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Prestige.2026!';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  // supertest 7 requiere un servidor escuchando (puerto efímero).
  await app.listen(0, '127.0.0.1');
  return app;
}

/** Cliente HTTP autenticado por usuario (cachea tokens para no abusar del login). */
export class Api {
  private tokens = new Map<string, string>();
  constructor(readonly app: INestApplication) {}

  get http() {
    return request(this.app.getHttpServer());
  }

  async token(username: string): Promise<string> {
    const cached = this.tokens.get(username);
    if (cached) return cached;
    const res = await this.http
      .post('/api/auth/login')
      .send({ username, password: PASSWORD });
    if (res.status !== 200)
      throw new Error(
        `Login ${username} falló: ${res.status} ${JSON.stringify(res.body)}`,
      );
    this.tokens.set(username, res.body.accessToken);
    return res.body.accessToken;
  }

  forget(username: string) {
    this.tokens.delete(username);
  }

  async get(user: string, url: string) {
    return this.http
      .get(url)
      .set('Authorization', `Bearer ${await this.token(user)}`);
  }
  async post(user: string, url: string, body: object = {}) {
    return this.http
      .post(url)
      .set('Authorization', `Bearer ${await this.token(user)}`)
      .send(body);
  }
  async patch(user: string, url: string, body: object = {}) {
    return this.http
      .patch(url)
      .set('Authorization', `Bearer ${await this.token(user)}`)
      .send(body);
  }
  async put(user: string, url: string, body: object = {}) {
    return this.http
      .put(url)
      .set('Authorization', `Bearer ${await this.token(user)}`)
      .send(body);
  }

  /** Pesaje manual autorizado (RF-003) — el rol de operaciones lo tiene. */
  async weigh(
    grams: number,
    purpose: string,
    materialId?: string,
    user = 'operaciones',
  ): Promise<string> {
    const res = await this.post(user, '/api/weighings', {
      purpose,
      source: 'MANUAL',
      grossGrams: grams,
      materialId,
      manualReason: 'Balanza en calibración (prueba e2e)',
    });
    if (res.status !== 201)
      throw new Error(
        `Pesaje falló: ${res.status} ${JSON.stringify(res.body)}`,
      );
    return res.body.id;
  }

  async upload(
    user: string,
    fields: Record<string, string>,
    file: { buffer: Buffer; name: string; type: string },
  ) {
    let req = this.http
      .post('/api/media')
      .set('Authorization', `Bearer ${await this.token(user)}`);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', file.buffer, {
      filename: file.name,
      contentType: file.type,
    });
  }
}

export async function pngFile(color = '#b8913a') {
  const buffer = await sharp({
    create: { width: 64, height: 48, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  return { buffer, name: 'evidencia.png', type: 'image/png' };
}

/** MP4 mínimo válido a nivel de firma (caja ftyp) para validar detección por magic bytes. */
export function mp4File() {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  const mdat = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x10, 0x6d, 0x64, 0x61, 0x74]),
    Buffer.alloc(8, 1),
  ]);
  return {
    buffer: Buffer.concat([ftyp, mdat]),
    name: 'proceso.mp4',
    type: 'video/mp4',
  };
}

/** Busca por código; con listas `any` (respuestas JSON) se tipa con id. */
export function byCode<T extends { code: string }>(
  items: T[],
  code: string,
): T & { id: string; [key: string]: any } {
  const found = items.find((i) => i.code === code);
  if (!found) throw new Error(`No existe ${code}`);
  return found as T & { id: string; [key: string]: any };
}
