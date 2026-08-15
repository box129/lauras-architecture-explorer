import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { Bold, Italic, List, Save, X } from 'lucide-react';

interface MarkdownEditorProps {
  markdown: string;
  saving?: boolean;
  onSave: (markdown: string) => void;
  onCancel: () => void;
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

export default function MarkdownEditor({ markdown, saving, onSave, onCancel }: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write documentation...' }),
    ],
    content: markdownToHtml(markdown),
    editorProps: {
      attributes: {
        class: 'doc-editor prose prose-invert prose-sm max-w-none min-h-[420px] outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      editor.commands.setContent(markdownToHtml(markdown));
    }
  }, [editor, markdown]);

  const save = () => {
    if (!editor) return;
    onSave(turndown.turndown(editor.getHTML()));
  };

  return (
    <div className="border border-border rounded bg-bg overflow-hidden">
      <div className="h-9 border-b border-border flex items-center gap-1 px-2">
        <button className="doc-tool-button" onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={13} />
        </button>
        <button className="doc-tool-button" onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={13} />
        </button>
        <button className="doc-tool-button" onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </button>
        <div className="flex-1" />
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-white bg-accent rounded disabled:opacity-50"
        >
          <Save size={12} /> Save
        </button>
        <button onClick={onCancel} className="doc-tool-button" title="Cancel">
          <X size={13} />
        </button>
      </div>
      <div className="p-4 max-h-[62vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function markdownToHtml(markdown: string): string {
  const lines = (markdown || '').split('\n');
  const html: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h${heading[1].length}>${escapeHtml(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  return html.join('\n') || '<p></p>';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
