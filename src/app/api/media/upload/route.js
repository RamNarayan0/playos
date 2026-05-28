import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/lib/logger';

export async function POST(req) {
  const startTime = Date.now();
  try {
    // 1. Verify cryptographic user identity token
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET || "default_secure_playos_secret_token_12345" 
    });

    if (!token || !token.id) {
      // Allow mock flow in local dev mode if cookies aren't attached
      if (process.env.NODE_ENV === 'production') {
        logger.error('Unauthorized media pre-signed URL generation attempt', null, { route: '/api/media/upload' });
        return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
      }
    }

    const userId = token?.id || 1;
    const body = await req.json();
    const { file_name, content_type, asset_type = 'avatar' } = body;

    if (!file_name || !content_type) {
      return NextResponse.json({ error: 'Missing target asset payload descriptors' }, { status: 400 });
    }

    // Sanitize file path configuration to isolate multi-tenant user stores securely
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const timestamp = Date.now();
    const destinationStoragePath = `users/${userId}/${asset_type}s/${timestamp}_${sanitizedFileName}`;

    const bucketName = process.env.GCS_BUCKET_NAME;

    // 2. Direct-to-Cloud Pre-Signed Generation Logic
    if (bucketName) {
      try {
        // Dynamically invoke native storage SDK bindings only when hosted with live server storage keys
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        const optionConfigs = {
          version: 'v4',
          action: 'write',
          expires: Date.now() + 15 * 60 * 1000, // Short-lived 15 minute upload authorization window
          contentType: content_type,
        };

        const [uploadUrl] = await storage
          .bucket(bucketName)
          .file(destinationStoragePath)
          .getSignedUrl(optionConfigs);

        const assetUrl = `https://storage.googleapis.com/${bucketName}/${destinationStoragePath}`;
        const duration = Date.now() - startTime;
        
        logger.metric('storage.presigned_url_generated', duration, { user_id: userId, asset_type, live_cloud: true });

        return NextResponse.json({
          upload_url: uploadUrl,
          asset_url: assetUrl,
          storage_path: destinationStoragePath,
          expires_in: 900,
          is_mock: false
        });
      } catch (sdkError) {
        logger.error('Google Cloud Storage SDK signing integration error', sdkError, { bucket: bucketName });
        // Smoothly cascade down to local fallback if IAM configuration lacks signing credentials
      }
    }

    // 3. Local Developer Mocking Environment (Zero External Dependencies)
    const mockAssetUrl = `https://storage.googleapis.com/playos-mock-assets/${destinationStoragePath}`;
    const duration = Date.now() - startTime;
    
    logger.metric('storage.presigned_url_generated', duration, { user_id: userId, asset_type, live_cloud: false });

    return NextResponse.json({
      upload_url: "https://mock-storage-endpoint.playos.local/upload-simulation",
      asset_url: mockAssetUrl,
      storage_path: destinationStoragePath,
      expires_in: 900,
      is_mock: true,
      diagnostic_notice: "Running simulated pre-signed generation fallback. Supply GCS_BUCKET_NAME to activate real multi-cloud file handling."
    });

  } catch (error) {
    logger.error('Failed to generate pre-signed direct-to-cloud upload token', error, { route: '/api/media/upload' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
