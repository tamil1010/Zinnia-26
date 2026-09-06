import { useState } from 'react';
import { ADMIN_TOKEN_KEY } from '../auth/adminFetch';
import { AdminError } from '../types';

export function useDownload() {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = async (url: string, defaultFilename = 'export.xlsx') => {
    setDownloading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new AdminError(`Download failed with status ${response.status}`);
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = defaultFilename;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (err: any) {
      setError(err.message || 'Download error');
      throw err;
    } finally {
      setDownloading(false);
    }
  };

  return { downloadFile, downloading, error };
}
