export default async function handler(req, res) {
  const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
  const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: 'URL parameter is required' });
  }

  const fileName = filename || `file_${Date.now()}`;
  const servers = {};

  // ========== PIXELDRAIN UPLOAD ==========
  try {
    const formData = new FormData();
    
    // Fetch file and create blob
    const fileResponse = await fetch(url);
    if (fileResponse.ok) {
      const fileBlob = await fileResponse.blob();
      formData.append('file', fileBlob, fileName);

      const pixeldrainRes = await fetch('https://pixeldrain.com/api/file', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${PIXELDRAIN_API_KEY}`).toString('base64')}`
        },
        body: formData
      });

      const pixeldrainData = await pixeldrainRes.json();

      if (pixeldrainData.success && pixeldrainData.id) {
        servers["pixeldrain"] = `https://pixeldrain.com/u/${pixeldrainData.id}`;
      }
    }
  } catch (error) {
    console.error('Pixeldrain upload error:', error.message);
  }

  // ========== DEVUPLOADS UPLOAD ==========
  try {
    // Step 1: Get upload server
    const serverRes = await fetch(
      `https://devuploads.com/api/upload/server?key=${DEVUPLOADS_API_KEY}`
    );
    const serverData = await serverRes.json();

    if (serverData.status === 200 && serverData.result) {
      const uploadServer = serverData.result;

      // Step 2: Upload file using URL (remote upload)
      const uploadRes = await fetch(`${uploadServer}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          key: DEVUPLOADS_API_KEY,
          url: url,
          public: '1'
        })
      });

      const uploadData = await uploadRes.json();

      if (uploadData.status === 200 && uploadData.result && uploadData.result.link) {
        servers["devuploads"] = uploadData.result.link;
      }
    }
  } catch (error) {
    console.error('DevUploads upload error:', error.message);
  }

  // Return response
  return res.status(200).json({
    ok: true,
    servers: servers
  });
}
