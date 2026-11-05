// Catalogo sticker: per aggiungerne uno metti un PNG/WebP/SVG same-origin in public/stickers
// (gli SVG devono avere width e height espliciti) e aggiungi una riga qui.
export interface Sticker {
  id: string;
  label: string;
  src: string;
}

export const STICKERS: Sticker[] = [
  { id: "gol", label: "Gol!", src: "/stickers/gol.svg" },
  { id: "mvp", label: "MVP", src: "/stickers/mvp.svg" },
  { id: "forza", label: "Forza!", src: "/stickers/forza.svg" },
  { id: "pallone", label: "Pallone", src: "/stickers/pallone.svg" },
  { id: "coppa", label: "Coppa", src: "/stickers/coppa.svg" },
  { id: "fuoco", label: "Fuoco", src: "/stickers/fuoco.svg" },
  { id: "cuore", label: "Cuore", src: "/stickers/cuore.svg" },
  { id: "cartellino", label: "Cartellini", src: "/stickers/cartellino.svg" },
];

export function loadStickerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Sticker non caricato: ${src}`));
    img.src = src;
  });
}
