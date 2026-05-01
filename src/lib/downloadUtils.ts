import JSZip from 'jszip';
import { azureStorageProvider } from './providers/azureStorageProvider';

export async function downloadSingleImage(filePath: string, filename: string) {
  try {
    const blob = await azureStorageProvider.downloadBlob(filePath, 'photos');
    
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

export async function downloadBulkZip(photos: { filePath: string; filename: string }[], zipName: string) {
  try {
    const zip = new JSZip();
    
    // Fetch all photos and add to zip
    const fetchPromises = photos.map(async (photo) => {
      const blob = await azureStorageProvider.downloadBlob(photo.filePath, 'photos');
      zip.file(photo.filename, blob);
    });
    
    await Promise.all(fetchPromises);
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const objectUrl = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Error creating zip:', error);
    throw error;
  }
}

