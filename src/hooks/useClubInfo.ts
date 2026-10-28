import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { useScopedResource } from './useScopedResource';

export interface BoardMember {
  memberId: string;
  name: string | null;
  roleType: string;
  termEndsAt: string | null;
}

export interface Department {
  id: string;
  clubId: string;
  name: string;
  leadMemberId: string | null;
}

export interface ClubInfoPage {
  id: string;
  clubId: string;
  slug: string;
  title: string;
  externalUrl: string | null;
  /** Wave 13: the list carries metadata only; the text is fetched per slug (`useClubInfoPage`). */
  hasContent: boolean;
  hasAttachment: boolean;
  /** `YYYY-MM-DD`, the date the current version applies from. */
  validFrom: string | null;
  currentVersion: number;
  updatedAt: string;
}

export interface ClubInfoPageDetail extends ClubInfoPage {
  /** Stored raw: always render through `components/ui/Markdown.tsx` (no HTML, http(s)/mailto links only). */
  contentMarkdown: string | null;
  attachment: { documentId: string; title: string; mimeType: string; sizeBytes: number } | null;
}

interface ClubInfo {
  board: BoardMember[];
  departments: Department[];
  pages: ClubInfoPage[];
}

/** Fetch-shaped hook for `GET /club-info?clubId=`, see README.md's "Adding a new API request". */
export function useClubInfo(clubId: string | null) {
  const [info, setInfo] = useState<ClubInfo | null>(null);
  const [loading, setLoading] = useState(!!clubId);

  const refetch = useCallback(async () => {
    if (!clubId) {
      setInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ClubInfo }>(`/club-info?clubId=${clubId}`);
      setInfo(data);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { info, loading, refetch };
}

/**
 * One club document (`GET /club-info/:slug`) with its Markdown text and PDF attachment info. Loaded only while a reader is
 * open (`slug = null` disables it); the answer is kept together with its path, so another club's or document's text is
 * never shown and only the newest request writes (see `useScopedResource`).
 */
export function useClubInfoPage(clubId: string | null, slug: string | null) {
  const path = clubId && slug ? `/club-info/${encodeURIComponent(slug)}?clubId=${encodeURIComponent(clubId)}` : null;
  const { data, loading, error, reload } = useScopedResource<ClubInfoPageDetail>(path);
  return { page: data, loading, error, reload };
}
