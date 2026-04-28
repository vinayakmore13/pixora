import { BlobServiceClient, AnonymousCredential } from '@azure/storage-blob';

const ACCOUNT_NAME = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME;
const SAS_TOKEN = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN; // Should start with ?
const CONTAINER_NAME = import.meta.env.VITE_AZURE_STORAGE_CONTAINER_NAME || 'photos';

if (!ACCOUNT_NAME || !SAS_TOKEN) {
  console.warn("Azure Storage credentials missing. Please set VITE_AZURE_STORAGE_ACCOUNT_NAME and VITE_AZURE_STORAGE_SAS_TOKEN in .env");
}

const blobUri = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
const blobServiceClient = new BlobServiceClient(
  `${blobUri}${SAS_TOKEN}`,
  new AnonymousCredential()
);

export const azureStorageProvider = {
  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(file: File | Blob, fileName: string, contentType: string): Promise<string> {
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: { blobContentType: contentType }
    });

    return fileName;
  },

  /**
   * Get the URL for a blob. 
   * If the container is public, it's just the URL.
   * If private, we append the SAS token.
   */
  getBlobUrl(fileName: string): string {
    return `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${fileName}${SAS_TOKEN}`;
  },

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(fileName: string): Promise<void> {
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.delete();
  }
};
