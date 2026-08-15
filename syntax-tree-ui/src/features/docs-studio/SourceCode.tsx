import { useMemo } from 'react';

interface SourceCodeProps {
  language: string;
  source: string;
}

type TokenKind = 'comment' | 'function' | 'keyword' | 'literal' | 'number' | 'string' | 'type';

interface SourceToken {
  kind: TokenKind | null;
  text: string;
}

const pythonKeywords = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);
const javascriptKeywords = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function',
  'get', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'keyof', 'let', 'new',
  'of', 'private', 'protected', 'public', 'readonly', 'return', 'satisfies', 'set', 'static',
  'super', 'switch', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);
const literals = new Set(['False', 'None', 'True', 'false', 'null', 'true', 'undefined']);

const pythonPattern = /#[^\n]*|'''[\s\S]*?'''|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|False|None|True)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()|\b[A-Z][A-Za-z0-9_]*\b/g;
const javascriptPattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|throw|try|type|typeof|var|void|while|with|yield|false|null|true|undefined)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()|\b[A-Z][A-Za-z0-9_$]*\b/g;

export default function SourceCode({ language, source }: SourceCodeProps) {
  const tokens = useMemo(() => tokenize(source, language), [language, source]);
  const normalizedLanguage = normalizeLanguage(language);
  return (
    <code className={`language-${normalizedLanguage}`}>
      {tokens.map((token, index) => token.kind ? (
        <span className={`obs-code-token obs-code-token--${token.kind}`} key={`${index}:${token.text.slice(0, 12)}`}>{token.text}</span>
      ) : token.text)}
    </code>
  );
}

function tokenize(source: string, language: string): SourceToken[] {
  const normalized = normalizeLanguage(language);
  const pattern = normalized === 'python'
    ? new RegExp(pythonPattern.source, pythonPattern.flags)
    : normalized === 'typescript' || normalized === 'javascript'
      ? new RegExp(javascriptPattern.source, javascriptPattern.flags)
      : null;
  if (!pattern) return [{ kind: null, text: source }];

  const tokens: SourceToken[] = [];
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) tokens.push({ kind: null, text: source.slice(cursor, index) });
    tokens.push({ kind: classifyToken(match[0], normalized), text: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ kind: null, text: source.slice(cursor) });
  return tokens;
}

function classifyToken(token: string, language: string): TokenKind {
  if (token.startsWith('#') || token.startsWith('//') || token.startsWith('/*')) return 'comment';
  if (/^[`'"]/.test(token)) return 'string';
  if (/^\d/.test(token)) return 'number';
  if (literals.has(token)) return 'literal';
  if ((language === 'python' ? pythonKeywords : javascriptKeywords).has(token)) return 'keyword';
  if (/^[A-Z]/.test(token)) return 'type';
  return 'function';
}

function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized === 'py') return 'python';
  if (normalized === 'ts' || normalized === 'tsx') return 'typescript';
  if (normalized === 'js' || normalized === 'jsx') return 'javascript';
  return normalized || 'plaintext';
}
