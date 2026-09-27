import ImageKit, { toFile } from "@imagekit/nodejs";

const AVATAR_FOLDER = "toure/userAvatars";

let client: ImageKit | null = null;

function getClient(): ImageKit {
  if (client) return client;
  const privateKey = process.env.IMAGEKIT_PRIVATE;
  if (!privateKey) throw new Error("Missing IMAGEKIT_PRIVATE environment variable");
  client = new ImageKit({ privateKey });
  return client;
}

export interface UploadedAvatar {
  url: string;
  fileId: string;
}

/**
 * Downloads a provider avatar (e.g. Google's `picture` URL, which is not
 * guaranteed to stay valid forever) and re-hosts it in our own ImageKit
 * account under Home/toure/userAvatars, keyed by our own userId so a later
 * login just overwrites the same asset instead of piling up copies.
 */
export async function uploadAvatarFromUrl(imageUrl: string, userId: string): Promise<UploadedAvatar> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch avatar source image (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const extension = contentType.includes("png") ? "png" : "jpg";

  const response = await getClient().files.upload({
    file: await toFile(Buffer.from(arrayBuffer), `${userId}.${extension}`),
    fileName: `${userId}.${extension}`,
    folder: AVATAR_FOLDER,
    useUniqueFileName: false,
    overwriteFile: true,
  });

  if (!response.url || !response.fileId) {
    throw new Error("ImageKit upload did not return a url/fileId");
  }

  return { url: response.url, fileId: response.fileId };
}
