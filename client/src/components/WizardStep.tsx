// ============================================================
// WizardStep — Composant réutilisable pour les étapes du wizard
// Inclut: barre de progression, navigation, drawer "Aller à"
// ============================================================

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, List, X, Camera, Plus, Trash2, ZoomIn, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnotatedPhoto } from "@/lib/types";
import { generateId } from "@/lib/types";

interface Step {
  id: number;
  title: string;
}

interface WizardStepProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinalize?: () => void;
  isLast: boolean;
  isFirst: boolean;
  title: string;
  sectionNumber: string;
  children: React.ReactNode;
  locked?: boolean;
  /** Affiche "Config." au lieu de "Précédent" à la première étape (défaut: false) */
  showConfigOnFirst?: boolean;
}

export function WizardStep({
  steps,
  currentStep,
  onStepChange,
  onPrevious,
  onNext,
  onFinalize,
  isLast,
  isFirst,
  title,
  sectionNumber,
  children,
  locked = false,
  showConfigOnFirst = false,
}: WizardStepProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Barre de progression */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, background: "#DCF21E" }}
        />
      </div>

      {/* En-tête de l'étape */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A7049" }}>
              {sectionNumber}
            </div>
            <h2 className="font-bold text-base text-gray-900 leading-tight truncate">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <span className="text-xs text-gray-400 font-medium">
              {currentStep}/{steps.length}
            </span>
            {/* Bouton Finaliser rapide (depuis n'importe quelle étape) */}
            {!isLast && !locked && onFinalize && (
              <button
                onClick={onFinalize}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "#003D39", color: "#DCF21E", border: "1px solid #004d47" }}
                title="Aller directement à la finalisation"
              >
                <Flag size={12} />
                Finaliser
              </button>
            )}
            {/* Bouton Aller directement à */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "#F5F0EA", color: "#003D39", border: "1px solid #DDCCBF" }}
            >
              <List size={13} />
              Aller à
            </button>
          </div>
        </div>
      </div>

      {/* Contenu de l'étape */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {locked && (
          <div
            className="mb-4 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "#F5F0EA", color: "#8A7049", border: "1px solid #DDCCBF" }}
          >
            Ce rapport est verrouillé — consultation uniquement.
          </div>
        )}
        {children}
      </div>

      {/* Navigation Précédent / Suivant */}
      <div
        className="flex gap-3 px-4 py-3 border-t"
        style={{ borderColor: "#e8e0d8", background: "white" }}
      >
        <button
          onClick={onPrevious}
          disabled={isFirst && locked}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-30"
          style={{ background: "#F5F0EA", color: "#003D39", border: "1px solid #DDCCBF" }}
        >
          <ChevronLeft size={16} />
          {isFirst && !locked && showConfigOnFirst ? "Config." : "Précédent"}
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
          style={{
            background: isLast ? "#DCF21E" : "#003D39",
            color: isLast ? "#003D39" : "#DCF21E",
          }}
        >
          {isLast ? "Finaliser" : "Suivant"}
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Drawer "Aller directement à" */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <div
            className="w-72 max-w-[85vw] h-full overflow-y-auto shadow-2xl"
            style={{ background: "white" }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-4 py-3 border-b"
              style={{ background: "#003D39", borderColor: "#004d47" }}
            >
              <span className="font-semibold text-sm" style={{ color: "#DCF21E" }}>
                Aller directement à
              </span>
              <button onClick={() => setDrawerOpen(false)} style={{ color: "#F5F0EA" }}>
                <X size={18} />
              </button>
            </div>
            <div className="py-2">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => {
                    onStepChange(step.id);
                    setDrawerOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                    step.id === currentStep
                      ? "bg-[#F5F0EA]"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: step.id === currentStep ? "#003D39" : step.id < currentStep ? "#DCF21E" : "#DDCCBF",
                      color: step.id === currentStep ? "#DCF21E" : step.id < currentStep ? "#003D39" : "#8A7049",
                    }}
                  >
                    {step.id}
                  </div>
                  <span
                    className={cn(
                      "text-sm leading-snug",
                      step.id === currentStep ? "font-semibold text-gray-900" : "text-gray-600"
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Composants de formulaire réutilisables
// ============================================================

interface YesNoRadioProps {
  label: string;
  value: "oui" | "non" | "na" | "";
  onChange: (v: "oui" | "non" | "na") => void;
  disabled?: boolean;
  showNA?: boolean; // Afficher le bouton Non-applicable
}

export function YesNoRadio({ label, value, onChange, disabled, showNA = false }: YesNoRadioProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="flex gap-2 flex-wrap">
        {/* OUI — fond vert foncé, texte vert pâle */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("oui")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: value === "oui" ? "#003D39" : "#F5F0EA",
            color: value === "oui" ? "#DCF21E" : "#8A7049",
            border: `2px solid ${value === "oui" ? "#003D39" : "#DDCCBF"}`,
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: value === "oui" ? "#DCF21E" : "#DDCCBF",
              background: value === "oui" ? "#DCF21E" : "transparent",
            }}
          >
            {value === "oui" && <div className="w-2 h-2 rounded-full" style={{ background: "#003D39" }} />}
          </div>
          OUI
        </button>

        {/* NON — fond vert pâle, texte vert foncé */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("non")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: value === "non" ? "#DCF21E" : "#F5F0EA",
            color: value === "non" ? "#003D39" : "#8A7049",
            border: `2px solid ${value === "non" ? "#DCF21E" : "#DDCCBF"}`,
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: value === "non" ? "#003D39" : "#DDCCBF",
              background: value === "non" ? "#003D39" : "transparent",
            }}
          >
            {value === "non" && <div className="w-2 h-2 rounded-full" style={{ background: "#DCF21E" }} />}
          </div>
          NON
        </button>

        {/* NON-APPLICABLE — brun sable */}
        {showNA && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("na")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: value === "na" ? "#DDCCBF" : "#F5F0EA",
              color: "#8A7049",
              border: `2px solid ${value === "na" ? "#8A7049" : "#DDCCBF"}`,
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                borderColor: value === "na" ? "#8A7049" : "#DDCCBF",
                background: value === "na" ? "#8A7049" : "transparent",
              }}
            >
              {value === "na" && <div className="w-2 h-2 rounded-full" style={{ background: "#DDCCBF" }} />}
            </div>
            N/A
          </button>
        )}
      </div>
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function CheckboxField({ label, checked, onChange, disabled }: CheckboxFieldProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full py-2 text-left disabled:opacity-50"
    >
      <div
        className="flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all"
        style={{
          background: checked ? "#003D39" : "white",
          borderColor: checked ? "#003D39" : "#DDCCBF",
        }}
      >
        {checked && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4L4.5 7.5L11 1" stroke="#DCF21E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700 leading-snug">{label}</span>
    </button>
  );
}

interface ValueInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  type?: "text" | "number";
  disabled?: boolean;
}

export function ValueInput({ label, value, onChange, unit, placeholder, type = "text", disabled }: ValueInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Valeur..."}
          disabled={disabled}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-gray-50"
          style={{ borderColor: "#DDCCBF" }}
        />
        {unit && (
          <div
            className="flex items-center px-3 rounded-lg text-sm font-semibold"
            style={{ background: "#F5F0EA", color: "#8A7049", border: "1px solid #DDCCBF" }}
          >
            {unit}
          </div>
        )}
      </div>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export function TextAreaField({ label, value, onChange, placeholder, disabled, rows = 3 }: TextAreaFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Commentaires..."}
        disabled={disabled}
        rows={rows}
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 resize-none disabled:opacity-50 disabled:bg-gray-50"
        style={{ borderColor: "#DDCCBF" }}
      />
    </div>
  );
}

interface SectionDividerProps {
  title: string;
}

export function SectionDivider({ title }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ background: "#DDCCBF" }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A7049" }}>
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: "#DDCCBF" }} />
    </div>
  );
}

// ============================================================
// PhotoGallery — Capture et gestion des photos
// ============================================================

interface PhotoGalleryProps {
  photos: AnnotatedPhoto[];
  onChange: (photos: AnnotatedPhoto[]) => void;
  disabled?: boolean;
  label?: string;
}

export function PhotoGallery({ photos, onChange, disabled, label = "Photographies" }: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () => setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  // Convertit n'importe quel format d'image en JPEG via canvas
  // Garantit la compatibilité avec jsPDF (HEIC, WEBP, PNG, etc.)
  const convertToJpeg = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const originalDataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            // Limiter la résolution à 1600px max pour éviter les PDF trop lourds
            const maxSize = 1600;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxSize || h > maxSize) {
              if (w > h) { h = Math.round((h * maxSize) / w); w = maxSize; }
              else { w = Math.round((w * maxSize) / h); h = maxSize; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            // Fond blanc (pour les PNG avec transparence)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            // Compression itérative pour rester sous 1 MB
            const MAX_BYTES = 1 * 1024 * 1024; // 1 MB
            let quality = 0.85;
            let dataUrl = canvas.toDataURL("image/jpeg", quality);
            // base64 représente ~133% de la taille binaire réelle
            while (dataUrl.length > MAX_BYTES * 1.37 && quality > 0.3) {
              quality = Math.max(0.3, quality - 0.1);
              dataUrl = canvas.toDataURL("image/jpeg", quality);
            }
            // Si toujours trop grand, réduire aussi la résolution
            if (dataUrl.length > MAX_BYTES * 1.37) {
              const scale = Math.sqrt((MAX_BYTES * 1.37) / dataUrl.length);
              const w2 = Math.round(w * scale);
              const h2 = Math.round(h * scale);
              const canvas2 = document.createElement("canvas");
              canvas2.width = w2;
              canvas2.height = h2;
              const ctx2 = canvas2.getContext("2d")!;
              ctx2.fillStyle = "#ffffff";
              ctx2.fillRect(0, 0, w2, h2);
              ctx2.drawImage(canvas, 0, 0, w2, h2);
              dataUrl = canvas2.toDataURL("image/jpeg", 0.7);
            }
            resolve(dataUrl);
          } catch (e) {
            // Fallback : utiliser le dataUrl original
            resolve(originalDataUrl);
          }
        };
        img.onerror = () => resolve(originalDataUrl);
        img.src = originalDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newPhotos: AnnotatedPhoto[] = [];
    for (const file of files) {
      try {
        const dataUrl = await convertToJpeg(file);
        newPhotos.push({
          id: generateId(),
          dataUrl,
          caption: "",
          takenAt: new Date().toISOString(),
        });
      } catch {
        console.warn("[PhotoGallery] Erreur conversion photo:", file.name);
      }
    }
    if (newPhotos.length > 0) onChange([...photos, ...newPhotos]);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {!disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            <Camera size={13} />
            Ajouter
          </button>
        )}
      </div>

      {/* Deux inputs : un pour la caméra, un pour la galerie */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {photos.length === 0 ? (
        !disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-colors hover:border-gray-400"
            style={{ borderColor: "#DDCCBF" }}
          >
            <Camera size={24} color="#DDCCBF" />
            <span className="text-xs text-gray-400">Appuyez pour prendre ou importer une photo</span>
          </button>
        )
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative group">
              {/* Miniature cliquable */}
              <button
                type="button"
                onClick={() => openLightbox(index)}
                className="w-full aspect-square rounded-lg overflow-hidden relative block"
                style={{ border: "1px solid #DDCCBF" }}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover"
                />
                {/* Overlay zoom au survol */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,61,57,0.4)" }}>
                  <ZoomIn size={20} color="white" />
                </div>
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(photo.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md z-10"
                  style={{ background: "#ef4444" }}
                >
                  <Trash2 size={11} color="white" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg flex items-center justify-center border-2 border-dashed transition-colors"
              style={{ borderColor: "#DDCCBF" }}
            >
              <Plus size={20} color="#DDCCBF" />
            </button>
          )}
        </div>
      )}

      {/* Lightbox plein écran */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={closeLightbox}
        >
          {/* Header lightbox */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: "rgba(0,61,57,0.9)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-medium" style={{ color: "#DCF21E" }}>
              Photo {lightboxIndex + 1} / {photos.length}
            </span>
            {photos[lightboxIndex].caption && (
              <span className="text-xs text-white opacity-75 mx-4 flex-1 text-center truncate">
                {photos[lightboxIndex].caption}
              </span>
            )}
            <button
              type="button"
              onClick={closeLightbox}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <X size={16} color="white" />
            </button>
          </div>

          {/* Image principale */}
          <div
            className="flex-1 flex items-center justify-center p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton précédent */}
            {lightboxIndex > 0 && (
              <button
                type="button"
                onClick={prevPhoto}
                className="absolute left-2 w-10 h-10 rounded-full flex items-center justify-center z-10"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <ChevronLeft size={20} color="white" />
              </button>
            )}

            <img
              src={photos[lightboxIndex].dataUrl}
              alt={photos[lightboxIndex].caption || "Photo"}
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: "calc(100vh - 120px)" }}
            />

            {/* Bouton suivant */}
            {lightboxIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={nextPhoto}
                className="absolute right-2 w-10 h-10 rounded-full flex items-center justify-center z-10"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <ChevronRight size={20} color="white" />
              </button>
            )}
          </div>

          {/* Indicateurs de navigation (points) */}
          {photos.length > 1 && (
            <div
              className="flex justify-center gap-1.5 pb-4 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === lightboxIndex ? "#DCF21E" : "rgba(255,255,255,0.4)",
                    transform: i === lightboxIndex ? "scale(1.3)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
