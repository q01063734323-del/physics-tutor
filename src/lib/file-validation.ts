export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const EXTENSIONS_BY_TYPE: Record<string, string[]> = { "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "application/msword": ["doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"] };

export function validateUpload(file: { size: number; type: string; name?: string } | null | undefined): string | null {
  if (!file) return "Выберите файл перед отправкой.";
  if (!file.size) return "Файл пустой. Выберите другой файл.";
  if (file.size > MAX_UPLOAD_BYTES) return "Файл слишком большой. Максимальный размер — 10 МБ.";
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return "Недопустимый формат. Используйте PDF, JPG, PNG, WEBP, DOC или DOCX.";
  const extension = file.name?.split(".").pop()?.toLowerCase();
  if (!extension || !EXTENSIONS_BY_TYPE[file.type]?.includes(extension)) return "Расширение файла не соответствует его типу.";
  return null;
}
