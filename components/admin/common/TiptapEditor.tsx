'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface TiptapEditorProps {
  value: string | null;
  onChange: (html: string) => void;
  className?: string;
}

export default function TiptapEditor({
  value,
  onChange,
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
    ],
    content: value ?? '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[180px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? '';
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />;
  }

  return (
    <div className={cn('border border-admin-border rounded-lg overflow-hidden bg-white', className)}>
      <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strike"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="Heading 3"
        >
          H3
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          1. List
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
        >
          &ldquo;&rdquo;
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
        >
          —
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => {
            const previous = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('URL', previous ?? 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          label="Link"
        >
          🔗
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'px-2 h-8 rounded text-sm transition-colors',
        active ? 'bg-brand-red/10 text-brand-red' : 'hover:bg-gray-100 text-text-primary'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px bg-gray-300 mx-1 self-stretch" />;
}
