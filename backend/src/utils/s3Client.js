import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bucketName = process.env.AWS_BUCKET_NAME;

const assertConfigured = () => {
  if (!bucketName || !process.env.AWS_REGION) throw new Error("S3 storage requires AWS_BUCKET_NAME and AWS_REGION");
};

const uploadFile = async (filePath, key, contentType, contentLength) => {
  assertConfigured();
  return s3.send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: fs.createReadStream(filePath), ContentType: contentType || "application/octet-stream", ContentLength: contentLength }));
};

const getFileContent = async (key) => {
  assertConfigured();
  return s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
};

const deleteFile = async (key) => {
  assertConfigured();
  return s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
};

const copyFile = async (sourceKey, destinationKey) => {
  assertConfigured();
  const encodedSource = encodeURIComponent(sourceKey).replace(/%2F/g, "/");
  return s3.send(new CopyObjectCommand({ Bucket: bucketName, Key: destinationKey, CopySource: `${bucketName}/${encodedSource}` }));
};

export default { uploadFile, getFileContent, deleteFile, copyFile };
