import { Storage } from '@google-cloud/storage';
export function init(providerOptions) {
    const { bucketName, publicFiles = false, uniform = true, baseUrl, basePath = '', } = providerOptions;
    const filePrefix = basePath ? `${basePath.replace(/\/+$/, '')}/` : '';
    const getFileName = (file) => {
        const path = file.path ? `${file.path}/` : '';
        return `${filePrefix}${path}${file.hash}${file.ext}`;
    };
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    return {
        upload(file) {
            return new Promise((resolve, reject) => {
                const filePath = getFileName(file);
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
                    }
                    else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    }
                    else {
                        file.url = `/${filePath}`;
                    }
                    blob.makePublic();
                    resolve(200);
                });
                blobStream.end(file.buffer);
            });
        },
        uploadStream(file) {
            return new Promise((resolve, reject) => {
                const filePath = getFileName(file);
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
                    }
                    else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    }
                    else {
                        file.url = `/${filePath}`;
                    }
                    blob.makePublic();
                    resolve(200);
                });
                file.stream.pipe(blobStream);
            });
        },
        delete(file) {
            return new Promise((resolve, reject) => {
                const filePath = getFileName(file);
                bucket.file(filePath).delete({
                    ignoreNotFound: true,
                }).then(() => {
                    resolve(200);
                }).catch((error) => {
                    reject(error);
                });
            });
        },
        checkFileSize(file, { sizeLimit }) {
            if (file.size > sizeLimit) {
                throw new Error(`File size exceeds the limit of ${sizeLimit} bytes`);
            }
        },
        getSignedUrl(file) {
            return new Promise(async (resolve, reject) => {
                try {
                    const filePath = getFileName(file);
                    const options = {
                        version: 'v4',
                        action: 'read',
                        expires: 60 * 60 * 24 * 29
                    };
                    const [url] = await bucket.file(filePath).getSignedUrl(options);
                    resolve({ url });
                }
                catch (error) {
                    reject(error);
                }
            });
        },
        isPrivate() {
            return !publicFiles;
        },
    };
}
