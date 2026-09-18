-- supabase/migrations/054_allow_avif_photos.sql
-- WHY: 053 gave both photo buckets an allowed_mime_types list and left AVIF
--      out of it, which banned a format the library was already using — the
--      photos on toy 95e54ea8 are .avif files uploaded before that list
--      existed. Every avif upload since has been answered with "Photos need
--      to be a JPEG, PNG, WebP or HEIC image", including re-uploads of photos
--      already sitting in the bucket.
--
-- HOW: the same update 053 ran, with 'image/avif' added. Safari, Chrome and
--      Firefox have all decoded AVIF since 2023 and next/image serves it
--      untouched, so nothing downstream needs to change — this is the one
--      place the format was being refused.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'
    ]
where id in ('toy-photos', 'toy-photos-library');
