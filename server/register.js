'use strict';

module.exports = ({ strapi }) => {
  strapi.plugin('upload').provider('gcp', {
    init(config) {
      // Initialize GCP Storage
      const { Storage } = require('@google-cloud/storage');
      
      const storage = new Storage();
      
      const bucket = storage.bucket(config.bucket);
      
      return {
        upload(file) {
          return new Promise((resolve, reject) => {
            const path = file.path ? `${file.path}/` : '';
            const fileName = `${path}${file.hash}${file.ext}`;
            
            const fileOptions = {
              contentType: file.mime,
              public: config.publicFiles,
              metadata: {
                contentDisposition: `inline; filename="${file.name}"`,
              },
            };
            
            const uploadStream = bucket.file(fileName).createWriteStream(fileOptions);
            
            uploadStream.on('error', (error) => {
              reject(error);
            });
            
            uploadStream.on('finish', () => {
              let fileUrl;
              if (config.publicFiles) {
                fileUrl = `https://storage.googleapis.com/${config.bucket}/${fileName}`;
              } else {
                fileUrl = `${config.baseUrl}/${fileName}`;
              }
              
              file.url = fileUrl;
              resolve();
            });
            
            uploadStream.end(file.buffer);
          });
        },
        
        delete(file) {
          return new Promise((resolve, reject) => {
            const fileName = file.url.split(`${config.bucket}/`)[1];
            
            if (!fileName) {
              return resolve();
            }
            
            bucket.file(fileName).delete().then(() => {
              resolve();
            }).catch((error) => {
              if (error.code === 404) {
                return resolve();
              }
              reject(error);
            });
          });
        },
      };
    },
  });
};