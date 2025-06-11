// Função entrypoint -> iniciar web worker
// Função upload arquivo -> receber arquivo, enviar para o servidor e envia mensagem de status
// No entrypoint eu pego a lista de arquivos e faço um Promisse.all para enviar todos os arquivos
// Enviar mensagem de status para o main thread e matar o worker

const ATTEMPTS = 3;

self.onmessage = async function (e) {
  const { files, fileDatas, apiUrl } = e.data;

  for (let i = 0; i < files.length; i++) {
    await uploadFileWithRetry(files[i], fileDatas[i], apiUrl);
  }
  self.postMessage({
    status: "files-uploaded",
  });
  // Optionally: self.close();
};

async function uploadFileWithRetry(fileMeta, fileData, apiUrl) {
  let attempt = 0;
  let success = false;

  const presignedUrl = await getPresignedUrl(fileMeta.name, apiUrl);

  while (attempt < ATTEMPTS && !success) {
    try {
      if (!presignedUrl) throw new Error("Failed to get presigned URL");

      const response = await upload(presignedUrl, fileData);
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      success = true;
      self.postMessage({
        id: fileMeta.id,
        status: "done",
        progress: 100,
        size: fileMeta.size,
        lastModified: fileMeta.lastModified,
        uploadedParts: [],
        name: fileMeta.name,
      });
    } catch (err) {
      attempt++;
      if (attempt >= ATTEMPTS) {
        self.postMessage({
          id: fileMeta.id,
          status: "error",
          progress: 0,
          size: fileMeta.size,
          lastModified: fileMeta.lastModified,
          uploadedParts: [],
          name: fileMeta.name,
        });
      }
    }
  }
}

async function getPresignedUrl(filename, apiUrl) {
  try {
    const response = await fetch(
      `${apiUrl}/generate-presigned-url/?object_name=${encodeURIComponent(
        "uploads/" + filename
      )}`,
      {
        method: "GET",
      }
    );
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error(error);
  }
}

// Fake upload function for demo
async function upload(presignedUrl, fileData) {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: fileData,
    headers: {
      "Content-Type": "application/octet-stream",
    },
  });
  return response;
}
