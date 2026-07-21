"use client";

import { useState } from "react";
import { Camera, Upload, Trash2, Maximize2, Image as ImageIcon, Loader2 } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { updateDocById } from "@/lib/db-write";
import { JobCard } from "@/lib/models";
import { useToast, Modal } from "@/components/ui";

interface JobPhotosProps {
  job: JobCard;
  jobId: string;
  canEdit: boolean;
}

export function JobPhotos({ job, jobId, canEdit }: JobPhotosProps) {
  const { notify } = useToast();
  const [uploadingCategory, setUploadingCategory] = useState<"before" | "after" | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);

  const beforePhotos = job.photos?.before || [];
  const afterPhotos = job.photos?.after || [];

  async function handleFileUpload(
    category: "before" | "after",
    files: FileList | null
  ) {
    if (!files || files.length === 0 || !canEdit) return;
    setUploadingCategory(category);

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Basic size check (keep under 5MB per photo for demo/free tier efficiency)
        if (file.size > 5 * 1024 * 1024) {
          notify(`File ${file.name} is too large (> 5MB). Please choose a smaller image.`, "error");
          continue;
        }

        const time = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `job-photos/${jobId}/${category}/${time}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadUrl);
      }

      if (uploadedUrls.length > 0) {
        const currentCategoryPhotos = category === "before" ? beforePhotos : afterPhotos;
        const updatedList = [...currentCategoryPhotos, ...uploadedUrls];

        await updateDocById("jobCards", jobId, {
          photos: {
            before: category === "before" ? updatedList : beforePhotos,
            after: category === "after" ? updatedList : afterPhotos,
          },
        });

        notify(`Uploaded ${uploadedUrls.length} photo(s) to ${category} section.`);
      }
    } catch (err: unknown) {
      console.error(err);
      notify("Failed to upload photo(s) to Storage.", "error");
    } finally {
      setUploadingCategory(null);
    }
  }

  async function handleDeletePhoto(category: "before" | "after", urlToDelete: string) {
    if (!canEdit) return;
    try {
      const currentCategoryPhotos = category === "before" ? beforePhotos : afterPhotos;
      const updatedList = currentCategoryPhotos.filter((url) => url !== urlToDelete);

      await updateDocById("jobCards", jobId, {
        photos: {
          before: category === "before" ? updatedList : beforePhotos,
          after: category === "after" ? updatedList : afterPhotos,
        },
      });

      notify("Photo removed.");
    } catch {
      notify("Could not remove photo.", "error");
    }
  }

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center gap-3 border-b border-line pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-50 text-burgundy-600">
          <Camera size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-ink">Before & After Photos</h3>
          <p className="text-xs text-ink-soft">Attach vehicle photos before and after work is performed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE SECTION */}
        <PhotoSection
          title="Before Work Photos"
          category="before"
          photos={beforePhotos}
          uploading={uploadingCategory === "before"}
          canEdit={canEdit}
          onUpload={(files) => handleFileUpload("before", files)}
          onPreview={(url) => setActivePreviewUrl(url)}
          onDelete={(url) => handleDeletePhoto("before", url)}
        />

        {/* AFTER SECTION */}
        <PhotoSection
          title="After Work Photos"
          category="after"
          photos={afterPhotos}
          uploading={uploadingCategory === "after"}
          canEdit={canEdit}
          onUpload={(files) => handleFileUpload("after", files)}
          onPreview={(url) => setActivePreviewUrl(url)}
          onDelete={(url) => handleDeletePhoto("after", url)}
        />
      </div>

      {/* LIGHTBOX PREVIEW MODAL */}
      {activePreviewUrl && (
        <Modal
          title="Photo Preview"
          open={!!activePreviewUrl}
          onClose={() => setActivePreviewUrl(null)}
        >
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePreviewUrl}
              alt="Vehicle photo"
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-4 flex justify-end w-full">
              <button
                onClick={() => setActivePreviewUrl(null)}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface PhotoSectionProps {
  title: string;
  category: "before" | "after";
  photos: string[];
  uploading: boolean;
  canEdit: boolean;
  onUpload: (files: FileList | null) => void;
  onPreview: (url: string) => void;
  onDelete: (url: string) => void;
}

function PhotoSection({
  title,
  category,
  photos,
  uploading,
  canEdit,
  onUpload,
  onPreview,
  onDelete,
}: PhotoSectionProps) {
  const inputId = `photo-upload-${category}`;

  return (
    <div className="rounded-xl border border-line bg-surface-muted/50 p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink">
            {title} ({photos.length})
          </span>
          {canEdit && (
            <label
              htmlFor={inputId}
              className={`btn-ghost py-1 px-3 text-xs ${
                uploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin text-burgundy-600" />
              ) : (
                <Upload size={13} />
              )}
              <span>{uploading ? "Uploading..." : "Add Photo"}</span>
              <input
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading || !canEdit}
                onChange={(e) => onUpload(e.target.files)}
              />
            </label>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white py-8 text-center shadow-xs">
            <ImageIcon size={24} className="text-ink-faint mb-1" />
            <p className="text-xs text-ink-faint">No {category} photos uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-white shadow-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${category} photo ${idx + 1}`}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onPreview(url)}
                    title="View large"
                    className="rounded-full bg-white/30 p-1.5 text-white hover:bg-white/50"
                  >
                    <Maximize2 size={14} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => onDelete(url)}
                      title="Delete photo"
                      className="rounded-full bg-red-500/40 p-1.5 text-red-200 hover:bg-red-500/60"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
