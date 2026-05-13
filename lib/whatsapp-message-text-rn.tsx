import React from 'react';
import { Linking, Platform, Text, type StyleProp, type TextStyle } from 'react-native';

import { splitTextWithUrls, stripHtmlForMessageBody } from '@/lib/inbox-format';

export type WhatsAppBubbleTone = 'incoming' | 'outgoing';

export type WhatsAppBubblePalette = {
  base: string;
  link: string;
  codeBgIncoming: string;
  codeBgOutgoing: string;
  quoteBorderIncoming: string;
  quoteBorderOutgoing: string;
};

type Pair = {
  i: number;
  j: number;
  o: string;
  c: string;
  k: 'mono3' | 'mono1' | 'strike' | 'italic' | 'bold';
};

function nextPairedDelimiter(
  s: string,
  open: string,
  close: string,
  allowEmpty: boolean,
): { i: number; j: number } | null {
  let searchFrom = 0;
  while (searchFrom < s.length) {
    const i = s.indexOf(open, searchFrom);
    if (i === -1) return null;
    const j = s.indexOf(close, i + open.length);
    if (j === -1) return null;
    const inner = s.slice(i + open.length, j);
    if (!allowEmpty && inner.length === 0) {
      searchFrom = i + open.length;
      continue;
    }
    return { i, j };
  }
  return null;
}

function firstInlinePair(s: string): Pair | null {
  const types: Array<{ o: string; c: string; k: Pair['k']; allowEmpty: boolean }> = [
    { o: '```', c: '```', k: 'mono3', allowEmpty: true },
    { o: '`', c: '`', k: 'mono1', allowEmpty: false },
    { o: '~', c: '~', k: 'strike', allowEmpty: false },
    { o: '_', c: '_', k: 'italic', allowEmpty: false },
    { o: '*', c: '*', k: 'bold', allowEmpty: false },
  ];
  let best: Pair | null = null;
  for (const t of types) {
    const hit = nextPairedDelimiter(s, t.o, t.c, t.allowEmpty);
    if (!hit) continue;
    const cand: Pair = { i: hit.i, j: hit.j, o: t.o, c: t.c, k: t.k };
    if (!best || cand.i < best.i || (cand.i === best.i && t.o.length > best.o.length)) {
      best = cand;
    }
  }
  return best;
}

function splitCodeFenceSegments(s: string): Array<{ code: boolean; text: string }> {
  const out: Array<{ code: boolean; text: string }> = [];
  let i = 0;
  while (i < s.length) {
    const start = s.indexOf('```', i);
    if (start === -1) {
      if (i < s.length) out.push({ code: false, text: s.slice(i) });
      break;
    }
    if (start > i) out.push({ code: false, text: s.slice(i, start) });
    const end = s.indexOf('```', start + 3);
    if (end === -1) {
      out.push({ code: false, text: s.slice(start) });
      break;
    }
    out.push({ code: true, text: s.slice(start + 3, end) });
    i = end + 3;
  }
  if (out.length === 0) out.push({ code: false, text: s });
  return out;
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function wrapInline(
  kind: Pair['k'],
  child: React.ReactNode,
  key: string,
  palette: WhatsAppBubblePalette,
  tone: WhatsAppBubbleTone,
): React.ReactElement {
  const codeBg = tone === 'outgoing' ? palette.codeBgOutgoing : palette.codeBgIncoming;
  switch (kind) {
    case 'bold':
      return (
        <Text key={key} style={{ fontWeight: '700' }}>
          {child}
        </Text>
      );
    case 'italic':
      return (
        <Text key={key} style={{ fontStyle: 'italic' }}>
          {child}
        </Text>
      );
    case 'strike':
      return (
        <Text key={key} style={{ textDecorationLine: 'line-through', opacity: 0.88 }}>
          {child}
        </Text>
      );
    case 'mono1':
      return (
        <Text
          key={key}
          style={{
            fontFamily: mono,
            fontSize: 13.8,
            backgroundColor: codeBg,
            borderRadius: 4,
            paddingHorizontal: 4,
            paddingVertical: 1,
          }}
        >
          {child}
        </Text>
      );
    case 'mono3':
      return (
        <Text
          key={key}
          style={{
            fontFamily: mono,
            fontSize: 13.8,
            backgroundColor: codeBg,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          {child}
        </Text>
      );
    default:
      return <Text key={key}>{child}</Text>;
  }
}

function formatWhatsAppInline(
  s: string,
  keyPath: string,
  palette: WhatsAppBubblePalette,
  tone: WhatsAppBubbleTone,
): React.ReactElement {
  const p = firstInlinePair(s);
  if (!p) {
    return <Text key={keyPath}>{s}</Text>;
  }
  const openLen = p.o.length;
  const closeLen = p.c.length;
  const before = s.slice(0, p.i);
  const inner = s.slice(p.i + openLen, p.j);
  const after = s.slice(p.j + closeLen);
  const innerNode = formatWhatsAppInline(inner, `${keyPath}-in`, palette, tone);
  const wrapped = wrapInline(p.k, innerNode, `${keyPath}-w`, palette, tone);
  return (
    <Text key={keyPath}>
      {before}
      {wrapped}
      {after ? formatWhatsAppInline(after, `${keyPath}-a`, palette, tone) : null}
    </Text>
  );
}

function formatLine(
  line: string,
  key: string,
  palette: WhatsAppBubblePalette,
  tone: WhatsAppBubbleTone,
): React.ReactElement {
  const bullet = line.match(/^\s*([*-])\s+(.*)$/);
  if (bullet) {
    return (
      <Text key={key}>
        <Text style={{ opacity: 0.72 }}>• </Text>
        {formatWhatsAppInline(bullet[2] || '', `${key}-b`, palette, tone)}
      </Text>
    );
  }
  const num = line.match(/^\s*(\d+)\.\s+(.*)$/);
  if (num) {
    return (
      <Text key={key}>
        <Text style={{ opacity: 0.82 }}>{`${num[1]}.`} </Text>
        {formatWhatsAppInline(num[2] || '', `${key}-n`, palette, tone)}
      </Text>
    );
  }
  const quote = line.match(/^\s*>\s+(.*)$/);
  if (quote) {
    const qBorder = tone === 'outgoing' ? palette.quoteBorderOutgoing : palette.quoteBorderIncoming;
    return (
      <Text
        key={key}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: qBorder,
          paddingLeft: 8,
          marginVertical: 2,
        }}
      >
        {formatWhatsAppInline(quote[1] || '', `${key}-q`, palette, tone)}
      </Text>
    );
  }
  return (
    <Text key={key}>
      {formatWhatsAppInline(line, `${key}-i`, palette, tone)}
    </Text>
  );
}

function formatLinesSegmentNodes(
  s: string,
  keyBase: string,
  palette: WhatsAppBubblePalette,
  tone: WhatsAppBubbleTone,
): React.ReactNode[] {
  const lines = s.split('\n');
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push('\n');
    out.push(formatLine(line, `${keyBase}-L${i}`, palette, tone));
  });
  return out;
}

function formatWhatsAppRichChildren(
  s: string,
  keyBase: string,
  palette: WhatsAppBubblePalette,
  tone: WhatsAppBubbleTone,
): React.ReactNode[] {
  const chunks = splitCodeFenceSegments(s);
  const fenceBg = tone === 'outgoing' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)';
  const nodes: React.ReactNode[] = [];
  chunks.forEach((chunk, idx) => {
    if (chunk.code) {
      nodes.push(
        <Text
          key={`${keyBase}-f-${idx}`}
          style={{
            fontFamily: mono,
            fontSize: 13.5,
            lineHeight: 19,
            backgroundColor: fenceBg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 6,
            marginVertical: 4,
            color: palette.base,
          }}
        >
          {'\n'}
          {chunk.text}
          {'\n'}
        </Text>,
      );
    } else if (chunk.text) {
      nodes.push(...formatLinesSegmentNodes(chunk.text, `${keyBase}-ln-${idx}`, palette, tone));
    }
  });
  return nodes;
}

const baseText: StyleProp<TextStyle> = {
  fontSize: 15,
  lineHeight: 20,
  fontWeight: '400',
  /** Required on react-native-web so `\n` between nested `<Text>` nodes creates real breaks. */
  whiteSpace: 'pre-wrap',
};

type Props = {
  messageId: string;
  rawHtml: string;
  sent: boolean;
  palette: WhatsAppBubblePalette;
  style?: StyleProp<TextStyle>;
};

/**
 * WhatsApp-style body: *bold* / _italic_ / ~strike~ / `code` / ```blocks``` / lists / > quotes,
 * plus tappable http(s) links — mirrors web `LinkifiedMessageText` + `formatWhatsAppRichText`.
 */
export function LinkifiedWhatsAppBubbleText({ messageId, rawHtml, sent, palette, style }: Props) {
  const tone: WhatsAppBubbleTone = sent ? 'outgoing' : 'incoming';
  const plain = stripHtmlForMessageBody(rawHtml || '');
  const pieces = splitTextWithUrls(plain);

  const children = pieces.flatMap((seg, i) => {
    if (seg.kind === 'url') {
      return [
        <Text
          key={`${messageId}-u-${i}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(seg.value)}
          style={{
            color: palette.link,
            textDecorationLine: 'underline',
            fontWeight: '600',
            fontSize: 15,
            lineHeight: 20,
          }}
        >
          {seg.value}
        </Text>,
      ];
    }
    return formatWhatsAppRichChildren(seg.value, `${messageId}-t-${i}`, palette, tone);
  });

  return (
    <Text style={[baseText, { color: palette.base }, style]} selectable>
      {children}
    </Text>
  );
}
