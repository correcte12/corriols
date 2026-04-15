import { supabase } from './supabase';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'heic',
]);
const ROOT_ALBUM_SLUG = '__root__';
const ROOT_ALBUM_TITLE = 'General';
const COVER_METADATA_FILE = '.cover.json';

export const getGalleryBucketName = () =>
  import.meta.env.VITE_SUPABASE_GALLERY_BUCKET || 'galeria';

const getBucketName = () => getGalleryBucketName();

const isImageFile = (fileName) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(extension);
};

const isAlbumCandidate = (name) => {
  if (!name) return false;
  return !isImageFile(name);
};

const formatAlbumTitle = (slug) =>
  slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPublicUrl = (bucket, filePath) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
};

const getCoverMetadataPath = (albumSlug) => `${albumSlug}/${COVER_METADATA_FILE}`;

const getAlbumCoverName = async (bucket, albumSlug) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(getCoverMetadataPath(albumSlug));

  if (error) return null;

  try {
    const content = await data.text();
    const parsed = JSON.parse(content);
    if (typeof parsed?.fileName === 'string' && parsed.fileName.trim()) {
      return parsed.fileName.trim();
    }
  } catch {
    return null;
  }

  return null;
};

const getSignedUrl = async (bucket, filePath, expiresInSeconds = 60 * 60 * 24) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    throw new Error(
      buildStorageErrorMessage({
        action: 'No es va poder signar la URL de la imatge',
        bucket,
        path: filePath,
        error,
      }),
    );
  }

  return data?.signedUrl || null;
};

const getObjectUrl = async (bucket, filePath) => {
  try {
    const signedUrl = await getSignedUrl(bucket, filePath);
    if (signedUrl) return signedUrl;
  } catch {
    // fallback to public URL
  }
  return getPublicUrl(bucket, filePath);
};

const buildStorageErrorMessage = ({ action, bucket, path = '', error }) => {
  const location = path ? `${bucket}/${path}` : bucket;
  const rawMessage = error?.message || 'Error desconegut de Supabase Storage.';
  const normalized = rawMessage.toLowerCase();

  let hint = '';
  if (normalized.includes('not found') || normalized.includes('bucket')) {
    hint = 'Verifica que el bucket existeixi i coincideixi amb VITE_SUPABASE_GALLERY_BUCKET.';
  } else if (
    normalized.includes('policy') ||
    normalized.includes('permission') ||
    normalized.includes('forbidden') ||
    normalized.includes('unauthorized')
  ) {
    hint = 'Revisa els permisos del Storage (bucket públic o polítiques per a anon).';
  }

  return `${action} (${location}): ${rawMessage}${hint ? ` ${hint}` : ''}`;
};

const listFolderImages = async (bucket, folderPath, limit = 100) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folderPath, {
      limit,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    throw new Error(
      buildStorageErrorMessage({
        action: 'No es va poder llegir la carpeta',
        bucket,
        path: folderPath,
        error,
      }),
    );
  }

  return (data || []).filter((item) => isImageFile(item.name));
};

export const getGalleryAlbums = async ({ includeEmpty = false } = {}) => {
  const bucket = getBucketName();

  const { data, error } = await supabase.storage
    .from(bucket)
    .list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    throw new Error(
      buildStorageErrorMessage({ action: 'No es va poder carregar la galeria', bucket, error }),
    );
  }

  const rootItems = data || [];
  const rootImages = rootItems.filter((item) => isImageFile(item.name));
  const folders = rootItems.filter((item) => isAlbumCandidate(item.name));

  const albumResults = await Promise.all(
    folders.map(async (folder) => {
      let images = [];
      try {
        images = await listFolderImages(bucket, folder.name, 200);
      } catch (readError) {
        return { readError, slug: folder.name };
      }

      const configuredCoverName = await getAlbumCoverName(bucket, folder.name);
      const configuredCover = configuredCoverName
        ? images.find((image) => image.name === configuredCoverName)
        : null;
      const firstImage = configuredCover || images[0];
      const coverPath = firstImage ? `${folder.name}/${firstImage.name}` : null;
      const coverUrl = coverPath ? await getObjectUrl(bucket, coverPath) : null;

      return {
        slug: folder.name,
        title: formatAlbumTitle(folder.name),
        count: images.length,
        coverUrl,
        coverName: firstImage?.name || null,
      };
    }),
  );

  const failures = albumResults.filter((item) => item?.readError);
  const albums = albumResults.filter((item) => item && !item.readError);

  if (folders.length > 0 && albums.length === 0 && failures.length === folders.length) {
    throw new Error(
      `S'han detectat ${folders.length} carpetes però no s'han pogut llegir. ${failures[0].readError.message}`,
    );
  }

  if (rootImages.length > 0) {
    const firstImage = rootImages[0];
    albums.push({
      slug: ROOT_ALBUM_SLUG,
      title: ROOT_ALBUM_TITLE,
      count: rootImages.length,
      coverUrl: await getObjectUrl(bucket, firstImage.name),
      coverName: firstImage.name,
    });
  }

  return albums.filter((album) => album && (includeEmpty || album.count > 0));
};

export const getAlbumPhotos = async (albumSlug) => {
  const bucket = getBucketName();
  const decodedSlug = decodeURIComponent(albumSlug);
  const isRootAlbum = decodedSlug === ROOT_ALBUM_SLUG;
  const images = await listFolderImages(bucket, isRootAlbum ? '' : decodedSlug, 500);

  return {
    album: {
      slug: decodedSlug,
      title: isRootAlbum ? ROOT_ALBUM_TITLE : formatAlbumTitle(decodedSlug),
    },
    photos: await Promise.all(
      images.map(async (image) => {
        const path = isRootAlbum ? image.name : `${decodedSlug}/${image.name}`;
        return {
          name: image.name,
          path,
          url: await getObjectUrl(bucket, path),
        };
      }),
    ),
  };
};

export const normalizeAlbumSlug = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const createAlbum = async (albumName) => {
  const bucket = getBucketName();
  const slug = normalizeAlbumSlug(albumName);
  if (!slug) throw new Error('Nom d\'àlbum no vàlid');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(`${slug}/.emptyFolderPlaceholder`, new Blob(['']), {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(
      buildStorageErrorMessage({ action: 'No es va poder crear l\'àlbum', bucket, path: slug, error }),
    );
  }

  return { slug, title: formatAlbumTitle(slug) };
};

export const uploadPhoto = async (albumSlug, file) => {
  const bucket = getBucketName();
  const { optimizeImage } = await import('./imageOptimizer.js');
  let uploadFile = file;

  try {
    uploadFile = await optimizeImage(file);
  } catch (optimizeError) {
    console.warn('No es va poder optimitzar la imatge; es puja el fitxer original.', optimizeError);
  }

  let finalFile = uploadFile;
  let path = `${albumSlug}/${finalFile.name}`;

  let { error } = await supabase.storage.from(bucket).upload(path, finalFile, {
    contentType: finalFile.type || file.type || 'application/octet-stream',
    upsert: true,
  });

  if (error && finalFile !== file) {
    finalFile = file;
    path = `${albumSlug}/${finalFile.name}`;
    const retry = await supabase.storage.from(bucket).upload(path, finalFile, {
      contentType: finalFile.type || 'application/octet-stream',
      upsert: true,
    });
    error = retry.error;
  }

  if (error) {
    throw new Error(
      buildStorageErrorMessage({ action: 'No es va poder pujar la foto', bucket, path, error }),
    );
  }

  return {
    name: finalFile.name,
    path,
    originalSize: file.size,
    optimizedSize: finalFile.size,
    url: await getObjectUrl(bucket, path),
  };
};

export const deletePhoto = async (photoPath) => {
  const bucket = getBucketName();
  const { error } = await supabase.storage.from(bucket).remove([photoPath]);
  if (error) {
    throw new Error(
      buildStorageErrorMessage({ action: 'No es va poder eliminar la foto', bucket, path: photoPath, error }),
    );
  }
};

export const deleteAlbum = async (albumSlug) => {
  const bucket = getBucketName();
  const images = await listFolderImages(bucket, albumSlug, 500);
  const allPaths = [
    ...images.map((img) => `${albumSlug}/${img.name}`),
    `${albumSlug}/.emptyFolderPlaceholder`,
    getCoverMetadataPath(albumSlug),
  ];

  if (allPaths.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(allPaths);
    if (error) {
      throw new Error(
        buildStorageErrorMessage({ action: 'No es va poder eliminar l\'àlbum', bucket, path: albumSlug, error }),
      );
    }
  }
};

export const getAlbumPhotosList = async (albumSlug) => {
  const bucket = getBucketName();
  const images = await listFolderImages(bucket, albumSlug, 500);
  return Promise.all(
    images.map(async (image) => {
      const path = `${albumSlug}/${image.name}`;
      return { name: image.name, path, url: await getObjectUrl(bucket, path) };
    }),
  );
};

export const setAlbumCover = async (albumSlug, photoName) => {
  const bucket = getBucketName();
  const payload = JSON.stringify({ fileName: photoName, updatedAt: new Date().toISOString() });
  const metadataPath = getCoverMetadataPath(albumSlug);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(metadataPath, new Blob([payload], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    throw new Error(
      buildStorageErrorMessage({
        action: 'No es va poder guardar la portada de l\'àlbum',
        bucket,
        path: metadataPath,
        error,
      }),
    );
  }
};
