// Interface components for Experience Quality (경험 품질) analytics:
// connection types, device memory buckets and the reduced-motion preference.
//
// All three dimensions come from optional browser APIs (navigator.connection, navigator.deviceMemory,
// prefers-reduced-motion), so "not reported" is the single most common answer on some browsers.
// Each bucket therefore carries an explicit isUnreported flag taken from the null itself, which is
// what lets the ranked list fold those bars into a footnote instead of ranking a measurement gap
// against real observations (see interfaces/ranked-bars.ts).

import { UNREPORTED_LABEL } from '../tools/dimension-labels.ts';
import type {
  AccessibilitySignalRow,
  ConnectionTypeRow,
  DeviceCapabilityRow,
} from '../tools/tracker-client.ts';
import { createGroupedRanks, type RankedGroup } from './grouped-ranks.ts';

function toMemoryBucketLabel(memoryBucket: string | null): string | null {
  if (memoryBucket === '8-and-above') {
    return '8GB 이상';
  }
  if (memoryBucket === '4-to-7') {
    return '4GB ~ 7GB';
  }
  if (memoryBucket === 'under-4') {
    return '4GB 미만';
  }
  return null;
}

function toReducedMotionLabel(reducedMotion: boolean | null): string | null {
  if (reducedMotion === true) {
    return '모션 줄이기 (On)';
  }
  if (reducedMotion === false) {
    return '기본 모션 (Off)';
  }
  return null;
}

export function createExperienceQualityPanel(context: {
  connectionTypes: ReadonlyArray<ConnectionTypeRow>;
  deviceCapabilities: ReadonlyArray<DeviceCapabilityRow>;
  accessibilitySignals: ReadonlyArray<AccessibilitySignalRow>;
}): HTMLElement {
  const groups: RankedGroup[] = [
    {
      title: '연결 유형 (Connection)',
      emptyText: '연결 유형 데이터가 없습니다.',
      items: context.connectionTypes.map((row) => {
        const reportedLabel = row.effective_type;
        const label = reportedLabel ?? UNREPORTED_LABEL;
        return {
          label,
          fullLabel: `연결 유형: ${label}`,
          value: row.views,
          isUnreported: reportedLabel === null,
        };
      }),
    },
    {
      title: '기기 메모리 (Device Memory)',
      emptyText: '기기 메모리 데이터가 없습니다.',
      items: context.deviceCapabilities.map((row) => {
        const reportedLabel = toMemoryBucketLabel(row.memory_bucket);
        const label = reportedLabel ?? UNREPORTED_LABEL;
        return {
          label,
          fullLabel: `기기 메모리: ${label}`,
          value: row.views,
          isUnreported: reportedLabel === null,
        };
      }),
    },
    {
      title: '접근성 선호 (Reduced Motion)',
      emptyText: '접근성 데이터가 없습니다.',
      items: context.accessibilitySignals.map((row) => {
        const reportedLabel = toReducedMotionLabel(row.reduced_motion);
        const label = reportedLabel ?? UNREPORTED_LABEL;
        return {
          label,
          fullLabel: `모션 감축 선호: ${label}`,
          value: row.views,
          isUnreported: reportedLabel === null,
        };
      }),
    },
  ];

  return createGroupedRanks(groups);
}
