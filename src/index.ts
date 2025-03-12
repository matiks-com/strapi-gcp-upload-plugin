import { GetSignedUrlConfig, Storage } from '@google-cloud/storage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

type ProviderOptions = {
    bucketName: string;
    publicFiles?: boolean;
    uniform?: boolean;
    baseUrl?: string;
    basePath?: string;
};
export interface File {
    name: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
    formats?: Record<string, unknown>;
    hash: string;
    ext?: string;
    mime: string;
    size: number;
    sizeInBytes: number;
    url: string;
    previewUrl?: string;
    path?: string;
    provider?: string;
    provider_metadata?: Record<string, unknown>;
    stream?: any;
    buffer?: Buffer;
}

const generateUploadFileName = (basePath: string, file: File) => {
    const filePath = `${Date.now()}-${file.name}`;
    const extension = file.name.split('.').pop();
    return `${basePath}/${filePath}`;
};

export function init(providerOptions: ProviderOptions) {
    const {
        bucketName,
        publicFiles = false,
        uniform = true,
        baseUrl,
        basePath = '',
    } = providerOptions;

    const filePrefix = basePath ? `${basePath.replace(/\/+$/, '')}/` : '';

    const getFileKey = (file: File) => {
        const path = file.path ? `${file.path}/` : '';
        return `${filePrefix}${path}${file.hash}${file.ext}`;
    };

    const storage = new Storage();

    const bucket = storage.bucket(bucketName);

    return {
        upload(file: File) {
            return new Promise((resolve, reject) => {
                const filePath = getFileKey(file);

                const fileOptions = {
                    contentType: file.mime,
                    resumable: file.size > 5 * 1024 * 1024,
                    metadata: {
                        contentDisposition: `inline; filename="${file.name}"`,
                    },
                    public: true,
                };

                const blob = bucket.file(filePath);
                const blobStream = blob.createWriteStream(fileOptions);
                blobStream.on('error', (error) => {
                    reject(error);
                });

                blobStream.on('finish', () => {
                    if (publicFiles) {
                        file.url = `https://storage.googleapis.com/${bucketName}/${filePath}`;
                    } else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    } else {
                        file.url = `/${filePath}`;
                    }

                    blob.makePublic();
                    resolve(200);
                });

                blobStream.end(file.buffer);
            });
        },

        uploadStream(file: File) {
            return new Promise((resolve, reject) => {
                const filePath = getFileKey(file);

                const fileOptions = {
                    contentType: file.mime,
                    resumable: true,
                    metadata: {
                        contentDisposition: `inline; filename="${file.name}"`,
                    },
                    public: true,
                };

                const blob = bucket.file(filePath);
                const blobStream = blob.createWriteStream(fileOptions);

                blobStream.on('error', (error) => {
                    reject(error);
                });
                blobStream.on('finish', () => {
                    if (publicFiles) {
                        file.url = `https://storage.googleapis.com/${bucketName}/${filePath}`;
                    } else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    } else {
                        file.url = `/${filePath}`;
                    }
                    blob.makePublic();

                    resolve(200);
                });

                file.stream.pipe(blobStream);
            });
        },

        delete(file: File) {
            return new Promise((resolve, reject) => {
                const filePath = getFileKey(file);

                bucket.file(filePath).delete({
                    ignoreNotFound: true,
                }).then(() => {
                    resolve(200);
                }).catch((error) => {
                    reject(error);
                });
            });
        },

        checkFileSize(file: File, { sizeLimit }: { sizeLimit: number }) {
            if (file.size > sizeLimit) {
                throw new Error(`File size exceeds the limit of ${sizeLimit} bytes`);
            }
        },

        getSignedUrl(file: File) {
            return new Promise(async (resolve, reject) => {
                try {
                    const filePath = getFileKey(file);

                    const options: GetSignedUrlConfig = {
                        version: 'v4',
                        action: 'read',
                        expires: 60 * 60 * 24 * 29
                    };

                    const [url] = await bucket.file(filePath).getSignedUrl(options);
                    resolve({ url });
                } catch (error) {
                    reject(error);
                }
            });
        },

        isPrivate() {
            return !publicFiles;
        },
    };
}
