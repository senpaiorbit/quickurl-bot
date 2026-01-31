export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get the URL from query parameter
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ 
        error: 'Missing url parameter',
        usage: '/api/mirror.js?url={full_url}'
      });
    }

    // Validate URL
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }

    // Fetch the file from the source URL
    const fileResponse = await fetch(url);
    
    if (!fileResponse.ok) {
      return res.status(fileResponse.status).json({ 
        error: `Failed to fetch file: ${fileResponse.statusText}` 
      });
    }

    // Get file as buffer
    const fileBuffer = await fileResponse.arrayBuffer();
    const blob = new Blob([fileBuffer]);

    // Prepare form data for devuploads.com
    const formData = new FormData();
    
    // Extract filename from URL or use default
    const urlPath = targetUrl.pathname;
    const filename = urlPath.split('/').pop() || 'file';
    
    formData.append('file', blob, filename);

    // Upload to devuploads.com
    const uploadResponse = await fetch('https://devuploads.com/api', {
      method: 'POST',
      headers: {
        'key': '1240962gatdo40wtrx6qce'
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return res.status(uploadResponse.status).json({ 
        error: 'Upload failed',
        details: errorText
      });
    }

    // Get the response from devuploads
    const uploadResult = await uploadResponse.json();

    // Return success response
    return res.status(200).json({
      success: true,
      original_url: url,
      upload_result: uploadResult,
      message: 'File successfully mirrored to devuploads.com'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
