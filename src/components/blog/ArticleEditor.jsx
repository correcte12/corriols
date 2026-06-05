import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { uploadBlogImage } from '../../lib/blogStorage'
import './ArticleEditor.css'

// Permet conservar l'atribut data-marker als paràgrafs (ítems de llista ✔/❌)
// perquè sobrevisqui al desar/recarregar de l'editor.
const MarkerParagraph = Extension.create({
  name: 'markerParagraph',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          dataMarker: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-marker'),
            renderHTML: (attrs) =>
              attrs.dataMarker ? { 'data-marker': attrs.dataMarker } : {},
          },
        },
      },
    ]
  },
})

// Símbols que tracta com a ítem de llista (per indentar-los mantenint la marca).
const LIST_MARK = /^[✔✓☑✅❌✗✘❎•·●○◦▪▫‣⁃➕➖]\s/u

// Caràcters invisibles (amplada zero, selectors de variació d'emoji, marques RTL...)
// que enganxa Facebook i que enganyen les comparacions de text.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\uFE0E\uFE0F]/g
const NBSP = /\u00A0/g

// És una línia que només conté una icona/vinyeta? (curta i sense lletres ni números)
const isMarkerOnly = (text) =>
  text.length > 0 && text.length <= 3 && !/[\p{L}\p{N}]/u.test(text)

// És una <img> un emoji de Facebook (i no una imatge real de l'article)?
const isEmojiImg = (img) => {
  const src = img.getAttribute('src') || ''
  const alt = (img.getAttribute('alt') || '').trim()
  const w = parseInt(img.getAttribute('width') || '0', 10)
  const h = parseInt(img.getAttribute('height') || '0', 10)
  return (
    /emoji/i.test(src) ||
    (w > 0 && w <= 24 && h > 0 && h <= 24) ||
    (alt.length > 0 && alt.length <= 3 && !/[\p{L}\p{N}]/u.test(alt))
  )
}

// Caràcter d'un emoji-imatge: primer l'alt; si falta, es reconstrueix des del
// nom del fitxer de Facebook (p. ex. .../2714.png -> ✔, .../274c.png -> ❌).
const emojiFromImg = (img) => {
  const alt = (img.getAttribute('alt') || '').trim()
  if (alt) return alt
  const src = img.getAttribute('src') || ''
  const m = src.match(/\/([0-9a-f]{2,6}(?:[-_][0-9a-f]{2,6})*)\.(?:png|gif|svg)/i)
  if (m) {
    try {
      return m[1]
        .split(/[-_]/)
        .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
        .join('')
    } catch {
      return ''
    }
  }
  return ''
}

const DIVIDER = /^[\s─-╿—–\-_=*]{3,}$/u
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER',
  'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR',
])

const escapeHtml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Extreu el text en línies a partir de qualsevol estructura HTML, convertint els
// emojis-imatge de Facebook en el seu caràcter. Cada bloc i cada <br> trenca línia.
function extractLines(root) {
  const lines = []
  let current = ''
  const flush = () => {
    const t = current.replace(INVISIBLE, '').replace(NBSP, ' ').replace(/\s+/g, ' ').trim()
    if (t) lines.push(t)
    current = ''
  }
  const walk = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        current += n.textContent
      } else if (n.nodeType === 1) {
        const tag = n.tagName
        if (tag === 'BR') {
          flush()
        } else if (tag === 'HR') {
          flush()
          current = '────────'
          flush()
        } else if (tag === 'IMG') {
          current += isEmojiImg(n) ? emojiFromImg(n) || '•' : ''
        } else if (BLOCK_TAGS.has(tag)) {
          flush()
          walk(n)
          flush()
        } else {
          walk(n) // inline (span, strong, a...): es manté a la mateixa línia
        }
      }
    })
  }
  walk(root)
  flush()
  return lines
}

// Neteja HTML enganxat (sobretot de Facebook): n'extreu les línies de text amb
// els emojis recuperats i reconstrueix paràgrafs nets, separadors i ítems de
// llista indentats. És robust contra l'estructura de divs imbricats de Facebook.
function cleanPastedHtml(html) {
  let doc
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return html
  }
  if (!doc.body) return html

  const lines = extractLines(doc.body)
  const out = []

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i]

    // Línia de guions -> separador
    if (DIVIDER.test(line)) {
      out.push('<hr>')
      continue
    }

    // Línia que només és una icona/emoji -> fusiona amb la línia següent
    if (isMarkerOnly(line) && i + 1 < lines.length) {
      lines[i + 1] = `${line} ${lines[i + 1]}`
      continue
    }

    const isListItem = LIST_MARK.test(line)
    out.push(`<p${isListItem ? ' data-marker="1"' : ''}>${escapeHtml(line)}</p>`)
  }

  return out.join('')
}

// Neteja text pla enganxat (quan el porta-retalls no inclou HTML).
function cleanPastedText(text) {
  return text
    .replace(/\r/g, '')
    .replace(INVISIBLE, '')
    // línia que només és una icona seguida de salts -> vinyeta unificada
    .replace(/^[^\p{L}\p{N}\n]{1,3}\n+/gmu, '• ')
    // col·lapsa línies en blanc múltiples
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

// Editor WYSIWYG basat en Tiptap. Emet HTML net cap a onChange.
export default function ArticleEditor({ value, onChange, onError }) {
  const fileInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      MarkerParagraph,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      transformPastedHTML: (html) => cleanPastedHtml(html),
      transformPastedText: (text) => cleanPastedText(text),
    },
  })

  if (!editor) return null

  const handleImageFile = async (file) => {
    if (!file) return
    try {
      const { url } = await uploadBlogImage(file)
      editor.chain().focus().setImage({ src: url }).run()
    } catch (err) {
      onError?.(err.message)
    }
  }

  // Neteja manual: aplica el netejador sobre tot el contingut actual de l'editor.
  const cleanCurrentContent = () => {
    let html = editor.getHTML()

    // Cas especial: s'ha enganxat HTML com a text pla i les etiquetes (<p>...)
    // apareixen literalment. Les recuperem com a HTML real abans de netejar.
    if (/&lt;\/?(p|div|br|h[1-6]|ul|ol|li)\b/i.test(html)) {
      const parsed = new DOMParser().parseFromString(html, 'text/html')
      html = parsed.body.textContent || html
    }

    const cleaned = cleanPastedHtml(html)
    editor.commands.setContent(cleaned, { emitUpdate: true })
    onChange(cleaned)
  }

  const Btn = ({ onClick, active, disabled, title, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`ae-btn${active ? ' ae-btn--active' : ''}`}
    >
      {children}
    </button>
  )

  return (
    <div className="ae-wrapper">
      <div className="ae-toolbar">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negreta"
        >
          <strong>B</strong>
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Cursiva"
        >
          <em>I</em>
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Ratllat"
        >
          <s>S</s>
        </Btn>
        <span className="ae-sep" />
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Títol"
        >
          H2
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Subtítol"
        >
          H3
        </Btn>
        <span className="ae-sep" />
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Llista"
        >
          •
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Llista numerada"
        >
          1.
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Cita"
        >
          ❝
        </Btn>
        <span className="ae-sep" />
        <Btn
          onClick={() => fileInputRef.current?.click()}
          title="Inserir imatge"
        >
          🖼
        </Btn>
        <Btn
          onClick={cleanCurrentContent}
          title="Netejar format enganxat (treu espais buits i icones soltes)"
        >
          🧹
        </Btn>
        <span className="ae-sep" />
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Desfer"
        >
          ↺
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Refer"
        >
          ↻
        </Btn>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            handleImageFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <EditorContent editor={editor} className="ae-content" />
    </div>
  )
}
