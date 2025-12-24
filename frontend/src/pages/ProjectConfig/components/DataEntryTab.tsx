/**
 * 数据填报 Tab 组件
 * 配置项目关联的采集工具
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Switch,
  Modal,
  Empty,
  Spin,
  message,
  Space,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  FormOutlined,
  FileTextOutlined,
  MenuOutlined,
  LinkOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as projectToolService from '../../../services/projectToolService';
import type { ProjectTool, AvailableTool } from '../../../services/projectToolService';
import styles from '../index.module.css';

interface DataEntryTabProps {
  projectId: string;
  disabled?: boolean; // 是否禁用编辑（非配置中状态）
}

// 可拖拽行组件
interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

const SortableRow: React.FC<RowProps> = ({ children, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes}>
      {React.Children.map(children, (child) => {
        if ((child as React.ReactElement).key === 'sort') {
          return React.cloneElement(child as React.ReactElement<{ children?: React.ReactNode }>, {
            children: (
              <MenuOutlined
                style={{ cursor: 'move', color: '#999' }}
                {...listeners}
              />
            ),
          });
        }
        return child;
      })}
    </tr>
  );
};

const DataEntryTab: React.FC<DataEntryTabProps> = ({ projectId, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载项目工具列表
  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectToolService.getProjectTools(projectId);
      setTools(data);
    } catch (error) {
      console.error('加载工具列表失败:', error);
      message.error('加载工具列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 加载可用工具列表
  const loadAvailableTools = useCallback(async () => {
    try {
      const data = await projectToolService.getAvailableTools(projectId);
      setAvailableTools(data);
    } catch (error) {
      console.error('加载可用工具失败:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  // 打开添加工具弹窗
  const handleOpenAddModal = async () => {
    await loadAvailableTools();
    setSelectedToolIds([]);
    setAddModalVisible(true);
  };

  // 添加工具
  const handleAddTools = async () => {
    if (selectedToolIds.length === 0) {
      message.warning('请选择要添加的工具');
      return;
    }

    setAddLoading(true);
    try {
      for (const toolId of selectedToolIds) {
        await projectToolService.addProjectTool(projectId, toolId, true);
      }
      message.success(`成功添加 ${selectedToolIds.length} 个工具`);
      setAddModalVisible(false);
      loadTools();
    } catch (error) {
      message.error('添加工具失败');
    } finally {
      setAddLoading(false);
    }
  };

  // 移除工具
  const handleRemoveTool = (tool: ProjectTool) => {
    Modal.confirm({
      title: '确认移除',
      content: `确定要从项目中移除 "${tool.toolName}" 吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectToolService.removeProjectTool(projectId, tool.toolId);
          message.success('移除成功');
          loadTools();
        } catch (error) {
          message.error('移除失败');
        }
      },
    });
  };

  // 切换必填状态
  const handleToggleRequired = async (tool: ProjectTool, checked: boolean) => {
    try {
      await projectToolService.updateProjectTool(projectId, tool.toolId, { isRequired: checked });
      setTools(prev =>
        prev.map(t =>
          t.toolId === tool.toolId ? { ...t, isRequired: checked ? 1 : 0 } : t
        )
      );
      message.success(checked ? '已设为必填' : '已设为选填');
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 切换审核配置
  const handleToggleReview = async (tool: ProjectTool, checked: boolean) => {
    try {
      await projectToolService.updateProjectTool(projectId, tool.toolId, { requireReview: checked });
      setTools(prev =>
        prev.map(t =>
          t.toolId === tool.toolId ? { ...t, requireReview: checked } : t
        )
      );
      message.success(checked ? '已开启审核' : '已关闭审核（提交后直接通过）');
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 拖拽排序结束
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tools.findIndex((t) => t.id === active.id);
      const newIndex = tools.findIndex((t) => t.id === over?.id);

      const newTools = arrayMove(tools, oldIndex, newIndex);
      setTools(newTools);

      // 更新排序到后端
      try {
        const toolIds = newTools.map(t => t.toolId);
        await projectToolService.updateProjectToolsOrder(projectId, toolIds);
      } catch (error) {
        message.error('更新排序失败');
        loadTools(); // 恢复原来的顺序
      }
    }
  };

  // 表格列定义
  const columns: ColumnsType<ProjectTool> = [
    {
      key: 'sort',
      width: 40,
      align: 'center',
    },
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: '工具名称',
      dataIndex: 'toolName',
      key: 'toolName',
      render: (name, record) => (
        <Space>
          {record.toolType === '表单' ? (
            <FormOutlined style={{ color: '#1890ff' }} />
          ) : (
            <FileTextOutlined style={{ color: '#52c41a' }} />
          )}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'toolType',
      key: 'toolType',
      width: 80,
      render: (type) => (
        <Tag color={type === '表单' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'toolStatus',
      key: 'toolStatus',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          published: { color: 'success', text: '已发布' },
          editing: { color: 'processing', text: '编辑中' },
          draft: { color: 'default', text: '草稿' },
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Badge status={s.color as any} text={s.text} />;
      },
    },
    {
      title: '必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      align: 'center',
      render: (isRequired, record) => (
        <Switch
          checked={isRequired === 1}
          onChange={(checked) => handleToggleRequired(record, checked)}
          size="small"
          disabled={disabled}
        />
      ),
    },
    {
      title: '需审核',
      dataIndex: 'requireReview',
      key: 'requireReview',
      width: 100,
      align: 'center',
      render: (requireReview, record) => (
        <Tooltip title={requireReview !== false ? '提交后需要项目评估专家审核' : '提交后直接通过，无需审核'}>
          <Switch
            checked={requireReview !== false}
            onChange={(checked) => handleToggleReview(record, checked)}
            size="small"
            disabled={disabled}
            checkedChildren="审核"
            unCheckedChildren="免审"
          />
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看表单">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => window.open(`/form-tool/${record.toolId}`, '_blank')}
            />
          </Tooltip>
          {!disabled && (
            <Tooltip title="配置映射">
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.open(`/form-tool/${record.toolId}/edit`, '_blank')}
              />
            </Tooltip>
          )}
          {!disabled && (
            <Tooltip title="移除">
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveTool(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 可用工具表格列
  const availableToolColumns: ColumnsType<AvailableTool> = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          {record.type === '表单' ? (
            <FormOutlined style={{ color: '#1890ff' }} />
          ) : (
            <FileTextOutlined style={{ color: '#52c41a' }} />
          )}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag color={type === '表单' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '目标对象',
      dataIndex: 'target',
      key: 'target',
      width: 100,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <div className={styles.dataEntryTab}>
      {/* 标题栏 */}
      <div className={styles.tabHeader}>
        <div className={styles.tabTitle}>
          <h3>
            <SettingOutlined /> 数据采集工具配置
          </h3>
          <span className={styles.tabSubtitle}>
            配置项目使用的数据采集表单和问卷，拖拽可调整顺序
          </span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenAddModal}
          disabled={disabled}
        >
          添加工具
        </Button>
      </div>

      {/* 工具列表 */}
      <Spin spinning={loading}>
        {tools.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tools.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table
                rowKey="id"
                columns={columns}
                dataSource={tools}
                pagination={false}
                components={{
                  body: {
                    row: SortableRow,
                  },
                }}
                className={styles.toolTable}
              />
            </SortableContext>
          </DndContext>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂未添加采集工具"
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddModal}>
              添加工具
            </Button>
          </Empty>
        )}
      </Spin>

      {/* 添加工具弹窗 */}
      <Modal
        title="添加采集工具"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddTools}
        okText="添加所选"
        cancelText="取消"
        confirmLoading={addLoading}
        width={700}
      >
        <p className={styles.modalSubtitle}>
          从工具库中选择要添加到项目的采集工具（仅显示已发布的工具）
        </p>
        <Table
          rowKey="id"
          columns={availableToolColumns}
          dataSource={availableTools}
          pagination={false}
          scroll={{ y: 300 }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedToolIds,
            onChange: (keys) => setSelectedToolIds(keys as string[]),
          }}
          locale={{
            emptyText: <Empty description="没有可添加的工具" />,
          }}
        />
      </Modal>
    </div>
  );
};

export default DataEntryTab;
