import { describe, it, expect } from 'vitest';
import { extractInteractions } from '../../scripts/audit/inventory-interactions';

describe('extractInteractions', () => {
  it('returns empty list for source with no interactions', () => {
    const src = `import { LitElement, html } from 'lit';
      class X extends LitElement { render() { return html\`<div>static</div>\`; } }`;
    expect(extractInteractions(src)).toEqual([]);
  });

  it('finds @click handlers', () => {
    const src = `html\`<button @click=\${this.onSave}>Save</button>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: '@click', handler: 'onSave', context: 'button' });
  });

  it('finds @input handlers', () => {
    const src = `html\`<textarea @input=\${this.onInput}></textarea>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: '@input', handler: 'onInput', context: 'textarea' });
  });

  it('finds <a> links with href', () => {
    const src = `html\`<a href="#/agents">Agents</a>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: 'link', handler: '#/agents', context: 'a' });
  });

  it('finds buttons without handlers (potentially broken)', () => {
    const src = `html\`<button data-action="restart">Restart</button>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: 'button', handler: 'data-action=restart', context: 'button' });
  });
});
