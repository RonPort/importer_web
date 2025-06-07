import { InboxOutlined } from "@ant-design/icons";
import { Button, Progress, Upload } from "antd";
import { useUploaderHandlers } from "../custom-hooks/useUploader";

const { Dragger } = Upload;

const Uploader: React.FC = () => {
  const { uploadQueue, handleFiles, startUpload, startCompression } =
    useUploaderHandlers();

  return (
    <>
      <div className="p-4">
        <h2 className="text-xl mb-2">Upload Large Image Set</h2>

        <Dragger
          multiple
          customRequest={({ file, onSuccess }) => {
            if (file instanceof File) {
              handleFiles([file]);
            } else {
              // Optionally handle error or skip
              console.warn("Uploaded file is not a native File object.", file);
            }
            setTimeout(() => onSuccess && onSuccess("ok"), 0);
          }}
          showUploadList={false}
          accept="image/*"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag files to this area to upload
          </p>
          <p className="ant-upload-hint">
            Supports multiple image uploads up to thousands of files.
          </p>
        </Dragger>
        <div className="mb-2">
          Files ready to upload:{" "}
          <b>{uploadQueue.filter((f) => f.status === "pending").length}</b>
        </div>
        <div className="mb-2">
          Failed uploads:{" "}
          <b>{uploadQueue.filter((f) => f.status === "error").length}</b>
        </div>

        <div className="mb-4">
          <Progress
            percent={
              uploadQueue.length
                ? Math.round(
                    uploadQueue.reduce(
                      (acc, file) =>
                        acc +
                        (file.progress ?? (file.status === "done" ? 100 : 0)),
                      0
                    ) / uploadQueue.length
                  )
                : 0
            }
            status="active"
          />
        </div>
        <Button
          style={{ marginTop: "8px" }}
          type="primary"
          onClick={startUpload}
        >
          Start Upload
        </Button>
        <Button
          style={{ marginTop: "8px" }}
          type="primary"
          onClick={startCompression}
        >
          Compress Uploaded Files
        </Button>
      </div>
    </>
  );
};

export default Uploader;
