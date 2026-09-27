import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { cn } from '../lib/utils'

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={cn(
        'p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors',
        active && 'bg-indigo-100 text-indigo-600'
      )}
    >
      {children}
    </button>
  )
}

// Lightweight TipTap editor — outputs the same HTML the web app's editor renders
export default function RichTextEditor({ content = '', placeholder = 'Write something…', onChange, onPaste }) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content,
    onUpdate({ editor }) {
      onChange?.(editor.isEmpty ? '' : editor.getHTML())
    },
    editorProps: {
      // Let the parent grab pasted images (e.g. screenshots) instead of dropping them
      handlePaste(_view, event) {
        return onPaste?.(event) ?? false
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500">
      <div className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} className="rich-text text-sm text-slate-700 px-3 py-2 min-h-[72px] max-h-40 overflow-y-auto" />
    </div>
  )
}
