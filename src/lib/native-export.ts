import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function savePdf(filename: string, blob: Blob) {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve(reader.result!.toString().split(",")[1]);
    reader.readAsDataURL(blob);
  });

  await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });

  const uri = await Filesystem.getUri({
    directory: Directory.Documents,
    path: filename,
  });

  await Share.share({
    title: filename,
    url: uri.uri,
  });
}
