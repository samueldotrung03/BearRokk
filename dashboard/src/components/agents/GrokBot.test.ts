import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GrokBot } from './GrokBot.tsx';

describe('GrokBot', () => {
  it('draws a bot for every agent level, with two eyes and the agent state on it', () => {
    for (const level of ['master', 'manager', 'worker', 'validator', 'presenter'] as const) {
      const html = renderToStaticMarkup(createElement(GrokBot, { level, status: 'working', size: 40 }));
      expect(html).toContain(`data-level="${level}"`);
      expect(html).toContain('data-status="working"');
      expect(html.match(/class="gk-eye"/g)).toHaveLength(2);
    }
  });
});
