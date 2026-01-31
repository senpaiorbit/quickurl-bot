import FormData from 'form-data';
import fetch from 'node-fetch';

const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: 'URL parameter is required' });
  }

  const fileName = filename || `file_${Date.now()}`;

  try {
    // Download file from Telegram
    const fileResponse = await fetch(url);
    
    if (!fileResponse.ok) {
      return res.status(400).json({ ok: false, error: 'Failed to download file from Telegram' });
    }

    const fileBuffer = await fileResponse.buffer();
    const servers = {};

    // Upload to Pixeldrain
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename: fileName });

      const pixeldrainRes = await fetch('https://pixeldrain.com/api/file', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${PIXELDRAIN_API_KEY}`).toString('base64')}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      const pixeldrainData = await pixeldrainRes.json();

      if (pixeldrainData.success && pixeldrainData.id) {
        servers["1"] = `https://pixeldrain.com/u/${pixeldrainData.id}`;
      }
    } catch (error) {
      console.error('Pixeldrain upload error:', error);
    }

    // Upload to DevUploads
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename: fileName });

      const devuploadsRes = await fetch(`https://devuploads.com/api/upload?key=${DEVUPLOADS_API_KEY}`, {
        method: 'POST',
        headers: formData.getHeaders(),
        body: formData
      });

      const devuploadsData = await devuploadsRes.json();

      if (devuploadsData.status === 200 && devuploadsData.data && devuploadsData.data.url) {
        servers["2"] = devuploadsData.data.url;
      }
    } catch (error) {
      console.error('DevUploads upload error:', error);
    }

    // Return response
    return res.status(200).json({
      ok: true,
      servers: servers
    });

  } catch (error) {
    console.error('Mirror API error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
