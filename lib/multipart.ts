export interface MultipartParseResult {
  fields: Record<string, string>;
  files: File[];
}

export async function parseMultipart(request: Request): Promise<MultipartParseResult> {
  const formData = await request.formData();
  const fields: Record<string, string> = {};
  const files: File[] = [];

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    } else {
      files.push(value);
    }
  }

  return { fields, files };
}
