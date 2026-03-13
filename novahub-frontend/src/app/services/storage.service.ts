import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjkuxjuzabfqfwkvfvlz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqa3V4anV6YWJmcWZ3a3Zmdmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNTA0OTMsImV4cCI6MjA1MTkyNjQ5M30.b0_gIXkc_YQXG5_aYdWr4zKpvuLZ9dPa67pPwJMa-yU';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const storageService = {
  /**
   * Upload logo de empresa
   */
  async uploadTenantLogo(file: File, tenantId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}-${Date.now()}.${fileExt}`;
    const filePath = `tenant-logos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('novahub-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('novahub-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  /**
   * Upload foto de perfil de usuario
   */
  async uploadUserAvatar(file: File, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `user-avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from('novahub-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('novahub-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  /**
   * Eliminar archivo
   */
  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('novahub-assets')
      .remove([filePath]);

    if (error) throw error;
  },

  /**
   * Obtener URL pública de un archivo
   */
  getPublicUrl(filePath: string): string {
    const { data } = supabase.storage
      .from('novahub-assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
