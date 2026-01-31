import { Client } from 'pg';

const DB_URL = "postgresql://postgres.hvopahixclbellzicipi:KbVwuzULdLAnAsNh@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";
const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: "ID required" });
  }

  // Connect to database
  const client = new Client({ connectionString: DB_URL });
  
  try {
    await client.connect();

    // Check if record exists
    const result = await client.query('SELECT * FROM files WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      await client.end();
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    const fileRecord = result.rows[0];
    const telegramUrl = fileRecord.telegram_url;
    const fileName = fileRecord.file_name;

    // Download file from Telegram
    const fileResponse = await fetch(telegramUrl);
    const fileBuffer = await fileResponse.arrayBuffer();
    const fileBlob = new Blob([fileBuffer]);

    // Upload to Pixeldrain
    let pixeldrainUrl = "";
    try {
      const formData = new FormData();
      formData.append('file', fileBlob, fileName);

      const pixeldrainRes = await fetch('https://pixeldrain.com/api/file', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${PIXELDRAIN_API_KEY}`).toString('base64')}`,
        },
        body: formData
      });

      const pixeldrainData = await pixeldrainRes.json();

      if (pixeldrainData.success && pixeldrainData.id) {
        pixeldrainUrl = `https://pixeldrain.com/u/${pixeldrainData.id}`;
      }
    } catch (error) {
      console.error("Pixeldrain error:", error);
    }

    // Upload to DevUploads
    let devuploadsUrl = "";
    try {
      const formData = new FormData();
      formData.append('file', fileBlob, fileName);

      const devuploadsRes = await fetch(`https://devuploads.com/api/upload?key=${DEVUPLOADS_API_KEY}`, {
        method: 'POST',
        body: formData
      });

      const devuploadsData = await devuploadsRes.json();

      if (devuploadsData.status === 200 && devuploadsData.data && devuploadsData.data.url) {
        devuploadsUrl = devuploadsData.data.url;
      }
    } catch (error) {
      console.error("DevUploads error:", error);
    }

    await client.end();

    return res.status(200).json({
      success: true,
      server1: pixeldrainUrl,
      server2: devuploadsUrl
    });

  } catch (error) {
    console.error("Error:", error);
    await client.end();
    return res.status(500).json({ success: false, error: error.message });
  }
}
