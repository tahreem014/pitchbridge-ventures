-- The viewer stamps a name on every page by rebuilding the file as a PDF, and the PDF library cannot draw
-- WebP images. Only allow what the viewer can open: PDF, PNG and JPEG.
UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg']
WHERE id = 'pitch-documents';

ALTER TABLE public.pitch_documents DROP CONSTRAINT pitch_documents_mime;
ALTER TABLE public.pitch_documents ADD CONSTRAINT pitch_documents_mime
  CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg'));
