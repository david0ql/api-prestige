import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Almacenamiento de archivos en disco (RNF-009/011) + URLs firmadas con HMAC para
 * que <img>/<video> puedan cargar sin exponer el JWT y sin enlaces permanentes.
 */
@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly logger = new Logger(MediaStorageService.name);
  readonly root: string;
  private readonly secret: string;
  private readonly ttl: number;

  constructor(config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('media.storageDir'));
    this.secret = config.getOrThrow<string>('media.signingSecret');
    this.ttl = config.get<number>('media.urlTtlSec', 3600);
  }

  async onModuleInit() {
    await mkdir(join(this.root, 'tmp'), { recursive: true });
  }

  get tmpDir() {
    return join(this.root, 'tmp');
  }

  abs(relative: string) {
    const p = resolve(this.root, relative);
    // Defensa contra path traversal.
    if (!p.startsWith(this.root)) throw new Error('Ruta inválida');
    return p;
  }

  async sha256(path: string): Promise<string> {
    const hash = createHash('sha256');
    await new Promise<void>((res, rej) => {
      createReadStream(path).on('data', (d) => hash.update(d)).on('end', () => res()).on('error', rej);
    });
    return hash.digest('hex');
  }

  /** Mueve el temporal a su carpeta definitiva (año/mes) con nombre aleatorio. */
  async persist(tmpPath: string, ext: string): Promise<string> {
    const now = new Date();
    const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    await mkdir(join(this.root, dir), { recursive: true });
    const rel = `${dir}/${randomUUID()}.${ext}`;
    try {
      await rename(tmpPath, this.abs(rel));
    } catch {
      await copyFile(tmpPath, this.abs(rel));
      await unlink(tmpPath).catch(() => undefined);
    }
    return rel;
  }

  /** Genera versión web (≤1920px, webp) y miniatura (480px) de una foto. */
  async derivePhoto(rel: string): Promise<{ webPath: string | null; thumbPath: string | null; width: number | null; height: number | null }> {
    try {
      const src = this.abs(rel);
      const base = rel.replace(/\.[^.]+$/, '');
      const meta = await sharp(src).metadata();
      await sharp(src).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(this.abs(`${base}.web.webp`));
      await sharp(src).rotate().resize({ width: 480, height: 480, fit: 'cover' }).webp({ quality: 70 }).toFile(this.abs(`${base}.thumb.webp`));
      return { webPath: `${base}.web.webp`, thumbPath: `${base}.thumb.webp`, width: meta.width ?? null, height: meta.height ?? null };
    } catch (e) {
      this.logger.warn(`No se pudo optimizar ${rel}: ${(e as Error).message}`);
      return { webPath: null, thumbPath: null, width: null, height: null };
    }
  }

  async exists(rel: string) {
    try {
      await stat(this.abs(rel));
      return true;
    } catch {
      return false;
    }
  }

  private signature(id: string, variant: string, exp: number) {
    return createHmac('sha256', this.secret).update(`${id}:${variant}:${exp}`).digest('base64url');
  }

  signedUrl(prefix: string, id: string, variant: 'original' | 'web' | 'thumb'): string {
    // Redondea la expiración a la ventana para que el navegador pueda cachear.
    const exp = Math.ceil((Date.now() / 1000 + this.ttl) / 300) * 300;
    return `/${prefix}/media/${id}/content?variant=${variant}&exp=${exp}&sig=${this.signature(id, variant, exp)}`;
  }

  verify(id: string, variant: string, exp: string, sig: string): boolean {
    const e = Number(exp);
    if (!Number.isFinite(e) || e < Date.now() / 1000) return false;
    const expected = Buffer.from(this.signature(id, variant, e));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
