import { applyAttendanceEdit, buildAttendanceEntries, effectiveAttendance, type AttendanceEdits } from './meetingAttendance';

const stored = [{ memberId: 'a', present: true, hasVotingRight: true, proxyForMemberId: null }];

describe('meeting attendance partial updates', () => {
  it('pre-fills from stored rows and defaults', () => {
    expect(effectiveAttendance(stored, {}, 'a').present).toBe(true);
    expect(effectiveAttendance(stored, {}, 'b')).toEqual({ present: false, hasVotingRight: true, proxyForMemberId: null });
  });

  it('sends nothing for untouched rows', () => {
    expect(buildAttendanceEntries({})).toEqual([]);
  });

  it('sends only the edited field', () => {
    let edits: AttendanceEdits = {};
    edits = applyAttendanceEdit(stored, edits, 'a', 'hasVotingRight', false);
    expect(buildAttendanceEntries(edits)).toEqual([{ memberId: 'a', hasVotingRight: false }]);
  });

  it('drops an edit that returns to the stored value', () => {
    let edits: AttendanceEdits = {};
    edits = applyAttendanceEdit(stored, edits, 'a', 'present', false);
    edits = applyAttendanceEdit(stored, edits, 'a', 'present', true);
    expect(edits).toEqual({});
  });

  it('clears a proxy with null and sets one with an id', () => {
    const withProxy = [{ memberId: 'a', present: true, hasVotingRight: true, proxyForMemberId: 'c' }];
    expect(buildAttendanceEntries(applyAttendanceEdit(withProxy, {}, 'a', 'proxyForMemberId', null))).toEqual([
      { memberId: 'a', proxyForMemberId: null },
    ]);
    expect(buildAttendanceEntries(applyAttendanceEdit(stored, {}, 'a', 'proxyForMemberId', 'c'))).toEqual([
      { memberId: 'a', proxyForMemberId: 'c' },
    ]);
  });
});
