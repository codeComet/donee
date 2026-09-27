// Screenshot helpers for attaching images to a task as a note.
// Limits must match the `task-images` storage bucket (see 007_wysiwyg_storage.sql).

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

let nextId = 0;

export function toScreenshot(blob, name) {
  nextId += 1;
  return {
    id: nextId,
    blob,
    name: name || `screenshot-${nextId}.png`,
    url: URL.createObjectURL(blob),
  };
}

// Returns an error message, or null if the image can be uploaded
export function validateScreenshot(blob) {
  if (!SCREENSHOT_TYPES.includes(blob.type))
    return "Only PNG, JPEG, GIF or WebP images are allowed.";
  if (blob.size > MAX_SCREENSHOT_BYTES) return "Each image must be 5 MB or smaller.";
  return null;
}

// Uploads screenshots to storage and adds them to the task as a single note
export async function attachScreenshotsAsNote(supabase, { taskId, authorId, screenshots }) {
  const urls = [];
  for (const [i, shot] of screenshots.entries()) {
    const ext = (shot.blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `${authorId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from("task-images")
      .upload(path, shot.blob, { contentType: shot.blob.type });
    if (error) throw error;
    urls.push(supabase.storage.from("task-images").getPublicUrl(path).data.publicUrl);
  }

  const content = urls.map((u, i) => `<img src="${u}" alt="Screenshot ${i + 1}">`).join("");
  const { error } = await supabase
    .from("task_notes")
    .insert({ task_id: taskId, author_id: authorId, content });
  if (error) throw error;
}
