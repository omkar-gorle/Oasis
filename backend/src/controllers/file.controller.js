import fileService from "../services/file.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import fs from "fs";
import path from "path";
import ApiError from "../utils/ApiError.js";
import archiver from "archiver";
import s3 from "../utils/s3Client.js";
import { randomUUID } from "crypto";

const getFiles = asyncHandler(async (req, res) => {
  const files = await fileService.getFiles({ parent: req.params.id, user: req.user, contentPath: true });
  return res.status(200).json(new ApiResponse(200, { files }));
});

const searchFiles = asyncHandler(async (req, res) => {
  const files = await fileService.searchFiles({ search: req.query.search, type: req.query.type, user: req.user });
  return res.status(200).json(new ApiResponse(200, { files }));
});

const getTrashedFiles = asyncHandler(async (req, res) => {
  const files = await fileService.getTrashFiles({ owner: req.user._id });
  return res.status(200).json(new ApiResponse(200, { files }));
});

const getSharedWithMeFiles = asyncHandler(async (req, res) => {
  const files = await fileService.getSharedWithMeFiles({ user: req.user });
  return res.status(200).json(new ApiResponse(200, { files }));
});

const getFile = asyncHandler(async (req, res) => {
  const file = await fileService.getFileById({ id: req.params.id, user: req.user });
  return res.status(200).json(new ApiResponse(200, { file }));
});

const streamFile = async (req, res, disposition) => {
  const file = await fileService.getFileById({ id: req.params.id, user: req.user, excludePath: false });
  if (file.isFolder) throw new ApiError(400, "Folders must be downloaded as an archive");
  const filePath = file.storageProvider === "s3" ? null : fileService.getSafeFilePath(file.contentPath);
  if (file.storageProvider !== "s3" && !fs.existsSync(filePath)) throw new ApiError(404, "File content is missing from storage");
  const safeName = path.basename(file.name).replace(/[\r\n"\\]/g, "_");
  res.setHeader("Content-Type", file.type || "application/octet-stream");
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  const stream = file.storageProvider === "s3"
    ? (await s3.getFileContent(file.contentPath)).Body
    : fs.createReadStream(filePath);
  stream.on("error", (error) => {
    if (!res.headersSent) res.status(500).json(new ApiResponse(500, null, "Unable to read file"));
    else res.destroy(error);
  });
  stream.pipe(res);
};

const previewFile = asyncHandler(async (req, res) => streamFile(req, res, "inline"));

const downloadFile = asyncHandler(async (req, res) => {
  const file = await fileService.getFileById({ id: req.params.id, user: req.user, excludePath: false });
  if (!file.isFolder) return streamFile(req, res, "attachment");
  const archive = archiver("zip", { zlib: { level: 6 } });
  const safeName = path.basename(file.name).replace(/[\r\n"\\]/g, "_");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName || "folder"}.zip"`);
  archive.on("error", (error) => { if (!res.headersSent) res.status(500); res.end(); });
  archive.pipe(res);
  await fileService.addFolderToArchive({ archive, parent: file._id, owner: file.owner?._id || file.owner });
  await archive.finalize();
});

const createFile = asyncHandler(async (req, res) => {
  const uploadedFile = req.file;
  if (!uploadedFile) throw new ApiError(400, "Choose a supported file to upload");
  const originalName = path.basename(uploadedFile.originalname.replace(/\\/g, "/"));
  const useS3 = process.env.STORAGE_DRIVER === "s3";
  const objectKey = useS3 ? `users/${req.user._id}/${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}` : uploadedFile.path;
  let uploadedToS3 = false;
  try {
    if (useS3) {
      await s3.uploadFile(uploadedFile.path, objectKey, uploadedFile.mimetype, uploadedFile.size);
      uploadedToS3 = true;
    }
    const newFile = await fileService.createFile({ name: originalName, size: uploadedFile.size, owner: req.user, parent: req.body.parent_id || req.user.rootFolder, contentPath: objectKey, type: uploadedFile.mimetype, storageProvider: useS3 ? "s3" : "local" });
    const file = await fileService.updateThumbnail({ id: newFile._id, file: uploadedFile });
    if (uploadedFile.path && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
    return res.status(201).json(new ApiResponse(201, { file }, "File uploaded successfully"));
  } catch (error) {
    if (uploadedToS3) await s3.deleteFile(objectKey).catch(() => {});
    if (uploadedFile.path && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
    throw error;
  }
});

const createFolder = asyncHandler(async (req, res) => {
  const folder = await fileService.createFile({ name: req.body.name, owner: req.user, size: 0, parent: req.body.parent || req.user.rootFolder, isFolder: true });
  return res.status(201).json(new ApiResponse(201, { folder }, "Folder created successfully"));
});

const updateFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { parent, action, name } = req.body;
  let file;
  switch (action) {
    case "move": file = await fileService.moveFile({ id, parent, user: req.user }); break;
    case "copy": file = await fileService.copyFile({ id, parent, user: req.user }); break;
    case "moveToTrash": file = await fileService.moveToTrash({ id, user: req.user }); break;
    case "restore": file = await fileService.restoreTrash({ id, user: req.user }); break;
    case "renameFile": file = await fileService.renameFile({ id, name, user: req.user }); break;
    default: return res.status(400).json(new ApiResponse(400, null, "Invalid action"));
  }
  return res.status(200).json(new ApiResponse(200, { file }, "Success"));
});

const deleteFile = asyncHandler(async (req, res) => {
  await fileService.deleteFile({ id: req.params.id, user: req.user });
  return res.status(200).json(new ApiResponse(200, null, "File deleted successfully."));
});

const deleteAllTrashFiles = asyncHandler(async (req, res) => {
  await fileService.deleteAllTrashFiles({ owner: req.user });
  return res.status(200).json(new ApiResponse(200, null, "Trash emptied successfully"));
});

const shareFile = asyncHandler(async (req, res) => {
  const { email, file: fileId, action, user: recipientId } = req.body;
  let file;
  if (action === "add") file = await fileService.shareFile({ email, id: fileId, user: req.user });
  else if (action === "remove") file = await fileService.removeFileAccess({ user: recipientId, id: fileId, owner: req.user });
  else return res.status(400).json(new ApiResponse(400, null, "Invalid action"));
  return res.status(200).json(new ApiResponse(200, { file }, "Access updated"));
});

export default { getFiles, searchFiles, getTrashedFiles, getSharedWithMeFiles, getFile, previewFile, downloadFile, createFile, createFolder, updateFile, deleteFile, deleteAllTrashFiles, shareFile };
