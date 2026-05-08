import { put } from "@vercel/blob";

export async function uploadFile(file: File, prefix: string): Promise<string> {
  const fileName = file.name || "upload.bin";
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension ?? "bin"}`;

  const { url } = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return url;
}
