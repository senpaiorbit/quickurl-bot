import fetch from 'node-fetch';

const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: 'URL parameter is required' });
  }

  const fileName = filename || `file_${Date.now()}`;
  const servers = {};

  // Upload to Pixeldrain (try with file stream)
  try {
    const fileResponse = await fetch(url);
    
    if (fileResponse.ok) {
      const fileBuffer = await fileResponse.buffer();
      
      const FormData = (await import('form-data')).default;
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
    }
  } catch (error) {
    console.error('Pixeldrain error:', error.message);
  }

  // Upload to DevUploads (using remote URL upload)
  try {
    // Step 1: Get upload server
    const serverRes = await fetch(
      `https://devuploads.com/api/upload/server?key=${DEVUPLOADS_API_KEY}`
    );
    const serverData = await serverRes.json();

    if (serverData.status === 200 && serverData.result) {
      const uploadServer = serverData.result;

      // Step 2: Upload file by URL
      const params = new URLSearchParams({
        key: DEVUPLOADS_API_KEY,
        url: url,
        public: '1'
      });

      const uploadRes = await fetch(`${uploadServer}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const uploadData = await uploadRes.json();

      if (uploadData.status === 200 && uploadData.result && uploadData.result.link) {
        servers["2"] = uploadData.result.link;
      }
    }
  } catch (error) {
    console.error('DevUploads error:', error.message);
  }

  // Return response
  return res.status(200).json({
    ok: true,
    servers: servers
  });
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};
