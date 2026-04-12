export type SaiketsuStoredVersion = {
  id: string;
  contentHash: string | null;
  eTag: string | null;
  lastModified: string | null;
  version: number | null;
};

export type SaiketsuFetchedVersion = {
  id: string;
  contentHash: string;
  eTag: string | null;
  lastModified: string | null;
};

export function detectSaiketsuChange({
  current,
  next,
}: {
  current: SaiketsuStoredVersion | null;
  next: SaiketsuFetchedVersion;
}) {
  if (current === null) {
    return { changed: true, reason: "new", version: 1 } as const;
  }

  if (current.eTag && next.eTag && current.eTag === next.eTag) {
    return { changed: false, reason: "etag", version: current.version ?? 1 } as const;
  }

  if (
    current.lastModified &&
    next.lastModified &&
    current.lastModified === next.lastModified
  ) {
    return {
      changed: false,
      reason: "last_modified",
      version: current.version ?? 1,
    } as const;
  }

  if (current.contentHash === next.contentHash) {
    return {
      changed: false,
      reason: "content_hash",
      version: current.version ?? 1,
    } as const;
  }

  return {
    changed: true,
    reason: "content_hash",
    version: (current.version ?? 0) + 1,
  } as const;
}
