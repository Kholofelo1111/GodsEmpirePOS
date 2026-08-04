import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export async function savePdf(pdf: jsPDF, filename: string) {
  if (!Capacitor.isNativePlatform()) {
    pdf.save(filename);
    return;
  }

  const data = pdf.output("datauristring").split(",")[1];

  const result = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  await Share.share({
    title: filename,
    url: result.uri,
  });
}

export async function saveWorkbook(
  workbook: XLSX.WorkBook,
  filename: string
) {
  if (!Capacitor.isNativePlatform()) {
    XLSX.writeFile(workbook, filename);
    return;
  }

  const base64 = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  });

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  await Share.share({
    title: filename,
    url: result.uri,
  });
}


export async function downloadPdf(url: string, filename: string) {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank");
    return;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");

  const blob = await res.blob();

  const reader = new FileReader();

  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onerror = reject;
    reader.onloadend = () => {
      resolve((reader.result as string).split(",")[1]);
    };
    reader.readAsDataURL(blob);
  });

  const file = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  await Share.share({
    title: filename,
    url: file.uri,
  });
}
