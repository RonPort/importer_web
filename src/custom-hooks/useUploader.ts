import { useEffect, useRef, useState } from "react";
import localforage from "localforage";

const uploadStore = localforage.createInstance({ name: "uploadQueue" });
const BATCH_SIZE = 10;
const API_URL = import.meta.env.VITE_API_URL;

type FileMeta = {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  uploadedParts: unknown[];
  status: string;
  progress?: number;
  [key: string]: unknown;
};

export const useUploaderHandlers = () => {
  const [uploadQueue, setUploadQueue] = useState<FileMeta[]>([]);
  const [allFiles, setAllFiles] = useState<File[]>([]);
  const uploadQueueRef = useRef<FileMeta[]>([]);
  // const allFilesRef = useRef<File[]>([]);

  useEffect(() => {
    // Restore unfinished uploads
    (async () => {
      const keys = await uploadStore.keys();
      const restored = [];
      for (const key of keys) {
        const fileMeta = (await uploadStore.getItem(key)) as FileMeta;
        restored.push(fileMeta);
      }
      setUploadQueue(restored as FileMeta[]);
    })();
  }, []);

  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
  }, [uploadQueue]);

  // useEffect(() => {
  //   allFilesRef.current = allFiles;
  // }, [allFiles]);

  const handleFiles = async (fileList: File[]): Promise<void> => {
    const entries: FileMeta[] = [];
    const newAllFiles: File[] = [...allFiles];

    for (const file of fileList) {
      const id: string = `${file.name}-${file.size}-${file.lastModified}`;
      const meta: FileMeta = {
        id,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        uploadedParts: [],
        status: "pending",
      };
      await uploadStore.setItem(id, meta);
      entries.push({ ...meta });
      newAllFiles.push(file);
    }

    setUploadQueue((prev: FileMeta[]) => [...prev, ...entries]);
    setAllFiles((prev: File[]) => [...prev, ...newAllFiles]);
  };

  const startUpload = async (): Promise<void> => {
    const files = uploadQueueRef.current;
    let fileList = allFiles;

    let batch: FileMeta[];
    let batchDatas: (ArrayBuffer | undefined)[];
    let batchDatasToRemove: (File | undefined)[];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batch = files.slice(i, i + BATCH_SIZE);
      batchDatas = await Promise.all(
        batch.map((fileMeta) => {
          const file = allFiles.find(
            (f) => `${f.name}-${f.size}-${f.lastModified}` === fileMeta.id
          );
          return file?.arrayBuffer();
        })
      );

      batchDatasToRemove = await Promise.all(
        batch.map((fileMeta) => {
          const file = fileList.find(
            (f) => `${f.name}-${f.size}-${f.lastModified}` === fileMeta.id
          );
          if (!file) {
            console.error("File not found for meta:", fileMeta);
            return undefined;
          }
          return file;
        })
      );

      const updatedAllFiles = fileList.filter((file) => {
        return !batchDatasToRemove.some(
          (toRemove: File | undefined) => file.name === toRemove?.name
        );
      });

      fileList = updatedAllFiles;

      await new Promise<void>((resolve) => {
        const worker = new Worker("/uploadWorker.js");
        worker.onmessage = (event) => {
          updateFileStatus(event.data);
          resolve();
        };
  
        worker.postMessage({
          files: batch,
          fileDatas: batchDatas,
          apiUrl: API_URL,
        });
      });

      setAllFiles([]);
    }
  };

  const updateFileStatus = (data: FileMeta): void => {
    setUploadQueue((prev) =>
      prev.map((file) =>
        file.id === data.id
          ? {
              ...file,
              status: data.status,
              progress: data.progress,
              uploadedParts: data.uploadedParts,
            }
          : file
      )
    );
    uploadStore.setItem(data.id, data);
  };

  const startCompression = async (): Promise<void> => {
    await fetch(`${API_URL}/compress`, {
      method: "GET",
    });
  };

  return {
    uploadQueue,
    allFiles,
    handleFiles,
    startUpload,
    updateFileStatus,
    startCompression,
  };
};
