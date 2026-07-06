// Convertit des fichiers image (input type="file") en base64, pour l'envoyer à Claude Vision.
export function readImagesAsBase64(fileList) {
  return Promise.all(
    Array.from(fileList || [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 5)
      .map(
        (f) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ media_type: f.type, data: String(reader.result).split(",")[1] });
            reader.onerror = () => reject(new Error("read"));
            reader.readAsDataURL(f);
          })
      )
  );
}
