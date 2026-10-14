// 展示版的示例数据：每次打开页面都从这里开始，改动只留在内存里。
import data from "./seed/design-desk.json";
import files from "./seed/files.json";
import fs from "./shims/fs";
import { registerSeed } from "./shims/files";

export function seed() {
  fs.writeFileSync("/demo/design-desk.json", JSON.stringify(data));
  for (const file of files as Array<{ folder: string; name: string }>) registerSeed(file.folder, file.name);
}
