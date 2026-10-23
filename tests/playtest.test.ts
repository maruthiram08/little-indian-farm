import { describe, expect, it } from 'vitest';
import { addPlayTime, clock, newLog, record, report, restoreLog } from '../src/game/playtest';

describe('playtest report', () => {
  it('times milestones by active play time', () => {
    const log = newLog(0);
    addPlayTime(log, 4.4);
    record(log, 'plant');
    addPlayTime(log, 10);
    record(log, 'harvest');
    record(log, 'harvest');
    addPlayTime(log, 75);
    record(log, 'order');
    record(log, 'level', '2');
    const text = report(log, 'Pixel 6, 412×915');
    expect(text).toContain('Play time: 1:29 over 1 session');
    expect(text).toContain('- First planting: 0:04');
    expect(text).toContain('- First harvest: 0:14');
    expect(text).toContain('- Level 2: 1:29');
    expect(text).toContain('- Level 3: not yet');
    expect(text).toContain('Harvests: 2');
    expect(text).toContain('Device: Pixel 6, 412×915');
  });

  it('counts a reopened game as a new session and keeps its entries', () => {
    const log = newLog(0);
    record(log, 'plant');
    const reopened = restoreLog(JSON.parse(JSON.stringify(log)), 1000);
    expect(reopened.sessions).toBe(2);
    expect(reopened.entries.length).toBe(1);
    expect(restoreLog(null, 5).sessions).toBe(1);
  });

  it('formats clock times', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(61)).toBe('1:01');
    expect(clock(905)).toBe('15:05');
  });
});
