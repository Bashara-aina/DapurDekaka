import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join, basename } from 'path';
import cloudinary from 'cloudinary';
import { setTimeout } from 'timers/promises';

config({ path: join(process.cwd(), '.env.local') });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function uploadImage(filePath: string, publicId: string): Promise<string | null> {
  try {
    const result = await cloudinary.v2.uploader.upload(filePath, {
      folder: 'dapurdekaka/gallery',
      public_id: publicId,
      use_filename: false,
      unique_filename: false,
      overwrite: true,
      resource_type: 'image',
    });
    return result.secure_url;
  } catch (error) {
    console.error(`❌ Failed: ${publicId} - ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  const galleryDir = join(process.cwd(), 'public/assets/gallery');
  const files = readdirSync(galleryDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).sort();

  console.log(`Found ${files.length} images in ${galleryDir}`);
  console.log(`Cloud: ${cloudinary.config().cloud_name}\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const originalName = basename(file, file.includes('.png') ? '.png' : '.jpg');
    const num = parseInt(originalName);
    const publicId = `gallery-${String(num).padStart(2, '0')}`;
    
    const filePath = join(galleryDir, file);
    process.stdout.write(`[${success + failed + 1}/${files.length}] Uploading ${file} as ${publicId}... `);
    
    const url = await uploadImage(filePath, publicId);
    
    if (url) {
      console.log(`✅`);
      success++;
    } else {
      console.log(`❌`);
      failed++;
    }
    
    // Small delay between uploads
    await setTimeout(300);
  }

  console.log(`\n✅ Done! ${success} uploaded, ${failed} failed.`);
}

main().catch(console.error);