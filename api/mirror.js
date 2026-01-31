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
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    
    // Extract filename from URL or use default
    const urlPath = targetUrl.pathname;
    const filename = urlPath.split('/').pop() || 'downloaded_file';
    
    // Get content type
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';

    // Import form-data dynamically
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Append file with proper options
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: contentType
    });

    // Upload to devuploads.com with proper headers
    const uploadResponse = await fetch('https://devuploads.com/api', {
      method: 'POST',
      headers: {
        'key': '1240962gatdo40wtrx6qce',
        ...formData.getHeaders()
      },
      body: formData
    });

    // Get response text first to handle both JSON and HTML
    const responseText = await uploadResponse.text();
    
    if (!uploadResponse.ok) {
      return res.status(uploadResponse.status).json({ 
        error: 'Upload failed',
        status: uploadResponse.status,
        details: responseText.substring(0, 500) // Limit error output
      });
    }

    // Try to parse as JSON
    let uploadResult;
    try {
      uploadResult = JSON.parse(responseText);
    } catch (e) {
      // If not JSON, return the text response
      uploadResult = { response: responseText.substring(0, 500) };
    }

    // Return success response
    return res.status(200).json({
      success: true,
      original_url: url,
      filename: filename,
      upload_result: uploadResult,
      message: 'File successfully mirrored to devuploads.com'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
