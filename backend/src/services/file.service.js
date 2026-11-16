import { File } from "../models/file.model.js";
import ApiError from "../utils/ApiError.js";
import generateThumbnail from "../utils/generateThumbnail.js";
import path from "path";
import fs from "fs";
import { FILE_UPLOADS_DIR, THUMBNAIL_DIR } from "../constants.js";
import userService from "./user.service.js";
import { randomUUID } from "crypto";
import s3 from "../utils/s3Client.js";

const accessFilter = (user) => ({ $or: [{ owner: user._id }, { sharedWith: user._id }] });

const getAccessibleFile = async ({ id, user, excludePath = true }) => {
  if (!id || !user) throw new ApiError(404, "File not found");
  const projection = { __v: 0 };
  if (excludePath) projection.contentPath = 0;
  const rawFile = await File.findById(id).select("owner sharedWith parent isTrashed");
  if (!rawFile || rawFile.isTrashed) throw new ApiError(404, "File not found");
  const userId = String(user._id);
  let allowed = String(rawFile.owner) === userId || rawFile.sharedWith.some((sharedId) => String(sharedId) === userId);
  // Sharing a folder grants read access to its descendants, without granting write access.
  let ancestorId = rawFile.parent;
  while (!allowed && ancestorId) {
    const ancestor = await File.findById(ancestorId).select("owner sharedWith parent isTrashed");
    if (!ancestor || ancestor.isTrashed) break;
    const sameOwner = String(ancestor.owner) === String(rawFile.owner);
    const sharedAncestor = ancestor.sharedWith.some((sharedId) => String(sharedId) === userId);
    if (sameOwner && sharedAncestor) allowed = true;
    ancestorId = ancestor.parent;
  }
  if (!allowed) throw new ApiError(404, "File not found");
  const fileQuery = File.findById(id, projection)
    .populate({ path: "parent", select: "name isFolder owner" })
    .populate({ path: "owner", select: "firstName lastName email" });
  if (String(rawFile.owner) === userId) fileQuery.populate({ path: "sharedWith", select: "firstName lastName email" });
  else fileQuery.select("-sharedWith");
  return fileQuery;
};

const assertOwned = async ({ id, user }) => {
  const file = await File.findOne({ _id: id, owner: user._id });
  if (!file) throw new ApiError(404, "File not found");
  return file;
};

const assertDestination = async ({ parent, user }) => {
  const destinationId = parent || user.rootFolder;
  const folder = await File.findOne({ _id: destinationId, owner: user._id, isFolder: true, isTrashed: false });
  if (!folder) throw new ApiError(400, "Destination folder is invalid");
  return folder;
};

const safeStoredPath = (storedPath, base = FILE_UPLOADS_DIR) => {
  if (!storedPath) throw new ApiError(404, "File content is unavailable");
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(storedPath);
  if (resolved !== resolvedBase && !resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new ApiError(400, "Invalid stored file path");
  }
  return resolved;
};

const getFiles = async ({ parent, user, contentPath = false }) => {
  const parentFolder = await getAccessibleFile({ id: parent, user });
  if (!parentFolder.isFolder) throw new ApiError(400, "The requested parent is not a folder");
  const projection = { __v: 0 };
  if (contentPath) projection.contentPath = 0;
  const folderOwner = parentFolder.owner?._id || parentFolder.owner;
  return File.find({ parent, isTrashed: false, $or: [{ owner: folderOwner }, { sharedWith: user._id }] }, projection);
};

const getTrashFiles = async ({ owner }) => File.find({ owner, isTrashed: true }, { contentPath: 0, __v: 0 });

const searchFiles = async ({ search, type, user }) => {
  const query = { ...accessFilter(user), isTrashed: false, _id: { $ne: user.rootFolder } };
  if (search) query.name = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (type && type !== "all") {
    if (["image", "video", "audio"].includes(type)) query.type = new RegExp(`^${type}\\/`);
    else if (type === "document") query.type = { $in: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain"] };
    else if (type === "folder") query.isFolder = true;
  }
  return File.find(query, { contentPath: 0, __v: 0 });
};

const getSharedWithMeFiles = async ({ user }) => File.find({ sharedWith: user._id, isTrashed: false }, { contentPath: 0, __v: 0 });
const getFileById = getAccessibleFile;

const createFile = async ({ name, size, owner, parent, isFolder = false, contentPath, type, storageProvider = "local" }) => {
  // A root folder is created during registration and intentionally has no parent.
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 255 || /[\\/\0]/.test(cleanName)) throw new ApiError(400, "Enter a valid name (1–255 characters)");
  if (parent || owner.rootFolder) await assertDestination({ parent, user: owner });
  else if (!isFolder) throw new ApiError(400, "A destination folder is required");
  const destinationId = parent || owner.rootFolder || null;
  const duplicate = await File.findOne({ owner: owner._id, parent: destinationId, name: cleanName, isTrashed: false });
  if (duplicate) throw new ApiError(409, `${isFolder ? "Folder" : "File"} with the same name already exists`);
  try {
    return await File.create({ name: cleanName, size, owner: owner._id, parent: destinationId, isFolder, contentPath, type, storageProvider });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, `${isFolder ? "Folder" : "File"} with same name already exists`);
    throw error;
  }
};

const updateThumbnail = async ({ id, file }) => {
  try {
    const thumbnailUrl = await generateThumbnail(id, file.path);
    return await File.findByIdAndUpdate(id, { thumbnailUrl }, { new: true });
  } catch (error) {
    // Thumbnail generation is optional; the uploaded original remains usable.
    return File.findById(id);
  }
};

const updateContentPath = async ({ id, path: contentPath }) => File.findByIdAndUpdate(id, { contentPath }, { new: true });

const moveFile = async ({ id, parent, user }) => {
  const file = await assertOwned({ id, user });
  if (!file.parent) throw new ApiError(400, "The root folder cannot be moved");
  const destination = await assertDestination({ parent, user });
  if (String(file._id) === String(destination._id) || String(file.parent) === String(destination._id)) throw new ApiError(400, "Destination folder should be different from the current folder");
  const duplicate = await File.findOne({ _id: { $ne: file._id }, owner: user._id, parent: destination._id, name: file.name, isTrashed: false });
  if (duplicate) throw new ApiError(409, "A file with that name already exists in the destination folder");
  if (file.isFolder) {
    let cursor = destination;
    while (cursor?.parent) {
      if (String(cursor.parent) === String(file._id)) throw new ApiError(400, "A folder cannot be moved inside itself");
      cursor = await File.findById(cursor.parent).select("parent");
    }
  }
  return File.findByIdAndUpdate(id, { parent: destination._id }, { new: true });
};

const copyFile = async ({ id, parent, user }) => {
  const source = await assertOwned({ id, user });
  const destination = await assertDestination({ parent, user });
  if (source.isFolder) throw new ApiError(400, "Folder copying is not supported yet");
  const duplicate = await File.findOne({ owner: user._id, parent: destination._id, name: source.name, isTrashed: false });
  if (duplicate) throw new ApiError(409, "A file with that name already exists in the destination folder");
  const ext = path.extname(source.name).toLowerCase();
  const copiedPath = source.storageProvider === "s3"
    ? `users/${user._id}/${randomUUID()}${ext}`
    : path.join(FILE_UPLOADS_DIR, `${randomUUID()}${ext}`);
  if (source.storageProvider === "s3") {
    await s3.copyFile(source.contentPath, copiedPath);
  } else {
    const sourcePath = safeStoredPath(source.contentPath);
    if (!fs.existsSync(sourcePath)) throw new ApiError(404, "Original file content is missing");
    fs.copyFileSync(sourcePath, copiedPath);
  }
  try {
    const copy = source.toObject();
    delete copy._id; delete copy.createdAt; delete copy.updatedAt; delete copy.__v;
    copy.parent = destination._id;
    copy.contentPath = copiedPath;
    copy.sharedWith = [];
    copy.isTrashed = false;
    const created = await File.create(copy);
    const oldThumbnail = path.join(THUMBNAIL_DIR, `${source._id}.png`);
    const newThumbnail = path.join(THUMBNAIL_DIR, `${created._id}.png`);
    if (fs.existsSync(oldThumbnail)) {
      fs.copyFileSync(oldThumbnail, newThumbnail);
      created.thumbnailUrl = `${process.env.APP_URL}/thumbnail/${created._id}.png`;
      await created.save();
    }
    return created;
  } catch (error) {
    if (source.storageProvider === "s3") await s3.deleteFile(copiedPath).catch(() => {});
    else if (fs.existsSync(copiedPath)) fs.unlinkSync(copiedPath);
    throw error;
  }
};

const renameFile = async ({ id, name, user }) => {
  const current = await assertOwned({ id, user });
  if (!current.parent) throw new ApiError(400, "The root folder cannot be renamed");
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 255 || /[\\/\0]/.test(cleanName)) throw new ApiError(400, "Enter a valid name (1–255 characters)");
  const duplicate = await File.findOne({ _id: { $ne: id }, owner: user._id, parent: current.parent, name: cleanName, isTrashed: false });
  if (duplicate) throw new ApiError(409, "A file with that name already exists in this folder");
  return File.findByIdAndUpdate(id, { name: cleanName }, { new: true });
};

const moveToTrash = async ({ id, user }) => {
  const file = await getAccessibleFile({ id, user });
  if (!file.parent && String(file.owner?._id || file.owner) === String(user._id)) throw new ApiError(400, "The root folder cannot be moved to trash");
  if (String(file.owner?._id || file.owner) !== String(user._id)) {
    const directShare = await File.exists({ _id: id, sharedWith: user._id });
    if (!directShare) throw new ApiError(403, "Access inherited from a shared folder cannot be removed here");
    return File.findByIdAndUpdate(id, { $pull: { sharedWith: user._id } }, { new: true });
  }
  return File.findByIdAndUpdate(id, { isTrashed: true }, { new: true });
};

const restoreTrash = async ({ id, user }) => {
  await assertOwned({ id, user });
  return File.findByIdAndUpdate(id, { isTrashed: false }, { new: true });
};

const deleteFile = async ({ id, user }) => {
  const file = await assertOwned({ id, user });
  if (!file.parent) throw new ApiError(400, "The root folder cannot be permanently deleted");
  if (file.isFolder) {
    const children = await File.find({ parent: file._id, owner: user._id });
    for (const child of children) await deleteFile({ id: child._id, user });
  }
  if (!file.isFolder) {
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${file._id}.png`);
    if (file.storageProvider === "s3") await s3.deleteFile(file.contentPath);
    else {
      const filePath = safeStoredPath(file.contentPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
  }
  await File.findByIdAndDelete(id);
};

const deleteAllTrashFiles = async ({ owner }) => {
  const files = await File.find({ owner: owner._id, isTrashed: true, isFolder: false });
  for (const file of files) await deleteFile({ id: file._id, user: owner });
  const folders = await File.find({ owner: owner._id, isTrashed: true, isFolder: true }).sort({ createdAt: -1 });
  for (const folder of folders) {
    const stillExists = await File.exists({ _id: folder._id });
    if (stillExists) await deleteFile({ id: folder._id, user: owner });
  }
};

const shareFile = async ({ email, id, user: owner }) => {
  await assertOwned({ id, user: owner });
  const recipient = await userService.getUserByEmail(String(email || "").trim().toLowerCase());
  if (!recipient) throw new ApiError(404, "User with that email was not found");
  if (String(recipient._id) === String(owner._id)) throw new ApiError(400, "You already own this file");
  return File.findByIdAndUpdate(id, { $addToSet: { sharedWith: recipient._id } }, { new: true }).select("-contentPath -__v");
};

const removeFileAccess = async ({ user: recipientId, id, owner }) => {
  await assertOwned({ id, user: owner });
  return File.findByIdAndUpdate(id, { $pull: { sharedWith: recipientId } }, { new: true }).select("-contentPath -__v");
};

const addFolderToArchive = async ({ archive, parent, owner, basePath = "" }) => {
  const ownerId = owner?._id || owner;
  const files = await File.find({ parent, owner: ownerId, isTrashed: false });
  if (!files.length) archive.append(Buffer.alloc(0), { name: `${basePath}/` });
  for (const file of files) {
    const entryName = path.posix.join(basePath, file.name);
    if (file.isFolder) {
      archive.append(Buffer.alloc(0), { name: `${entryName}/` });
      await addFolderToArchive({ archive, parent: file._id, owner, basePath: entryName });
    } else if (file.storageProvider === "s3") {
      const object = await s3.getFileContent(file.contentPath);
      archive.append(object.Body, { name: entryName });
    } else {
      archive.file(safeStoredPath(file.contentPath), { name: entryName });
    }
  }
};

const getSafeFilePath = (contentPath) => safeStoredPath(contentPath);

export default { getFiles, getTrashFiles, searchFiles, getSharedWithMeFiles, getFileById, getAccessibleFile, createFile, updateThumbnail, updateContentPath, moveFile, copyFile, renameFile, moveToTrash, restoreTrash, deleteFile, deleteAllTrashFiles, shareFile, removeFileAccess, addFolderToArchive, getSafeFilePath };
