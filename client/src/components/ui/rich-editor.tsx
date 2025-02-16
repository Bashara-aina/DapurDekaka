import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight } from 'lowlight'
import { all } from 'lowlight/lib/all'
const lowlight = createLowlight(all)
import { Button } from './button'
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3,
  List,
  ListOrdered,
  Code,
  Image as ImageIcon,
  Youtube as YoutubeIcon
} from 'lucide-react'

interface RichEditorProps {
  content: string
  onChange: (content: string) => void
}

export function RichEditor({ content, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Youtube,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder: 'Write your story...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  const handleImageUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch('/api/blog/upload', {
        method: 'POST',
        body: formData,
      })
      const { url } = await response.json()
      editor.chain().focus().setImage({ src: url }).run()
    } catch (error) {
      console.error('Failed to upload image:', error)
    }
  }

  const handleYoutubeEmbed = () => {
    const url = prompt('Enter YouTube URL')
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run()
    }
  }

  return (
    <div className="border rounded-lg">
      <div className="border-b p-2 flex gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'bg-muted' : ''}
        >
          <Code className="h-4 w-4" />
        </Button>
        <label className="cursor-pointer">
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={() => {}}
          >
            <ImageIcon className="h-4 w-4" />
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file)
              }}
            />
          </Button>
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleYoutubeEmbed}
        >
          <YoutubeIcon className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="prose max-w-none p-4" />
    </div>
  )
}