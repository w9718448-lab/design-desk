// 展示版的文件：上传的文件变成页面内的临时地址，示例文件从 ./files/ 读取。
const urls = new Map<string, string>();

export function urlOf(folder: string, name: string) {
  return urls.get(name) || `./files/${folder}/${name}`;
}
export function registerUrl(name: string, url: string) { urls.set(name, url); }
export function registerCopy(from: string, to: string) {
  const known = urls.get(from) || (seedFolder.get(from) ? `./files/${seedFolder.get(from)}/${from}` : undefined);
  if (known) urls.set(to, known);
}
export function forgetFile(name: string) { urls.delete(name); }

const seedFolder = new Map<string, string>();
export function registerSeed(folder: string, name: string) { seedFolder.set(name, folder); }
