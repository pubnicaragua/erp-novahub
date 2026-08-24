import { useRef, useState } from "react";
import { Camera, ImagePlus, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "./utils";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ProductThumbnailProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "hero" | "catalog";
  fit?: "cover" | "contain";
  className?: string;
}

const sizes = {
  sm: "size-9 rounded-lg",
  md: "size-12 rounded-xl",
  lg: "size-16 rounded-2xl",
  hero: "size-20 rounded-2xl sm:size-24",
  catalog: "h-36 w-full rounded-2xl",
};

export function ProductThumbnail({
  src,
  alt,
  size = "md",
  fit = "cover",
  className,
}: ProductThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(false);
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-border/70 bg-gradient-to-br from-primary/10 via-muted/40 to-muted shadow-sm",
        sizes[size],
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package
          className={cn(
            "text-primary/45",
            size === "sm" ? "size-4" : size === "hero" || size === "catalog" ? "size-9" : "size-5",
          )}
        />
      )}
    </div>
  );
}

interface ProductImagePickerProps {
  src?: string | null;
  productName?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function ProductImagePicker({
  src,
  productName,
  disabled,
  size = "md",
  className,
  onSelect,
  onRemove,
}: ProductImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Usa una imagen JPG, PNG, WebP, GIF o AVIF");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen original no puede superar los 10 MB");
      return;
    }
    onSelect(file);
  };

  const isSm = size === "sm";

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex items-center justify-center overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isSm ? "size-9 rounded-lg" : "size-16 rounded-2xl",
          src
            ? "border border-border/70 bg-muted shadow-sm hover:border-primary/60"
            : "border border-dashed border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        aria-label={
          src
            ? `Cambiar foto de ${productName || "producto"}`
            : `Agregar foto a ${productName || "producto"}`
        }
        title={src ? "Cambiar foto" : "Agregar foto"}
      >
        {src ? (
          <>
            <img
              src={src}
              alt={productName || "Vista previa del producto"}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className={cn("text-white", isSm ? "size-3.5" : "size-5")} />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center justify-center">
            <ImagePlus className={isSm ? "size-3.5" : "size-5"} />
            {!isSm && (
              <span className="mt-1 text-[8px] font-black uppercase tracking-wider">
                Foto
              </span>
            )}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {src && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-rose-500 shadow-md transition-transform hover:scale-110 hover:bg-rose-700 hover:text-white"
          aria-label="Quitar foto"
          title="Quitar foto"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}
