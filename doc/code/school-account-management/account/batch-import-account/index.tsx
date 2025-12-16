import React, { useState } from 'react';
import { Modal, Upload, Button, Space, message, Progress, Typography, Divider } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { schoolReporterApi } from '@/service/com/schoolReporter';
import { downBlobFile } from '@/util/download';

const { Text, Link } = Typography;

type ImportStatus = 'notStarted' | 'importing' | 'failed' | 'success';

interface ImportResult {
  successCount: number;
  failureCount: number;
  failureDataKey?: string;
}

interface BatchImportAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (result: ImportResult) => void;
}

const BatchImportAccountModal: React.FC<BatchImportAccountModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [importStatus, setImportStatus] = useState<ImportStatus>('notStarted');
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const pollImportResult = async (importKey: string) => {
    const maxAttempts = 60; // 最长轮询2分钟（2s * 60）
    const intervalMs = 2000;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res: any = await schoolReporterApi.getImportResultData(importKey);
        console.log(res);
        const done = res?.data?.data?.result === true;
        if (done) {
          setImportResult({
            successCount: res?.data?.data?.successCount || 0,
            failureCount: res?.data?.data?.failureCount || 0,
            failureDataKey: importKey,
          });
          setImportStatus(res?.data?.data?.failureCount > 0 ? 'failed' : 'success');
          return true;
        }
      } catch (e) {
        // 忽略单次失败，继续轮询
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    setUploading(true);
    setImportStatus('importing');

    try {
      const file = (fileList[0] as any).originFileObj || fileList[0];
      const response: any = await schoolReporterApi.importSchoolReporterData(file);
      //   {
      //     "code": 200,
      //     "msg": "c071a03d-a362-4aa3-bba7-90d51d257a27",
      //     "data": null,
      //     "expandData": {}
      // }
      const importKey: string = response?.data?.data;
      if (!importKey) {
        throw new Error('未获取到导入任务Key');
      }

      // 轮询获取导入结果
      const finished = await pollImportResult(importKey);
      if (!finished) {
        setImportStatus('failed');
        message.error('导入超时，请稍后在结果文件中查看详情');
        setImportResult({ successCount: 0, failureCount: 0, failureDataKey: importKey });
        return;
      }
    } catch (error) {
      setImportStatus('failed');
      console.error('导入失败', error);
    } finally {
      setUploading(false);
    }
  };

  const handleReturn = () => {
    setImportStatus('notStarted');
    setFileList([]);
    setUploading(false);
    setImportResult(null);
    onCancel();
  };

  const handleDownloadTemplate = async () => {
    try {
      const resp = await schoolReporterApi.downloadImportTemplate();
      downBlobFile(resp, `用户导入模板.xlsx`);
    } catch (error) {
      console.error('模板下载失败', error);
    }
  };

  const handleDownloadResult = async () => {
    if (!importResult?.failureDataKey) {
      message.error('没有可下载的结果文件');
      return;
    }
    try {
      const resp = await schoolReporterApi.downloadResultData(importResult.failureDataKey);
      downBlobFile(resp, `用户导入结果.xlsx`);
    } catch (error) {
      console.error('结果文件下载失败', error);
    }
  };

  const handleReupload = () => {
    setImportStatus('notStarted');
    setFileList([]);
    setImportResult(null);
  };

  const uploadProps = {
    accept: '.xls,.xlsx',
    fileList,
    beforeUpload: (file: any) => {
      const isXls =
        file.type === 'application/vnd.ms-excel' || file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
      if (!isXls) {
        message.error('只支持 xls/xlsx 格式文件!');
        return false;
      }
      const isLt100M = file.size / 1024 / 1024 < 100;
      if (!isLt100M) {
        message.error('文件大小不能超过 100MB!');
        return false;
      }
      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  } as any;

  const getTitle = () => {
    switch (importStatus) {
      case 'notStarted':
        return '导入用户';
      case 'importing':
        return '导入中';
      case 'success':
        return '导入成功';
      case 'failed':
        return '导入失败';
      default:
        return '导入用户';
    }
  };

  const renderContent = () => {
    switch (importStatus) {
      case 'notStarted':
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text>请下载导入模板: </Text>
              <Link onClick={handleDownloadTemplate} style={{ color: '#1890ff' }}>
                用户导入模板.xlsx
              </Link>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Text strong>选择或拖到导入的文件</Text>
              <Upload.Dragger {...uploadProps} style={{ marginTop: 8 }}>
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">请点击该区域或拖动文件到该区域,完成文件导入。</p>
                <p className="ant-upload-hint">支持xlsx格式,单个文件100M以内。</p>
              </Upload.Dragger>
            </div>
          </>
        );

      case 'importing':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <Text strong>选择或拖到导入的文件</Text>
              <Upload.Dragger {...uploadProps} style={{ marginTop: 8 }}>
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">请点击该区域或拖动文件到该区域,完成文件导入。</p>
                <p className="ant-upload-hint">支持xls格式,单个文件100M以内。</p>
              </Upload.Dragger>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Progress percent={75} status="active" />
            </div>
          </>
        );

      case 'failed':
        return (
          <>
            <div style={{ marginBottom: 24 }}>
              <Text strong>选择或拖到导入的文件</Text>
              <Upload.Dragger {...uploadProps} style={{ marginTop: 8 }}>
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">请点击该区域或拖动文件到该区域,完成文件导入。</p>
                <p className="ant-upload-hint">支持xls格式,单个文件100M以内。</p>
              </Upload.Dragger>
            </div>

            <Divider />

            <div style={{ marginBottom: 24 }}>
              <Text strong>导入结果</Text>
              <div style={{ marginTop: 8 }}>
                <Text style={{ color: '#52c41a' }}>成功数: {importResult?.successCount || 0}</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text style={{ color: '#ff4d4f' }}>失败数: {importResult?.failureCount || 0}</Text>
              </div>
              {importResult?.failureDataKey && (
                <>
                  <div style={{ marginTop: 8 }}>
                    <Link onClick={handleDownloadResult} style={{ color: '#1890ff' }}>
                      用户导入结果.xlsx
                    </Link>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">点击下载导入结果数据，若存在失败，可直接修改失败数据后重新上传!</Text>
                  </div>
                </>
              )}
            </div>
          </>
        );

      case 'success':
        return (
          <>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Text style={{ color: '#52c41a', fontSize: '16px' }}>
                导入成功！共导入 {importResult?.successCount || 0} 条数据
              </Text>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const renderButtons = () => {
    switch (importStatus) {
      case 'notStarted':
        return (
          <Space>
            <Button onClick={handleReturn}>返回</Button>
            <Button type="primary" loading={uploading} onClick={handleUpload} disabled={fileList.length === 0}>
              上传
            </Button>
          </Space>
        );

      case 'importing':
        return (
          <Space>
            <Button onClick={handleReturn}>返回</Button>
            <Button type="primary" loading>
              上传中
            </Button>
          </Space>
        );

      case 'failed':
        return (
          <Space>
            <Button onClick={handleReturn}>返回</Button>
            <Button type="primary" onClick={handleReupload}>
              重新上传
            </Button>
          </Space>
        );

      case 'success':
        return (
          <Space>
            <Button type="primary" onClick={handleReturn}>
              确定
            </Button>
          </Space>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={handleReturn}
      footer={null}
      width={600}
      destroyOnClose
      maskClosable={false}
    >
      <div style={{ marginTop: 16 }}>
        {renderContent()}
        <div style={{ textAlign: 'center' }}>{renderButtons()}</div>
      </div>
    </Modal>
  );
};

export default BatchImportAccountModal;
