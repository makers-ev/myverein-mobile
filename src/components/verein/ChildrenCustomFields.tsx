import React, { useCallback, useEffect, useRef, useState } from 'react';

import { childName, useMyChildren } from '@/hooks/useMyChildren';
import MemberCustomFields from './MemberCustomFields';

/**
 * Guardian section of the Profil tab: for every child the caller is an active guardian of, the child's additional details
 * (`MemberCustomFields` with the child's `club_members.id`, editable where the server allows: `editable_by = self`, visible
 * to members, not protected). Renders nothing for everybody else (no children, any error, still loading): the server decides.
 * Unsaved edits of any child are reported as one flag so the parent can guard leaving the tab.
 */
export default function ChildrenCustomFields({ clubId, onDirtyChange }: { clubId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const { children } = useMyChildren(clubId);
  const dirtyIds = useRef(new Set<string>());
  const [, force] = useState(0);

  const report = useCallback(() => onDirtyChange?.(dirtyIds.current.size > 0), [onDirtyChange]);
  useEffect(() => {
    const ids = dirtyIds.current;
    return () => {
      ids.clear();
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  const handle = useCallback(
    (id: string) => (dirty: boolean) => {
      if (dirty === dirtyIds.current.has(id)) return;
      if (dirty) dirtyIds.current.add(id);
      else dirtyIds.current.delete(id);
      report();
      force((n) => n + 1);
    },
    [report],
  );

  if (children.length === 0) return null;
  return (
    <>
      {children.map((c) => (
        <MemberCustomFields key={`${clubId}|${c.clubMemberId}`} clubId={clubId} target={c.clubMemberId} guardianOfName={childName(c)} card onDirtyChange={handle(c.clubMemberId)} />
      ))}
    </>
  );
}
