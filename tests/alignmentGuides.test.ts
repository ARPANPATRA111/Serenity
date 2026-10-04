import { describe, expect, test } from 'vitest';
import { findNearestSnap } from '../src/lib/fabric/alignmentGeometry';

describe('alignment guide geometry', () => {
  test('selects the closest candidate inside the zoom-adjusted threshold', () => {
    expect(findNearestSnap(98, [{ value: 100, guide: 100 }, { value: 95, guide: 95 }], 5))
      .toEqual({ delta: 2, guide: 100 });
  });

  test('does not snap outside the threshold', () => {
    expect(findNearestSnap(90, [{ value: 100, guide: 100 }], 5)).toBeNull();
  });
});
