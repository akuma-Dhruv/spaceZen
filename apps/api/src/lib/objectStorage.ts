import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { PassThrough, Readable } from "stream";
import { Storage, File } from "@google-cloud/storage";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import { env } from "../config/env";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface StorageObject {
  name: string;
  createReadStream(): NodeJS.ReadableStream;
  getMetadata(): Promise<{ contentType?: string; size?: number }>;
}

interface StorageProvider {
  getPublicObjectSearchPaths(): string[];
  getPrivateObjectDir(): string;
  searchPublicObject(filePath: string): Promise<StorageObject | null>;
  downloadObject(objectFile: StorageObject, cacheTtlSec?: number): Promise<Response>;
  getObjectEntityUploadURL(): Promise<string>;
  getObjectEntityFile(objectPath: string): Promise<StorageObject>;
  normalizeObjectEntityPath(rawPath: string): string;
  trySetObjectEntityAclPolicy?(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string>;
  canAccessObjectEntity?(options: {
    userId?: string;
    objectFile: StorageObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean>;
  saveLocalUpload?(uploadId: string, request: unknown): Promise<void>;
}

const LOCAL_API_UPLOAD_PREFIX = "/api/storage/uploads/local/";

class LocalStorageObject implements StorageObject {
  constructor(private readonly absolutePath: string) {}

  get name(): string {
    return path.basename(this.absolutePath);
  }

  createReadStream(): NodeJS.ReadableStream {
    return fs.createReadStream(this.absolutePath);
  }

  async getMetadata(): Promise<{ contentType?: string; size?: number }> {
    const stats = await fs.promises.stat(this.absolutePath);
    return {
      contentType: "application/octet-stream",
      size: Number(stats.size),
    };
  }
}

class LocalStorageProvider implements StorageProvider {
  private readonly publicPaths: string[];
  private readonly privateRoot: string;

  constructor() {
    this.publicPaths = parseCsvPaths(env.PUBLIC_OBJECT_SEARCH_PATHS);
    this.privateRoot = env.PRIVATE_OBJECT_DIR;

    if (!this.privateRoot) {
      throw new Error(
        "PRIVATE_OBJECT_DIR is required for local storage. Set PRIVATE_OBJECT_DIR to a writable directory.",
      );
    }
  }

  getPublicObjectSearchPaths(): string[] {
    if (this.publicPaths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS must be configured for local storage.",
      );
    }
    return this.publicPaths;
  }

  getPrivateObjectDir(): string {
    return this.privateRoot;
  }

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    for (const searchPath of this.publicPaths) {
      const candidate = path.join(searchPath, filePath);
      if (await fileExists(candidate)) {
        return new LocalStorageObject(candidate);
      }
    }
    return null;
  }

  async downloadObject(objectFile: StorageObject, cacheTtlSec = 3600): Promise<Response> {
    const metadata = await objectFile.getMetadata();
    const nodeStream = objectFile.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "Cache-Control": `private, max-age=${cacheTtlSec}`,
    };
    if (metadata.size != null) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const relativePath = `${LOCAL_API_UPLOAD_PREFIX}${objectId}`;
    if (env.API_PUBLIC_URL) {
      return `${env.API_PUBLIC_URL.replace(/\/$/, "")}${relativePath}`;
    }
    return relativePath;
  }

  async saveLocalUpload(uploadId: string, request: unknown): Promise<void> {
    const uploadsDir = path.join(this.privateRoot, "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const destination = path.join(uploadsDir, uploadId);
    const writeStream = fs.createWriteStream(destination, { flags: "w" });
    if (request instanceof fs.ReadStream) {
      await pipeline(request, writeStream);
      return;
    }
    if (request && typeof (request as any).pipe === "function") {
      await pipeline((request as any), writeStream);
      return;
    }
    throw new Error("Unsupported upload request type for local storage provider.");
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    const candidate = path.join(this.privateRoot, "uploads", entityId);
    if (!(await fileExists(candidate))) {
      throw new ObjectNotFoundError();
    }
    return new LocalStorageObject(candidate);
  }

  normalizeObjectEntityPath(rawPath: string): string {
    let pathCandidate = rawPath;
    if (env.API_PUBLIC_URL && rawPath.startsWith(env.API_PUBLIC_URL)) {
      pathCandidate = rawPath.slice(env.API_PUBLIC_URL.length);
    }

    if (pathCandidate.startsWith(LOCAL_API_UPLOAD_PREFIX)) {
      const uploadId = pathCandidate.slice(LOCAL_API_UPLOAD_PREFIX.length);
      return `/objects/${uploadId}`;
    }

    return pathCandidate;
  }
}

class GcsStorageProvider implements StorageProvider {
  private readonly storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT,
    keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  getPublicObjectSearchPaths(): string[] {
    const paths = parseCsvPaths(env.PUBLIC_OBJECT_SEARCH_PATHS);
    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS must be configured for GCP storage.");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    if (!env.PRIVATE_OBJECT_DIR) {
      throw new Error("PRIVATE_OBJECT_DIR must be configured for GCP storage.");
    }
    return env.PRIVATE_OBJECT_DIR;
  }

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parseObjectPath(`${searchPath}/${filePath}`);
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file as StorageObject;
      }
    }
    return null;
  }

  async downloadObject(objectFile: StorageObject, cacheTtlSec = 3600): Promise<Response> {
    const gcsFile = objectFile as File;
    const [metadata] = await gcsFile.getMetadata();
    const aclPolicy = await getObjectAclPolicy(gcsFile);
    const isPublic = aclPolicy?.visibility === "public";
    const nodeStream = gcsFile.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const { bucketName, objectName } = parseObjectPath(`${privateObjectDir}/uploads/${objectId}`);
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(objectName);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 900 * 1000,
      contentType: "application/octet-stream",
    });
    return url;
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = this.storage.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile as StorageObject;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(rawPath);
      const rawObjectPath = url.pathname;
      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }
      if (!rawObjectPath.startsWith(objectEntityDir)) {
        return rawObjectPath;
      }
      const entityId = rawObjectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile as File, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({ userId, objectFile, requestedPermission }: { userId?: string; objectFile: StorageObject; requestedPermission?: ObjectPermission; }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile: objectFile as File,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    const clientConfig: any = {
      region: env.AWS_REGION,
    };

    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      };
    }

    if (env.AWS_S3_ENDPOINT) {
      clientConfig.endpoint = env.AWS_S3_ENDPOINT;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
  }

  getPublicObjectSearchPaths(): string[] {
    const paths = parseCsvPaths(env.PUBLIC_OBJECT_SEARCH_PATHS);
    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS must be configured for S3 storage.");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    if (!env.PRIVATE_OBJECT_DIR) {
      throw new Error("PRIVATE_OBJECT_DIR must be configured for S3 storage.");
    }
    return env.PRIVATE_OBJECT_DIR;
  }

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parseObjectPath(`${searchPath}/${filePath}`);
      try {
        await this.client.send(
          new HeadObjectCommand({ Bucket: bucketName, Key: objectName }),
        );
        return new S3StorageObject(this.client, bucketName, objectName);
      } catch {
        continue;
      }
    }
    return null;
  }

  async downloadObject(objectFile: StorageObject, cacheTtlSec = 3600): Promise<Response> {
    const s3Object = objectFile as S3StorageObject;
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: s3Object.bucketName, Key: s3Object.objectKey }),
    );
    const body = result.Body as NodeJS.ReadableStream | undefined;
    if (!body) {
      throw new ObjectNotFoundError();
    }
    const webStream = Readable.toWeb(body) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": `private, max-age=${cacheTtlSec}`,
    };
    if (result.ContentLength != null) {
      headers["Content-Length"] = String(result.ContentLength);
    }
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const { bucketName, objectName } = parseObjectPath(`${env.PRIVATE_OBJECT_DIR}/uploads/${objectId}`);
    const command = new PutObjectCommand({ Bucket: bucketName, Key: objectName });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    const { bucketName, objectName } = parseObjectPath(`${env.PRIVATE_OBJECT_DIR}/uploads/${entityId}`);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucketName, Key: objectName }));
      return new S3StorageObject(this.client, bucketName, objectName);
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      const url = new URL(rawPath);
      return url.pathname;
    }
    return rawPath;
  }
}

class S3StorageObject implements StorageObject {
  constructor(
    public readonly client: S3Client,
    public readonly bucketName: string,
    public readonly objectKey: string,
  ) {}

  public get name(): string {
    return path.basename(this.objectKey);
  }

  public createReadStream(): NodeJS.ReadableStream {
    const passThrough = new PassThrough();
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: this.objectKey });

    this.client.send(command).then((response) => {
      const readable = response.Body as NodeJS.ReadableStream | undefined;
      if (!readable) {
        passThrough.destroy(new ObjectNotFoundError());
        return;
      }
      pipeline(readable, passThrough).catch((error) => passThrough.destroy(error));
    }).catch((error) => passThrough.destroy(error));

    return passThrough;
  }

  public async getMetadata(): Promise<{ contentType?: string; size?: number }> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: this.objectKey }));
    return {
      contentType: result.ContentType,
      size: result.ContentLength ?? undefined,
    };
  }
}

function getStorageProvider(): StorageProvider {
  switch (env.OBJECT_STORAGE_PROVIDER) {
    case "local":
      return new LocalStorageProvider();
    case "s3":
      return new S3StorageProvider();
    case "gcp":
      return new GcsStorageProvider();
    default:
      throw new Error(`Unsupported OBJECT_STORAGE_PROVIDER: ${env.OBJECT_STORAGE_PROVIDER}`);
  }
}

export class ObjectStorageService {
  private readonly provider = getStorageProvider();

  getPublicObjectSearchPaths(): string[] {
    return this.provider.getPublicObjectSearchPaths();
  }

  getPrivateObjectDir(): string {
    return this.provider.getPrivateObjectDir();
  }

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    return this.provider.searchPublicObject(filePath);
  }

  async downloadObject(objectFile: StorageObject, cacheTtlSec = 3600): Promise<Response> {
    return this.provider.downloadObject(objectFile, cacheTtlSec);
  }

  async getObjectEntityUploadURL(): Promise<string> {
    return this.provider.getObjectEntityUploadURL();
  }

  async saveLocalUpload(uploadId: string, request: unknown): Promise<void> {
    if (!this.provider.saveLocalUpload) {
      throw new Error("Local upload support is not enabled for the configured storage provider.");
    }
    return this.provider.saveLocalUpload(uploadId, request);
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    return this.provider.getObjectEntityFile(objectPath);
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return this.provider.normalizeObjectEntityPath(rawPath);
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    if (!this.provider.trySetObjectEntityAclPolicy) {
      throw new Error("ACL policy support is not available for the configured storage provider.");
    }
    return this.provider.trySetObjectEntityAclPolicy(rawPath, aclPolicy);
  }

  async canAccessObjectEntity(options: {
    userId?: string;
    objectFile: StorageObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    if (!this.provider.canAccessObjectEntity) {
      return false;
    }
    return this.provider.canAccessObjectEntity(options);
  }
}

function parseCsvPaths(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ).map((entry) => path.resolve(process.cwd(), entry));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function parseObjectPath(input: string): {
  bucketName: string;
  objectName: string;
} {
  let pathValue = input;
  if (!pathValue.startsWith("/")) {
    pathValue = `/${pathValue}`;
  }

  const pathParts = pathValue.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket or directory name.");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}
