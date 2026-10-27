import assert from "node:assert/strict";
import { validateUpload } from "../src/lib/file-validation.ts";
assert.match(validateUpload(null), /Выберите файл/);
assert.match(validateUpload({ size: 0, type: "application/pdf" }), /пустой/);
assert.match(validateUpload({ size: 11 * 1024 * 1024, type: "application/pdf" }), /10 МБ/);
assert.match(validateUpload({ size: 100, type: "text/plain" }), /Недопустимый формат/);
assert.equal(validateUpload({ size: 100, type: "application/pdf" }), null);
console.log("file validation tests passed");
