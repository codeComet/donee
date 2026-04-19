"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
  Send,
} from "lucide-react";

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolbarBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors",
        active &&
          "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
export default function RichTextEditor({
  content = "",
  editable = true,
  placeholder = "Write something…",
  users = [], // for @mention dropdown
  onChange, // called with HTML on every keystroke
  onSave, // save(html) — description mode (shows Save/Cancel)
  onCancel, // cancel — description mode
  onSubmit, // submit(html) — notes mode (shows Send button)
  submitLabel = "Send",
  className,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [mentionState, setMentionState] = useState(null);
  // mentionState = { items: User[], coords: { left, bottom }, selectedIndex: number } | null
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Refs to avoid stale closures in editorProps
  const onSubmitRef = useRef(null);
  const uploadRef = useRef(null);
  const editorRef = useRef(null);
  const mentionStateRef = useRef(null);

  // Keep refs current on every render
  onSubmitRef.current = onSubmit;
  mentionStateRef.current = mentionState;

  // ── Upload image ────────────────────────────────────────────────────────────
  uploadRef.current = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ext = (file.name ?? "image").split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("task-images")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("task-images").getPublicUrl(path);
      editorRef.current
        ?.chain()
        .focus()
        .setImage({ src: data.publicUrl, alt: file.name || "image" })
        .run();
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  // ── Detect @mention trigger ─────────────────────────────────────────────────
  function detectMention(editor) {
    if (!users.length) return;
    const { state } = editor;
    const { $from } = state.selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    const lastAt = textBefore.lastIndexOf("@");
    if (lastAt === -1) {
      setMentionState(null);
      return;
    }
    const query = textBefore.slice(lastAt + 1);
    const items = users
      .filter((u) => u.full_name?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
    if (!items.length) {
      setMentionState(null);
      return;
    }
    try {
      const coords = editor.view.coordsAtPos(state.selection.from);
      setMentionState((prev) => ({
        items,
        coords,
        selectedIndex: Math.min(prev?.selectedIndex ?? 0, items.length - 1),
      }));
    } catch {
      setMentionState(null);
    }
  }

  // ── Insert mention as plain text ────────────────────────────────────────────
  function selectMention(user) {
    const editor = editorRef.current;
    if (!editor) return;
    const { state } = editor;
    const { $from } = state.selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    const lastAt = textBefore.lastIndexOf("@");
    if (lastAt === -1) return;
    const from = state.selection.from - (textBefore.length - lastAt);
    const to = state.selection.from;
    const label = user?.full_name?.trim();
    const id = user?.id;
    if (!id || !label) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent([
        { type: "mention", attrs: { id, label } },
        { type: "text", text: " " },
      ])
      .run();
    setMentionState(null);
  }

  // ── Tiptap editor ───────────────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false }),
      Mention.extend({
        addAttributes() {
          return {
            id: { default: null },
            label: { default: null },
          };
        },
        parseHTML() {
          return [{ tag: "span[data-mention-id]" }];
        },
        renderHTML({ node }) {
          const id = node.attrs.id ?? "";
          const label = node.attrs.label ?? "";
          return ["span", { "data-mention-id": id }, `@${label}`];
        },
        renderText({ node }) {
          const label = node.attrs.label ?? "";
          return `@${label}`;
        },
      }).configure({
        HTMLAttributes: {},
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "",
    editable,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML());
      detectMention(editor);
    },
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const img = items.find((i) => i.type.startsWith("image/"));
        if (!img) return false;
        event.preventDefault();
        uploadRef.current(img.getAsFile());
        return true;
      },
      handleKeyDown(view, event) {
        // Mention dropdown navigation
        if (mentionStateRef.current) {
          if (event.key === "ArrowDown") {
            setMentionState((prev) =>
              prev
                ? {
                    ...prev,
                    selectedIndex: Math.min(
                      prev.selectedIndex + 1,
                      prev.items.length - 1,
                    ),
                  }
                : null,
            );
            return true;
          }
          if (event.key === "ArrowUp") {
            setMentionState((prev) =>
              prev
                ? {
                    ...prev,
                    selectedIndex: Math.max(prev.selectedIndex - 1, 0),
                  }
                : null,
            );
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const ms = mentionStateRef.current;
            if (ms?.items[ms.selectedIndex]) {
              selectMention(ms.items[ms.selectedIndex]);
              return true;
            }
          }
        }
        // Ctrl/Cmd+Enter submits in notes mode
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          const editor = editorRef.current;
          if (editor && !editor.isEmpty && onSubmitRef.current) {
            onSubmitRef.current(editor.getHTML());
            editor.commands.clearContent(true);
            setMentionState(null);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Keep editorRef current
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Close mention on Escape
  useEffect(() => {
    if (!mentionState) return;
    const handler = (e) => {
      if (e.key === "Escape") setMentionState(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mentionState]);

  if (!editor) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (editor.isEmpty) return;
    onSubmit?.(editor.getHTML());
    editor.commands.clearContent(true);
    setMentionState(null);
  }

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {/* Toolbar — only in edit mode */}
      {editable && (
        <div className="flex items-center gap-0.5 border-b border-slate-200 dark:border-slate-600 pb-1.5">
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
          <ToolbarBtn
            onClick={() => fileRef.current?.click()}
            title="Upload image / screenshot"
            disabled={uploading}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadRef.current(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className={cn(
          "rich-text text-sm text-slate-700 dark:text-slate-200",
          editable &&
            "min-h-[80px] border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-300 transition-shadow",
        )}
      />

      {/* @mention dropdown — portal to body so fixed positioning works inside transformed containers */}
      {mentionState &&
        mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: mentionState.coords.bottom + 4,
              left: mentionState.coords.left,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[180px]"
          >
            {mentionState.items.map((user, index) => (
              <button
                key={user.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(user);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors",
                  index === mentionState.selectedIndex &&
                    "bg-indigo-50 text-indigo-700",
                )}
              >
                <Avatar user={user} size="xs" />
                {user.full_name}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {/* Notes mode — Send button */}
      {onSubmit && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Paste screenshot or click{" "}
            <ImageIcon className="inline h-3 w-3 mb-0.5" /> to upload · @ to
            mention · Ctrl+Enter
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={editor.isEmpty || uploading}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            {submitLabel}
          </button>
        </div>
      )}

      {/* Description mode — Save / Cancel */}
      {onSave && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(editor.getHTML())}
            className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
