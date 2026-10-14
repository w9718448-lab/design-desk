const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");
export default { join };
export { join };
