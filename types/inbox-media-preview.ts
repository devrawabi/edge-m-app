export type InboxMediaPreviewRequest =
  | { kind: 'image'; mediaUrl: string }
  | { kind: 'video'; mediaUrl: string }
  | { kind: 'audio'; mediaUrl: string }
  | { kind: 'document'; mediaUrl: string; fileName: string };
