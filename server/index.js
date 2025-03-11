const { Storage } = require('@google-cloud/storage');
const path = require('path');

function init(providerOptions) {
    const {
        bucketName,
        publicFiles = false,
        uniform = true, // Default to true since most modern buckets use uniform access
        baseUrl,
        credentials,
        basePath = '',
    } = providerOptions;

    // Create a storage client with the provided credentials
    const storage = new Storage({
        credentials: credentials ? JSON.parse(credentials) : undefined,
    });

    const bucket = storage.bucket(bucketName);

    return {
        upload(file) {
            return new Promise((resolve, reject) => {
                // Build the file path with optional base path
                const filePath = path.join(basePath, file.path ? file.path : '');

                // Create file upload options
                // Do not set public: true when uniform bucket-level access is enabled
                const fileOptions = {
                    contentType: file.mime,
                    resumable: file.size > 5 * 1024 * 1024, // Use resumable uploads for files > 5MB
                    metadata: {
                        contentDisposition: `inline; filename="${file.name}"`,
                    },
                };

                // Don't set ACL if using uniform bucket-level access
                if (!uniform && publicFiles) {
                    fileOptions.public = true;
                }

                const blob = bucket.file(filePath);
                const blobStream = blob.createWriteStream(fileOptions);

                // Handle upload errors
                blobStream.on('error', (error) => {
                    reject(error);
                });

                // Handle successful upload
                blobStream.on('finish', () => {
                    // Construct the URL based on access settings
                    if (publicFiles) {
                        file.url = `https://storage.googleapis.com/${bucketName}/${filePath}`;
                    } else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    } else {
                        file.url = `/${filePath}`;
                    }

                    resolve();
                });

                // Write file buffer to stream and end it
                blobStream.end(file.buffer);
            });
        },

        uploadStream(file) {
            return new Promise((resolve, reject) => {
                // Build the file path with optional base path
                const filePath = path.join(basePath, file.path ? file.path : '');

                // Create file upload options
                // Do not set public: true when uniform bucket-level access is enabled
                const fileOptions = {
                    contentType: file.mime,
                    resumable: true, // Always use resumable uploads for streams
                    metadata: {
                        contentDisposition: `inline; filename="${file.name}"`,
                    },
                };

                // Don't set ACL if using uniform bucket-level access
                if (!uniform && publicFiles) {
                    fileOptions.public = true;
                }

                const blob = bucket.file(filePath);
                const blobStream = blob.createWriteStream(fileOptions);

                // Handle upload errors
                blobStream.on('error', (error) => {
                    reject(error);
                });

                // Handle successful upload
                blobStream.on('finish', () => {
                    // Construct the URL based on access settings
                    if (publicFiles) {
                        file.url = `https://storage.googleapis.com/${bucketName}/${filePath}`;
                    } else if (baseUrl) {
                        file.url = `${baseUrl}/${filePath}`;
                    } else {
                        file.url = `/${filePath}`;
                    }

                    resolve();
                });

                // Pipe file stream to blob stream
                file.stream.pipe(blobStream);
            });
        },

        delete(file) {
            return new Promise((resolve, reject) => {
                // Build the file path with optional base path
                const filePath = path.join(basePath, file.path ? file.path : '');

                // Delete the file from Google Cloud Storage
                bucket.file(filePath).delete({
                    ignoreNotFound: true,
                }).then(() => {
                    resolve();
                }).catch((error) => {
                    reject(error);
                });
            });
        },

        checkFileSize(file, { sizeLimit }) {
            // Implement custom file size limit logic
            if (file.size > sizeLimit) {
                throw new Error(`File size exceeds the limit of ${sizeLimit} bytes`);
            }
        },

        getSignedUrl(file) {
            return new Promise(async (resolve, reject) => {
                try {
                    // Build the file path with optional base path
                    const filePath = path.join(basePath, file.path ? file.path : '');

                    // Generate a signed URL that expires in 15 minutes (900 seconds)
                    const options = {
                        version: 'v4',
                        action: 'read',
                        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
                    };

                    const [url] = await bucket.file(filePath).getSignedUrl(options);
                    resolve({ url });
                } catch (error) {
                    reject(error);
                }
            });
        },

        isPrivate() {
            // If publicFiles is false, then the files are private and need signed URLs
            return !publicFiles;
        },
    };
}
module.exports = {
    init,
};

