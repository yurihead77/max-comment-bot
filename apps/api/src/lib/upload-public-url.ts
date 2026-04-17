/** Public URL for a stored upload filename (no trailing slash on base, single slash before filename). */
export function buildUploadPublicFileUrl(publicBase: string, filename: string): string {
  const base = publicBase.replace(/\/+$/, "");
  return `${base}/${filename}`;
}
