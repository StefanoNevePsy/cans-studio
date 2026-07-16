import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const iconFiles = [
  join(root, "android", "app", "src", "main", "res", "mipmap-anydpi-v26", "ic_launcher.xml"),
  join(root, "android", "app", "src", "main", "res", "mipmap-anydpi-v26", "ic_launcher_round.xml"),
];

for (const file of iconFiles) {
  let xml = readFileSync(file, "utf8");

  xml = xml.replace(/<foreground android:drawable="@mipmap\/ic_launcher_foreground"\s*\/>/g, '<foreground android:drawable="@drawable/ic_launcher_foreground"/>');

  if (!xml.includes("<monochrome ")) {
    xml = xml.replace("</adaptive-icon>", '    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>');
  }

  writeFileSync(file, xml);
}
