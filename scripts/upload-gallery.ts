import 'dotenv/config';
import { createReadStream, readdirSync } from 'fs';
import { join, basename } from 'path';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET');
  process.exit(1);
}

// Upload image to Cloudinary
async function uploadImage(filePath: string, publicId: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', createReadStream(filePath));
  formData.append('upload_preset', 'ml_default'); // Using unsigned upload
  formData.append('public_id', publicId);
  formData.append('folder', 'dapurdekaka/gallery');

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=dapurdekaka/gallery&public_id=${publicId}&timestamp=${timestamp}`;
  
  // Generate signature manually (simplified for demo)
  // In production, use cloudinary package
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const result = await response.json();
  if (result.error) {
    console.error(`❌ Failed to upload ${publicId}:`, result.error.message);
  } else {
    console.log(`✅ Uploaded: ${publicId}`);
  }
}

// Upload all gallery images
async function main() {
  const galleryDir = join(process.cwd(), 'public/assets/gallery');
  const files = readdirSync(galleryDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

  console.log(`Found ${files.length} images in ${galleryDir}`);

  for (const file of files) {
    const originalName = basename(file, file.includes('.png') ? '.png' : '.jpg');
    const num = parseInt(originalName);
    const publicId = `gallery-${String(num).padStart(2, '0')}`;
    
    const filePath = join(galleryDir, file);
    console.log(`Uploading ${file} as ${publicId}...`);
    await uploadImage(filePath, publicId);
  }

  console.log('\n✅ All uploads complete!');
}

main().catch(console.error);