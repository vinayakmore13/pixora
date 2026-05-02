import { BlobServiceClient, AnonymousCredential } from '@azure/storage-blob';

// Try to get values from import.meta.env (Vite)
const ACCOUNT_NAME = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME;
const SAS_TOKEN = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN;
const CONTAINER_NAME = import.meta.env.VITE_AZURE_STORAGE_CONTAINER_NAME || 'photos';

// Debug logging for environment variables
if (import.meta.env.DEV) {
  console.log('Azure Storage Config:', {
    accountName: ACCOUNT_NAME ? 'set' : 'MISSING',
    sasToken: SAS_TOKEN ? 'set' : 'MISSING',
    container: CONTAINER_NAME
  });
} else if (!ACCOUNT_NAME || !SAS_TOKEN) {
  // Minimal logging for production to help debug deployment issues without leaking secrets
  console.warn('Azure Storage Configuration is incomplete. Image uploads will fail.');
}

if (!ACCOUNT_NAME || !SAS_TOKEN) {
  console.warn("Azure Storage credentials missing. Please set VITE_AZURE_STORAGE_ACCOUNT_NAME and VITE_AZURE_STORAGE_SAS_TOKEN in .env and RESTART your dev server.");
}

// Ensure SAS token starts with ?
const cleanSasToken = SAS_TOKEN ? (SAS_TOKEN.startsWith('?') ? SAS_TOKEN : `?${SAS_TOKEN}`) : '';

const blobUri = ACCOUNT_NAME ? `https://${ACCOUNT_NAME}.blob.core.windows.net` : '';
const blobServiceClient = (blobUri && SAS_TOKEN) ? new BlobServiceClient(
  `${blobUri}${cleanSasToken}`,
  new AnonymousCredential()
) : null;

export const azureStorageProvider = {
  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(file: File | Blob, fileName: string, container: string = CONTAINER_NAME, contentType?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!blobServiceClient) {
      return { success: false, error: "Azure Storage is not configured. Check VITE_AZURE_STORAGE_ACCOUNT_NAME in .env" };
    }
    try {
      const containerClient = blobServiceClient.getContainerClient(container);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);

      const mimeType = contentType || (file instanceof File ? file.type : 'image/jpeg');

      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: mimeType }
      });

      return { success: true, path: fileName };
    } catch (error: any) {
      console.error('Azure upload error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get the URL for a blob.
   */
  getBlobUrl(fileName: string, container: string = CONTAINER_NAME): string {
    // If it's already a full URL, return it
    if (!fileName || fileName.startsWith('http')) return fileName || '';
    
    if (!ACCOUNT_NAME) {
      console.warn("Azure Storage Account Name is missing");
      return fileName; // Fallback to filename if not configured
    }

    // Sanitize fileName (remove leading slash if present)
    const sanitizedFileName = fileName.startsWith('/') ? fileName.substring(1) : fileName;
    // Sanitize container (remove slashes)
    const sanitizedContainer = container.replace(/\//g, '');
    
    return `https://${ACCOUNT_NAME}.blob.core.windows.net/${sanitizedContainer}/${sanitizedFileName}${cleanSasToken}`;
  },

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(fileName: string, container: string = CONTAINER_NAME): Promise<{ success: boolean; error?: string }> {
    if (!blobServiceClient) {
      return { success: false, error: "Azure Storage is not configured" };
    }
    try {
      const containerClient = blobServiceClient.getContainerClient(container);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.deleteIfExists();
      return { success: true };
    } catch (error: any) {
      console.error('Azure delete error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete all blobs with a certain prefix (simulates deleting a folder)
   */
  async deleteFolder(prefix: string, container: string = CONTAINER_NAME): Promise<{ success: boolean; error?: string }> {
    if (!blobServiceClient) {
      return { success: false, error: "Azure Storage is not configured" };
    }
    try {
      const containerClient = blobServiceClient.getContainerClient(container);
      let i = 0;
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
        await blockBlobClient.deleteIfExists();
        i++;
      }
      return { success: true };
    } catch (error: any) {
      console.error('Azure folder delete error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Download a blob as a Blob object.
   */
  async downloadBlob(fileName: string, container: string = CONTAINER_NAME): Promise<Blob> {
    const url = this.getBlobUrl(fileName, container);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download blob: ${response.statusText}`);
    return await response.blob();
  }
};

