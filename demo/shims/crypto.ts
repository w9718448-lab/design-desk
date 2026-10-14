const bytes = (n: number) => { const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b); return b; };
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
function randomBytes(n: number) { const b = bytes(n); return { toString: () => hex(b) }; }
// 只用于脑图里“同一个节点每次得到同一组词”，不需要真的 md5。
function createHash() {
  let text = "";
  const api = {
    update(value: string) { text += value; return api; },
    digest() {
      const out = new Uint8Array(16);
      let h = 2166136261;
      for (let i = 0; i < 16; i++) { for (const c of text + i) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } out[i] = h & 255; }
      return out;
    },
  };
  return api;
}
const randomUUID = () => globalThis.crypto.randomUUID();
export default { randomBytes, createHash, randomUUID };
export { randomBytes, createHash, randomUUID };
