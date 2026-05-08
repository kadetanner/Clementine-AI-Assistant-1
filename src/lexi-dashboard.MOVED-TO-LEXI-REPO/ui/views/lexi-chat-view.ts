/**
 * Lexi Chat — daemon-CLI subprocess streamed via SSE. Free-only.
 *
 * Uses an EventSource connected to /api/lexi-chat/stream/:id while POSTs
 * /api/lexi-chat/send drive new turns.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-textarea.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';
import '../design/primitives/lx-icon.js';

interface Turn {
  ts: number;
  role: 'user' | 'agent';
  content: string;
}

export class LexiChatView extends LitElement {
  static properties = {
    sessionId: { state: true },
    turns: { state: true },
    input: { state: true },
    sending: { state: true },
    streamMode: { state: true },
  };
  declare sessionId: string;
  declare turns: Turn[];
  declare input: string;
  declare sending: boolean;
  declare streamMode: 'stub' | 'cli' | 'idle';

  private eventSource: EventSource | null = null;

  constructor() {
    super();
    this.sessionId = '';
    this.turns = [];
    this.input = '';
    this.sending = false;
    this.streamMode = 'idle';
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.start();
  }

  disconnectedCallback(): void {
    this.eventSource?.close();
    super.disconnectedCallback();
  }

  async start(): Promise<void> {
    try {
      const r = await fetch('/api/lexi-chat/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'default' }) });
      const j = await r.json();
      this.sessionId = j.sessionId;
      this.openStream();
    } catch (err) {
      console.error('chat start failed', err);
    }
  }

  private openStream(): void {
    if (!this.sessionId) return;
    this.eventSource?.close();
    const es = new EventSource(`/api/lexi-chat/stream/${this.sessionId}`);
    this.eventSource = es;
    let pendingChunks = '';
    es.addEventListener('user', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      this.turns = [...this.turns, { ts: Date.now(), role: 'user', content: data.content }];
    });
    es.addEventListener('chunk', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      pendingChunks += data.content;
      // Live-append: replace last 'agent' turn or push a new one.
      const last = this.turns[this.turns.length - 1];
      if (last && last.role === 'agent' && (last as Turn & { _streaming?: boolean })._streaming) {
        this.turns = [
          ...this.turns.slice(0, -1),
          { ...last, content: pendingChunks },
        ];
      } else {
        this.turns = [...this.turns, { ts: Date.now(), role: 'agent', content: pendingChunks, _streaming: true } as Turn];
      }
      this.streamMode = data.stub ? 'stub' : 'cli';
    });
    es.addEventListener('complete', () => {
      pendingChunks = '';
      // Finalize last agent turn.
      const last = this.turns[this.turns.length - 1];
      if (last && (last as Turn & { _streaming?: boolean })._streaming) {
        this.turns = [...this.turns.slice(0, -1), { ...last, _streaming: false } as Turn];
      }
      this.sending = false;
    });
    es.addEventListener('error', () => {
      this.sending = false;
    });
  }

  private async send(): Promise<void> {
    if (!this.input.trim() || !this.sessionId || this.sending) return;
    this.sending = true;
    try {
      await fetch('/api/lexi-chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, prompt: this.input }),
      });
      this.input = '';
    } catch {
      this.sending = false;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void this.send();
    }
  }

  render(): TemplateResult {
    return html`
      <style>
        .lx-chat-shell {
          display: grid;
          grid-template-rows: auto 1fr auto;
          height: calc(100vh - 80px);
          gap: var(--sp-3);
        }
        .lx-chat-stream {
          overflow: auto;
          padding: var(--sp-3);
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--r-md);
          display: flex;
          flex-direction: column;
          gap: var(--sp-3);
        }
        .lx-turn {
          padding: var(--sp-3);
          border-radius: var(--r-md);
          max-width: 80ch;
          font-size: var(--text-sm);
          white-space: pre-wrap;
          line-height: 1.55;
        }
        .lx-turn[data-role='user'] {
          background: var(--accent-soft); color: var(--text-primary);
          align-self: flex-end;
          border-top-right-radius: var(--r-sm);
        }
        .lx-turn[data-role='agent'] {
          background: var(--surface-2); color: var(--text-primary);
          align-self: flex-start;
          border-top-left-radius: var(--r-sm);
        }
        .lx-chat-composer {
          display: flex; gap: var(--sp-2); align-items: flex-end;
          padding: var(--sp-3);
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--r-md);
        }
        .lx-chat-composer lx-textarea { flex: 1; }
        .lx-mode-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.5px;
          color: var(--text-tertiary);
        }
      </style>
      <div class="lx-view-head">
        <div>
          <h1>Chat</h1>
          <p class="subtitle">
            Daemon-CLI streamed conversation. Free-only — no paid API calls.
            ${this.streamMode === 'stub'
              ? html`<lx-badge tone="warning" style="margin-left:8px;">stub</lx-badge>`
              : this.streamMode === 'cli'
                ? html`<lx-badge tone="positive" style="margin-left:8px;">live cli</lx-badge>`
                : ''}
          </p>
        </div>
        <span class="lx-mode-tag">session: ${this.sessionId || '…'}</span>
      </div>
      <div class="lx-chat-shell">
        <div></div>
        <div class="lx-chat-stream">
          ${this.turns.length === 0
            ? html`<lx-empty-state
                icon="chat"
                title="Start a conversation"
                desc="Type a prompt below. ⌘↩ to send. The daemon CLI processes the turn locally."
              ></lx-empty-state>`
            : this.turns.map(
                (t) => html`<div class="lx-turn" data-role=${t.role}>
                  ${t.content}
                </div>`,
              )}
        </div>
        <div class="lx-chat-composer">
          <lx-textarea
            .value=${this.input}
            placeholder="Ask anything…"
            rows="2"
            @input=${(e: CustomEvent<string>) => { this.input = e.detail; }}
            @keydown=${(e: KeyboardEvent) => this.onKey(e)}
          ></lx-textarea>
          <lx-button
            variant="primary"
            icon="send"
            ?loading=${this.sending}
            ?disabled=${!this.input.trim() || !this.sessionId}
            @click=${() => void this.send()}
          >Send</lx-button>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('lexi-chat-view')) {
  customElements.define('lexi-chat-view', LexiChatView);
}
