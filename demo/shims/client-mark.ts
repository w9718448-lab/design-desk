// 标记“客户端组件”：渲染页面时只展开服务端组件，客户端组件交给 React 正常渲染。
export const clientComponents = new WeakSet<object>();
export function markClient(...components: unknown[]) {
  for (const component of components) if (typeof component === "function") clientComponents.add(component);
}
