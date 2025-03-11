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

type File = {
    name: string;
    mime: string;
    size: number;
    path?: string;
    buffer?: Buffer;
    stream?: any;
    url?: string;
};

const generateUploadFileName = (basePath: string, file: File) => {
    const filePath = `${Date.now()}-${file.name}`;
    const extension = file.name.split('.').pop();
    return `${basePath}/${filePath}.${extension}`;
};

export function init(providerOptions: ProviderOptions) {
    const {
        bucketName,
        publicFiles = false,
        uniform = true,
        baseUrl,
        basePath = '',
    } = providerOptions;

    const storage = new Storage();

    const bucket = storage.bucket(bucketName);

    return {
        upload(file: File) {
            return new Promise((resolve, reject) => {
                const filePath = generateUploadFileName(basePath, file);

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
                const filePath = generateUploadFileName(basePath, file);

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
                const filePath = path.join(basePath, file.path ? file.path : '');

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
                    const filePath = path.join(basePath, file.path ? file.path : '');

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
