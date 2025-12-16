import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Modal, Button, Tree, Input, Tag, Space, message } from "antd";
import { SearchOutlined, CloseOutlined } from "@ant-design/icons";
import { schoolApi, SchoolNode } from "@/service/com/schools";
import styles from "./index.module.less";

const { Search } = Input;

interface AddSchoolModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (selectedSchools: any[]) => void;
  initialSelected?: any[];
  grades?: string;
  buttonText?: string;
  title?: string;
}

const AddSchoolModal: React.FC<AddSchoolModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  initialSelected = [],
  grades = "",
  buttonText = "",
  title = "添加单位",
}) => {
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedSchools, setSelectedSchools] = useState<string[]>(
    initialSelected?.map((r) => r.schoolCode) || []
  );
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>(
    initialSelected?.map((r) => r.schoolCode) || []
  );
  const [treeData, setTreeData] = useState<SchoolNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [_treeStats, setTreeStats] = useState({
    totalNodes: 0,
    leafNodes: 0,
    maxLevel: 0,
  });
  const [allSchoolsSelected, setAllSchoolsSelected] = useState(false);
  const [allBranchesSelected, setAllBranchesSelected] = useState(false);
  const [allCampusesSelected, setAllCampusesSelected] = useState(false);
  const [originalTreeData, setOriginalTreeData] = useState<SchoolNode[]>([]);

  // 使用 ref 来存储上一次的 initialSelected，避免无限循环
  const prevInitialSelectedRef = useRef<string>("");

  useEffect(() => {
    setOriginalTreeData([]);
    setTreeData([]);
    setExpandedKeys([]);
    setCheckedKeys([]);
    setSelectedSchools([]);
    setAllSchoolsSelected(false);
    setAllBranchesSelected(false);
    setAllCampusesSelected(false);
    setSearchValue("");
    prevInitialSelectedRef.current = "";
  }, [grades]);

  useEffect(() => {
    if (initialSelected && initialSelected.length > 0) {
      // 将 initialSelected 序列化为字符串进行比较，避免引用变化导致的无限循环
      const currentInitialSelectedStr = JSON.stringify(
        initialSelected.map((r) => r.schoolCode).sort()
      );

      // 只有当 initialSelected 真正改变时才更新状态
      if (prevInitialSelectedRef.current !== currentInitialSelectedStr) {
        const schoolCodes = initialSelected.map((r) => r.schoolCode);
        setSelectedSchools(schoolCodes);
        setCheckedKeys(schoolCodes);
        prevInitialSelectedRef.current = currentInitialSelectedStr;
      }
    } else if (!initialSelected || initialSelected.length === 0) {
      // 如果 initialSelected 为空，且之前有值，则清空
      if (prevInitialSelectedRef.current !== "") {
        setSelectedSchools([]);
        setCheckedKeys([]);
        prevInitialSelectedRef.current = "";
      }
    }
  }, [initialSelected]);

  // 计算树形结构统计信息
  const calculateTreeStats = (
    nodes: SchoolNode[]
  ): { totalNodes: number; leafNodes: number; maxLevel: number } => {
    let totalNodes = 0;
    let leafNodes = 0;
    let maxLevel = 0;

    const traverse = (nodeList: SchoolNode[], level: number = 0) => {
      if (!nodeList || nodeList.length === 0) return;

      maxLevel = Math.max(maxLevel, level);

      nodeList.forEach((node) => {
        totalNodes++;

        if (!node.children || node.children.length === 0) {
          leafNodes++;
        } else {
          traverse(node.children, level + 1);
        }
      });
    };

    traverse(nodes);
    return { totalNodes, leafNodes, maxLevel };
  };

  // 获取所有节点的 key（包括非叶子节点）
  const getAllNodeKeys = (nodes: SchoolNode[]): React.Key[] => {
    const keys: React.Key[] = [];

    const traverse = (nodeList: SchoolNode[]) => {
      if (!nodeList || nodeList.length === 0) return;

      nodeList.forEach((node) => {
        keys.push(node.value);
        // 如果有子节点，递归遍历
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };

    traverse(nodes);
    return keys;
  };

  // 使用 ref 存储 originalTreeData，避免在 useCallback 依赖中造成循环
  const originalTreeDataRef = useRef<SchoolNode[]>([]);

  // 同步 ref 和 state
  useEffect(() => {
    originalTreeDataRef.current = originalTreeData;
  }, [originalTreeData]);

  // 获取学校树数据
  const fetchSchoolTree = useCallback(
    async (searchValue?: string) => {
      if (originalTreeDataRef.current?.length > 0) {
        const filteredData = filterTreeData(
          originalTreeDataRef.current,
          searchValue || ""
        );
        setTreeData(filteredData);
        // 如果有搜索条件，展开所有节点
        if (searchValue) {
          const allKeys = getAllNodeKeys(filteredData);
          setExpandedKeys(allKeys);
        }
        return;
      }
      try {
        setLoading(true);
        const response: any = grades
          ? await schoolApi.getSchoolOptionsTree(grades)
          : await schoolApi.getSchoolTree();
        if (response?.data) {
          let rawData = response.data.data || [];

          // 先过滤掉 isDisabled 为 true 的节点
          const filteredDisabledData = filterDisabledNodes(rawData);

          // 缓存过滤后的原始数据（不包含 isDisabled 为 true 的节点）
          originalTreeDataRef.current = filteredDisabledData;
          setOriginalTreeData(filteredDisabledData);

          // 如果有搜索条件，进行搜索过滤
          let filteredData = filteredDisabledData;
          if (searchValue) {
            filteredData = filterTreeData(filteredDisabledData, searchValue);
          }

          setTreeData(filteredData);

          // 如果有搜索条件，展开所有节点
          if (searchValue) {
            const allKeys = getAllNodeKeys(filteredData);
            setExpandedKeys(allKeys);
          }

          // 计算统计信息
          const stats = calculateTreeStats(filteredData);
          setTreeStats(stats);
        }
      } catch (error) {
        console.error("获取学校树数据失败:", error);
        message.error("获取学校数据失败，请重试");
      } finally {
        setLoading(false);
      }
    },
    [grades]
  );

  // 过滤掉 isDisabled 为 true 的节点 - 支持多级结构
  const filterDisabledNodes = (nodes: SchoolNode[]): SchoolNode[] => {
    if (!nodes || nodes.length === 0) return [];

    return nodes
      .filter((node) => !node.isDisabled) // 过滤掉 isDisabled 为 true 的节点
      .map((node) => {
        // 递归处理子节点
        const filteredChildren =
          node.children && node.children.length > 0
            ? filterDisabledNodes(node.children)
            : undefined;

        return {
          ...node,
          children: filteredChildren,
        };
      });
  };

  // 过滤树数据 - 支持多级结构
  const filterTreeData = (
    nodes: SchoolNode[],
    searchValue: string
  ): SchoolNode[] => {
    if (!nodes || nodes.length === 0) return [];

    return nodes
      .map((node) => {
        const matchesSearch = node.label
          .toLowerCase()
          .includes(searchValue.toLowerCase());
        const filteredChildren =
          node.children && node.children.length > 0
            ? filterTreeData(node.children, searchValue)
            : undefined;

        // 如果当前节点匹配或者有匹配的子节点，则保留该节点
        if (
          matchesSearch ||
          (filteredChildren && filteredChildren.length > 0)
        ) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as SchoolNode[];
  };

  // 组件挂载时获取数据
  useEffect(() => {
    if (visible) {
      fetchSchoolTree();
    }
  }, [visible, fetchSchoolTree]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchValue(value);
    fetchSchoolTree(value);
    // 如果清空搜索，重置展开状态
    if (!value) {
      setExpandedKeys([]);
    }
  };

  // 根据key获取节点信息 - 支持多级结构
  const getNodeByKey = (
    key: string,
    nodes: SchoolNode[]
  ): SchoolNode | null => {
    if (!nodes || nodes.length === 0) return null;

    for (const node of nodes) {
      if (node.value === key) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = getNodeByKey(key, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  // 获取同一父节点下的所有兄弟叶子节点
  const getSiblingLeafNodes = (
    node: SchoolNode,
    allNodes: SchoolNode[]
  ): SchoolNode[] => {
    if (!node || !node.parent || !allNodes || allNodes.length === 0) {
      // 如果没有父节点或数据为空，返回空数组
      return [];
    }

    // 获取所有叶子节点
    const allLeafNodes = getAllLeafNodes(allNodes);

    if (!allLeafNodes || allLeafNodes.length === 0) {
      return [];
    }

    // 找到同一父节点下的所有叶子节点（兄弟节点）
    const siblings = allLeafNodes.filter(
      (leafNode) =>
        leafNode &&
        leafNode.parent === node.parent &&
        leafNode.value !== node.value
    );

    return siblings;
  };

  // 计算应该被禁用的节点集合
  const getDisabledKeys = (selectedKeys: string[]): Set<string> => {
    const disabledKeys = new Set<string>();

    // 如果没有选中任何节点，不禁用任何节点
    if (!selectedKeys || selectedKeys.length === 0) {
      return disabledKeys;
    }

    // 使用 originalTreeData 来查找兄弟节点，确保包含所有节点（不受搜索过滤影响）
    const dataSource =
      originalTreeData.length > 0 ? originalTreeData : treeData;

    if (!dataSource || dataSource.length === 0) {
      return disabledKeys;
    }

    // 获取所有已选中节点的对象（从原始数据中查找，确保能找到）
    const selectedNodes = selectedKeys
      .map((key) => getNodeByKey(key, dataSource))
      .filter(Boolean) as SchoolNode[];

    // 如果没有找到任何选中的节点，不禁用任何节点
    if (selectedNodes.length === 0) {
      return disabledKeys;
    }

    selectedNodes.forEach((node) => {
      // 只处理有效的节点，且必须是学校、分校或校址类型
      if (!node || !node.schoolType) {
        return;
      }

      // 只处理学校、分校、校址三种类型
      if (!["规划校", "分校", "校址"].includes(node.schoolType)) {
        return;
      }

      // 获取同一父节点下的所有兄弟叶子节点（使用原始数据）
      const siblings = getSiblingLeafNodes(node, dataSource);

      // 根据选中的类型，禁用同一层级下的其他类型
      if (node.schoolType === "校址") {
        // 如果选择了校址，禁用同一层级下的规划校和分校
        siblings.forEach((sibling) => {
          if (
            sibling &&
            sibling.schoolType &&
            (sibling.schoolType === "规划校" || sibling.schoolType === "分校")
          ) {
            disabledKeys.add(sibling.value);
          }
        });
      } else if (node.schoolType === "规划校") {
        // 如果选择了规划校，禁用同一层级下的分校和校址
        siblings.forEach((sibling) => {
          if (
            sibling &&
            sibling.schoolType &&
            (sibling.schoolType === "分校" || sibling.schoolType === "校址")
          ) {
            disabledKeys.add(sibling.value);
          }
        });
      } else if (node.schoolType === "分校") {
        // 如果选择了分校，禁用同一层级下的规划校和校址
        siblings.forEach((sibling) => {
          if (
            sibling &&
            sibling.schoolType &&
            (sibling.schoolType === "规划校" || sibling.schoolType === "校址")
          ) {
            disabledKeys.add(sibling.value);
          }
        });
      }
    });

    return disabledKeys;
  };

  // 处理树节点选择
  const handleTreeCheck = (checkedKeysValue: any) => {
    // 获取当前树中所有叶子节点的 key（用于判断哪些是新增或删除的）
    const currentTreeLeafKeys = getAllLeafNodes(treeData).map((n) => n.value);

    // 从 checkedKeysValue 中过滤出叶子节点（排除父节点）
    const checkedLeafKeys = Array.isArray(checkedKeysValue)
      ? checkedKeysValue.filter((key) => {
          // 检查这个 key 是否是叶子节点
          const nodeInTree = getNodeByKey(key, treeData);
          return (
            nodeInTree &&
            (!nodeInTree.children || nodeInTree.children.length === 0)
          );
        })
      : [];

    // 合并之前已选择的学校（不在当前搜索结果中的）和当前新选择的学校
    const previousSelectedNotInCurrentTree = selectedSchools.filter(
      (key) => !currentTreeLeafKeys.includes(key)
    );

    // 合并：保留不在当前树中的已选学校 + 当前树中新选中的学校
    const mergedKeys = Array.from(
      new Set([...previousSelectedNotInCurrentTree, ...checkedLeafKeys])
    );

    // 基于合并后的选中节点计算禁用状态
    const newDisabled = getDisabledKeys(mergedKeys);

    // 过滤掉被禁用的节点（确保不会选择被禁用的节点）
    const enabledKeys = mergedKeys.filter((key) => !newDisabled.has(key));

    setCheckedKeys(enabledKeys);
    setSelectedSchools(enabledKeys);
  };

  // 处理已选择学校的删除
  const handleRemoveSchool = (schoolKey: string) => {
    const newSelected = selectedSchools.filter((key) => key !== schoolKey);
    setSelectedSchools(newSelected);
    setCheckedKeys(newSelected);
  };

  // 处理提交
  const handleSubmit = async () => {
    if (selectedSchools.length === 0) {
      message.warning("请至少选择一个学校");
      return;
    }

    const selectedSchoolData = selectedSchools
      .map((schoolKey) => {
        const node = getNodeByKey(schoolKey, treeData);
        return node
          ? {
              areaCode: node.areaCode,
              areaNm: node.areaNm,
              schoolCode: node.value,
              schoolNm: node.label,
              schoolName: node.label,
              schoolType: node.schoolType,
              areaType: node.areaType,
              businessType: node.businessType,
              parentSchoolCode: node.parentValue,
              parentSchoolNm: node.parentName,
              schoolOperationType: node.schoolOperationType,
              schoolOperationTypeGroup: node.schoolOperationTypeGroup,
            }
          : null;
      })
      .filter(Boolean);

    if (grades) {
      onSubmit(selectedSchoolData);
      return;
    }

    try {
      // 这里可以调用批量添加学校的 API
      const response: any = await schoolApi.batchAddSchool({
        schools: selectedSchoolData,
      });
      if (response.code === 200) {
        message.success(`成功添加 ${selectedSchools.length} 个学校`);
        onSubmit(selectedSchools);
        setSelectedSchools([]);
        setCheckedKeys([]);
      } else {
        message.error(response.data?.msg || "添加学校失败");
      }
    } catch (error) {
      console.error("提交失败:", error);
      message.error("提交失败，请重试");
    }
  };

  // 处理取消
  const handleCancel = () => {
    // setSelectedSchools([]);
    // setCheckedKeys([]);
    onCancel();
  };

  // 处理节点标题点击，切换展开/收起状态
  const handleTitleClick = (
    nodeKey: string,
    isLeaf: boolean,
    e: React.MouseEvent
  ) => {
    // 如果是叶子节点，不处理点击展开
    if (isLeaf) {
      return;
    }
    // 阻止事件冒泡，避免触发复选框选择
    e.stopPropagation();

    // 切换展开状态
    setExpandedKeys((prev) => {
      if (prev.includes(nodeKey)) {
        // 如果已展开，则收起
        return prev.filter((key) => key !== nodeKey);
      } else {
        // 如果未展开，则展开
        return [...prev, nodeKey];
      }
    });
  };

  // 渲染树节点标题 - 支持多级结构显示
  const renderTreeTitle = (
    nodeData: SchoolNode,
    level: number = 0,
    isLeaf: boolean = false
  ) => {
    const { label, schoolType, value } = nodeData;

    let buttonText = "";
    let buttonType: "primary" | "default" = "default";

    // 根据不同的类型和层级显示不同的标签
    if (schoolType) {
      switch (schoolType) {
        case "规划校":
          buttonText = "学校";
          buttonType = "primary";
          break;
        case "分校":
          buttonText = "分校";
          buttonType = "primary";
          break;
        case "校址":
          buttonText = "校址";
          buttonType = "primary";
          break;
        default:
          buttonText = "";
          buttonType = "default";
      }
    }

    return (
      <div
        className={styles.treeNodeTitle}
        style={{
          paddingLeft: `${level * 8}px`,
          cursor: isLeaf ? "default" : "pointer",
        }}
        onClick={(e) => handleTitleClick(value, isLeaf, e)}
      >
        <span>{label}</span>
        {buttonText && (
          <Tag
            color={buttonType === "primary" ? "blue" : "default"}
            className={styles.typeButton}
          >
            {buttonText}
          </Tag>
        )}
      </div>
    );
  };

  // 自定义树节点渲染
  const renderTreeNode = (
    nodeData: SchoolNode,
    level: number = 0,
    disabledKeys: Set<string>
  ) => {
    // 节点被禁用的情况：1. 节点本身有 isDisabled 属性 2. 节点在禁用集合中
    const isDisabled = nodeData.isDisabled || disabledKeys.has(nodeData.value);
    // 判断是否为叶子节点
    const isLeaf = !nodeData.children || nodeData.children?.length === 0;

    return {
      title: renderTreeTitle(nodeData, level, isLeaf),
      key: nodeData.value,
      isLeaf: isLeaf,
      disabled: isDisabled,
      // 只有叶子节点显示 CheckBox，非叶子节点禁用复选框
      checkable: isLeaf,
    };
  };

  // 转换树数据格式 - 支持多级结构
  const convertTreeData = (
    nodes: SchoolNode[],
    level: number = 0,
    disabledKeys: Set<string>
  ): any[] => {
    if (!nodes || nodes.length === 0) return [];

    return nodes.map((node) => ({
      ...renderTreeNode(node, level, disabledKeys),
      children:
        node.children && node.children.length > 0
          ? convertTreeData(node.children, level + 1, disabledKeys)
          : undefined,
    }));
  };

  // 获取所有叶子节点（可选择的学校）- 支持多级结构
  const getAllLeafNodes = (nodes: SchoolNode[]): SchoolNode[] => {
    const leafNodes: SchoolNode[] = [];

    const traverse = (nodeList: SchoolNode[]) => {
      if (!nodeList || nodeList.length === 0) return;

      nodeList.forEach((node) => {
        // 检查是否为叶子节点（没有子节点或子节点为空）
        if (!node.children || node.children.length === 0) {
          leafNodes.push(node);
        } else {
          // 递归遍历子节点
          traverse(node.children);
        }
      });
    };

    traverse(nodes);
    return leafNodes;
  };

  // 获取所有规划校节点（包括非叶子节点）
  const getAllPlanningSchools = (nodes: SchoolNode[]): SchoolNode[] => {
    const planningSchools: SchoolNode[] = [];

    const traverse = (nodeList: SchoolNode[]) => {
      if (!nodeList || nodeList.length === 0) return;

      nodeList.forEach((node) => {
        // 只选择规划校类型的节点，且过滤掉 isDisabled=true 的节点
        if (node.schoolType === "规划校" && !node.isDisabled) {
          planningSchools.push(node);
        }
        // 递归遍历子节点
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };

    traverse(nodes);
    return planningSchools;
  };

  // 根据类型筛选节点 - 支持多级结构
  const getNodesByType = (
    type: "school" | "branch" | "campus"
  ): SchoolNode[] => {
    const allLeafNodes = getAllLeafNodes(treeData);
    return allLeafNodes.filter((node) => {
      // 过滤掉 isDisabled=true 的节点
      if (node.isDisabled) {
        return false;
      }
      // 支持多种类型匹配
      switch (type) {
        case "school":
          return node.schoolType === "规划校" || node.type === "school";
        case "branch":
          return node.schoolType === "分校" || node.type === "branch";
        case "campus":
          return node.schoolType === "校址" || node.type === "campus";
        default:
          return false;
      }
    });
  };

  // 计算应该被禁用的节点集合
  const disabledKeys = useMemo(() => {
    return getDisabledKeys(selectedSchools);
  }, [selectedSchools, treeData, originalTreeData]);

  // 缓存转换后的树数据，避免每次渲染都创建新数组
  const convertedTreeData = useMemo(() => {
    return convertTreeData(treeData, 0, disabledKeys);
  }, [treeData, disabledKeys]);

  const handleAddSchool = () => {
    // 仅获取规划校节点（包括非叶子节点）
    const planningSchoolNodes = getAllPlanningSchools(treeData);
    const planningSchoolKeys = planningSchoolNodes.map((node) => node.value);

    if (allSchoolsSelected) {
      // 如果已全选，则取消选择所有规划校
      setCheckedKeys((prev) =>
        prev.filter((key) => !planningSchoolKeys.includes(key))
      );
      setSelectedSchools((prev) =>
        prev.filter((key) => !planningSchoolKeys.includes(key))
      );
    } else {
      // 如果未全选，则全选规划校（只选择未被禁用的）
      setCheckedKeys((prev) => {
        const currentDisabled = getDisabledKeys(prev);
        const enabledSchoolKeys = planningSchoolKeys.filter(
          (key) => !currentDisabled.has(key)
        );
        const newKeys = Array.from(new Set([...prev, ...enabledSchoolKeys]));
        setSelectedSchools(newKeys);
        return newKeys;
      });
    }
    setAllSchoolsSelected(!allSchoolsSelected);
  };

  const handleAddBranch = () => {
    const branchNodes = getNodesByType("branch");
    const branchKeys = branchNodes.map((node) => node.value);

    if (allBranchesSelected) {
      // 如果已全选，则取消选择所有分校
      setCheckedKeys((prev) => prev.filter((key) => !branchKeys.includes(key)));
      setSelectedSchools((prev) =>
        prev.filter((key) => !branchKeys.includes(key))
      );
    } else {
      // 如果未全选，则全选分校（只选择未被禁用的）
      setCheckedKeys((prev) => {
        const currentDisabled = getDisabledKeys(prev);
        const enabledBranchKeys = branchKeys.filter(
          (key) => !currentDisabled.has(key)
        );
        const newKeys = Array.from(new Set([...prev, ...enabledBranchKeys]));
        setSelectedSchools(newKeys);
        return newKeys;
      });
    }
    setAllBranchesSelected(!allBranchesSelected);
  };

  const handleAddCampus = () => {
    const campusNodes = getNodesByType("campus");
    const campusKeys = campusNodes.map((node) => node.value);

    if (allCampusesSelected) {
      // 如果已全选，则取消选择所有校址
      setCheckedKeys((prev) => prev.filter((key) => !campusKeys.includes(key)));
      setSelectedSchools((prev) =>
        prev.filter((key) => !campusKeys.includes(key))
      );
    } else {
      // 如果未全选，则全选校址（只选择未被禁用的）
      setCheckedKeys((prev) => {
        const currentDisabled = getDisabledKeys(prev);
        const enabledCampusKeys = campusKeys.filter(
          (key) => !currentDisabled.has(key)
        );
        const newKeys = Array.from(new Set([...prev, ...enabledCampusKeys]));
        setSelectedSchools(newKeys);
        return newKeys;
      });
    }
    setAllCampusesSelected(!allCampusesSelected);
  };

  // // 判断是否全选了学校
  // const isAllSchoolsSelected = () => {
  //   const schoolNodes = getNodesByType('school');
  //   const schoolKeys = schoolNodes.map(node => node.value);
  //   return schoolKeys.length > 0 && schoolKeys.every(key => selectedSchools.includes(key));
  // };

  // // 判断是否全选了分校
  // const isAllBranchesSelected = () => {
  //   const branchNodes = getNodesByType('branch');
  //   const branchKeys = branchNodes.map(node => node.value);
  //   return branchKeys.length > 0 && branchKeys.every(key => selectedSchools.includes(key));
  // };

  // // 判断是否全选了校址
  // const isAllCampusesSelected = () => {
  //   const campusNodes = getNodesByType('campus');
  //   const campusKeys = campusNodes.map(node => node.value);
  //   return campusKeys.length > 0 && campusKeys.every(key => selectedSchools.includes(key));
  // };

  return (
    <Modal
      title={title || "添加单位"}
      open={visible}
      onCancel={handleCancel}
      width={1200}
      maskClosable={false}
      className={styles.addSchoolModal}
      footer={[
        <Button
          key="cancel"
          onClick={handleCancel}
          className={styles.cancelButton}
        >
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          className={styles.submitButton}
        >
          {buttonText || "提交"}
        </Button>,
      ]}
    >
      <div className={styles.modalContent}>
        {/* 左侧：选择学校 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelTitle}>
            选择学校
            {/* {treeStats.totalNodes > 0 && (
              <span className={styles.statsInfo}>
                （共 {treeStats.totalNodes} 个节点，{treeStats.leafNodes} 个可选，{treeStats.maxLevel + 1} 级结构）
              </span>
            )} */}
          </div>
          <div className={styles.searchContainer}>
            <Search
              placeholder="请输入学校名称进行搜索"
              value={searchValue}
              onChange={(e) => {
                const value = e.target.value;
                setSearchValue(value);
                // 如果清空搜索，立即触发搜索并重置展开状态
                if (!value) {
                  handleSearch("");
                }
              }}
              onSearch={handleSearch}
              prefix={<SearchOutlined />}
              className={styles.searchInput}
              allowClear
            />
          </div>
          <Space style={{ marginBottom: 10 }}>
            <Button type="primary" onClick={handleAddSchool}>
              {allSchoolsSelected ? "取消全选学校" : "全选学校"}
            </Button>
            <Button type="primary" onClick={handleAddBranch}>
              {allBranchesSelected ? "取消全选分校" : "全选分校"}
            </Button>
            <Button type="primary" onClick={handleAddCampus}>
              {allCampusesSelected ? "取消全选校址" : "全选校址"}
            </Button>
          </Space>
          <div className={styles.treeContainer}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                加载中...
              </div>
            ) : (
              <Tree
                checkable
                showLine
                showIcon
                expandedKeys={expandedKeys}
                checkedKeys={checkedKeys}
                onExpand={setExpandedKeys}
                onCheck={handleTreeCheck}
                treeData={convertedTreeData}
                className={styles.schoolTree}
              />
            )}
          </div>
        </div>

        {/* 右侧：已选择学校 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelTitle}>已选择学校</div>
          <div className={styles.selectedContainer}>
            {selectedSchools.map((schoolKey) => {
              const node = getNodeByKey(schoolKey, originalTreeData);
              return (
                <Tag
                  key={schoolKey}
                  closable
                  onClose={() => handleRemoveSchool(schoolKey)}
                  className={styles.selectedTag}
                  closeIcon={<CloseOutlined />}
                >
                  {node?.label || schoolKey}
                </Tag>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddSchoolModal;
