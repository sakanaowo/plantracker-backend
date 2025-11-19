import { BadRequestException, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

@Injectable()
export class StorageService {
  private supabase: ReturnType<typeof createClient>;
  private bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
    this.bucket = process.env.SUPABASE_BUCKET!;
  }

  private safePath(userId: string, fileName: string) {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const base = fileName.replace(/\.[^/.]+$/, '');
    const name = slugify(base, { lower: true, strict: true });
    return `${userId}/uploads/${Date.now()}-${name}.${ext}`;
  }
  async createSignedUploadUrl(userId: string, fileName: string) {
    const objectPath = this.safePath(userId, fileName);
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectPath);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'CREATE_SIGNED_URL_FAILED',
      });
    return { path: objectPath, signedUrl: data.signedUrl, token: data.token };
  }
  async createSignedViewUrl(objectPath: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, 600);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'CREATE_SIGNED_URL_FAILED',
      });
    return { signedUrl: data.signedUrl };
  }
  async remove(objectPath: string) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([objectPath]);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'DELETE_FILE_FAILED',
      });
    return { ok: true };
  }

  /**
   * Get public URL for a file in storage
   * @param objectPath - The relative path of the file in storage (e.g., "userId/uploads/file.jpg")
   * @returns Full public URL (e.g., "https://...supabase.co/storage/v1/object/public/images/userId/uploads/file.jpg")
   */
  getPublicUrl(objectPath: string): string {
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(objectPath);
    return data.publicUrl;
  }
}
