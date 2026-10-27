export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export function validateUpload(file: { size: number; type: string; name?: string } | null | undefined): string | null {
  if (!file) return "Выберите файл перед отправкой.";
  if (!file.size) return "Файл пустой. Выберите другой файл.";
  if (file.size > MAX_UPLOAD_BYTES) return "Файл слишком большой. Максимальный размер — 10 МБ.";
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return "Недопустимый формат. Используйте PDF, JPG, PNG, WEBP, DOC или DOCX.";
  return null;
}
