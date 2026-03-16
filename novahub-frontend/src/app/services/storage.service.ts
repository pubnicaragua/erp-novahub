/**
 * Storage Service - Usa Base64 para almacenar imágenes directamente en la BD
 * (Supabase Storage no disponible actualmente)
 */

export const storageService = {
  /**
   * Convierte archivo a Base64 Data URL
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Upload logo de empresa (retorna base64)
   */
  async uploadTenantLogo(file: File, _tenantId: string): Promise<string> {
    // Validar tamaño (max 2MB para base64)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('El archivo es muy grande. Máximo 2MB.');
    }
    return this.fileToBase64(file);
  },

  /**
   * Upload foto de perfil de usuario (retorna base64)
   */
  async uploadUserAvatar(file: File, _userId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('El archivo es muy grande. Máximo 2MB.');
    }
    return this.fileToBase64(file);
  },

  /**
   * Eliminar archivo (no-op para base64)
   */
  async deleteFile(_filePath: string): Promise<void> {
    // No-op: base64 se elimina al actualizar el registro
  },

  /**
   * Obtener URL (para base64, retorna el mismo string)
   */
  getPublicUrl(filePath: string): string {
    return filePath;
  }
};
