/**
 * 枠選択の集合 (slot.key の集合) に対するイミュータブル操作。
 * すべての操作は新しい Set を返し、入力を変更しない。
 */

export type Selection = ReadonlySet<string>;

export const EMPTY_SELECTION: Selection = new Set<string>();

/** key の選択状態を反転した新 Set を返す。 */
export function toggle(sel: Selection, key: string): Selection {
  const next = new Set(sel);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

/** 複数 key を追加した新 Set を返す (ドラッグ選択用)。 */
export function addKeys(sel: Selection, keys: Iterable<string>): Selection {
  return new Set<string>([...sel, ...keys]);
}

/** 複数 key を除外した新 Set を返す。 */
export function removeKeys(sel: Selection, keys: Iterable<string>): Selection {
  const drop = new Set(keys);
  return new Set<string>([...sel].filter((k) => !drop.has(k)));
}

/** 空の選択を返す。 */
export function clear(): Selection {
  return new Set<string>();
}

export function isSelected(sel: Selection, key: string): boolean {
  return sel.has(key);
}
