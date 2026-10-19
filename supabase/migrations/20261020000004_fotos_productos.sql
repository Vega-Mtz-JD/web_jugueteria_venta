-- Fotos de productos: solo imágenes comunes de hasta 5 MB (el panel las comprime a WebP antes de subir).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    file_size_limit = 5242880
where id = 'product-images';
