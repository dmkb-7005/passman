/*
 * Where the Logins list was: search text and scroll position, so coming back from a login (back button,
 * chevron or the Logins tab) shows the same place. In memory only; forgotten when the vault locks.
 */

const memory = { query: '', scrollTop: 0 };

export const listMemory = {
  get query() {
    return memory.query;
  },
  get scrollTop() {
    return memory.scrollTop;
  },
  setQuery(query: string) {
    if (query !== memory.query) memory.scrollTop = 0;
    memory.query = query;
  },
  setScrollTop(top: number) {
    memory.scrollTop = top;
  },
};

export function forgetListView(): void {
  memory.query = '';
  memory.scrollTop = 0;
}
