import React, { useCallback, useEffect, useRef } from 'react';

import { childName, type MyChild, useMyChildren } from '@/hooks/useMyChildren';
import MemberCustomFields from './MemberCustomFields';

/** One child's card. Its dirty callback is stable (`useCallback` on the child's id), so nothing re-runs on parent renders. */
function ChildCard({ clubId, child, onDirty }: { clubId: string; child: MyChild; onDirty: (id: string, dirty: boolean) => void }) {
  const id = child.clubMemberId;
  const handle = useCallback((dirty: boolean) => onDirty(id, dirty), [onDirty, id]);
  return <MemberCustomFields clubId={clubId} target={id} guardianOfName={childName(child)} card onDirtyChange={handle} />;
}

/**
 * Guardian section of the Profil tab: for every child the caller is an active guardian of, the child's additional details
 * (`MemberCustomFields` with the child's `club_members.id`, editable where the server allows: `editable_by = self`, visible
 * to members, not protected). Renders nothing for everybody else (no children, any error, still loading): the server decides.
 * Unsaved edits of any child are reported as one flag so the parent can guard leaving the tab; the set of dirty children is a
 * ref, no state, so reporting never re-renders this component.
 */
export default function ChildrenCustomFields({ clubId, onDirtyChange }: { clubId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const { children } = useMyChildren(clubId);
  const dirtyIds = useRef(new Set<string>());
  const report = useRef(onDirtyChange);
  report.current = onDirtyChange;

  useEffect(() => {
    const ids = dirtyIds.current;
    return () => {
      ids.clear();
      report.current?.(false);
    };
  }, []);

  const onDirty = useCallback((id: string, dirty: boolean) => {
    const ids = dirtyIds.current;
    if (dirty === ids.has(id)) return;
    if (dirty) ids.add(id);
    else ids.delete(id);
    report.current?.(ids.size > 0);
  }, []);

  if (children.length === 0) return null;
  return (
    <>
      {children.map((c) => (
        <ChildCard key={`${clubId}|${c.clubMemberId}`} clubId={clubId} child={c} onDirty={onDirty} />
      ))}
    </>
  );
}
