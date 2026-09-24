import React, { useEffect } from 'react';
import { Form, Input, Select, Typography, InputNumber, Switch } from 'antd';

const { Title, Text } = Typography;

interface PropertiesPanelProps {
  selectedNode: any | null;
  selectedEdge: any | null;
  readOnly: boolean;
  onNodeDataChange: (nodeId: string, data: any) => void;
  onEdgeDataChange: (edgeId: string, data: any) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  readOnly,
  onNodeDataChange,
  onEdgeDataChange,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (selectedNode) {
      form.setFieldsValue({
        label: selectedNode.data?.label || '',
        taskKey: selectedNode.data?.taskKey || '',
        assignedRole: selectedNode.data?.assignedRole || selectedNode.data?.role || '',
        slaDays: selectedNode.data?.slaDays || 0,
        condition: selectedNode.data?.condition || '',
      });
    } else if (selectedEdge) {
      form.setFieldsValue({
        label: selectedEdge.label || '',
        condition: selectedEdge.data?.condition || '',
        isFallback: selectedEdge.data?.isFallback || false,
      });
    } else {
      form.resetFields();
    }
  }, [selectedNode, selectedEdge, form]);

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (readOnly) return;
    
    if (selectedNode) {
      onNodeDataChange(selectedNode.id, allValues);
    } else if (selectedEdge) {
      onEdgeDataChange(selectedEdge.id, allValues);
    }
  };

  if (!selectedNode && !selectedEdge) {
    return (
      <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', padding: 16, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text type="secondary">Select a node or edge to edit properties.</Text>
      </div>
    );
  }

  return (
    <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', padding: 16, background: '#fff', overflowY: 'auto' }}>
      <Title level={5}>{selectedNode ? 'Node Properties' : 'Edge Properties'}</Title>
      
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        disabled={readOnly}
      >
        {selectedNode && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Type: {selectedNode.type}</Text>
            </div>
            <Form.Item label="Name / Label" name="label">
              <Input placeholder="Enter node label" />
            </Form.Item>
            {selectedNode.type !== 'START' && selectedNode.type !== 'END' && (
              <Form.Item
                label="Task Key"
                name="taskKey"
                tooltip="Explicit machine identifier (e.g. GO_NOGO_APPROVAL). If empty, defaults to node label or node id."
                rules={[
                  {
                    pattern: /^[A-Z0-9_]*$/,
                    message: 'Task Key must contain only uppercase letters, numbers, and underscores (e.g. GO_NOGO_APPROVAL)',
                  },
                ]}
              >
                <Input placeholder="e.g. GO_NOGO_APPROVAL" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            )}
            <Form.Item label="Assigned Role" name="assignedRole">
              <Select placeholder="Select role" allowClear>
                <Select.Option value="PROJECT_MANAGER">Project Manager</Select.Option>
                <Select.Option value="HEAD_OF_OPERATIONS">Head of Operations</Select.Option>
                <Select.Option value="PROCUREMENT_MANAGER">Procurement Manager</Select.Option>
                <Select.Option value="FINANCE_MANAGER">Finance Manager</Select.Option>
                <Select.Option value="DIRECTOR">Director</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="SLA (Days)" name="slaDays">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            {selectedNode.type === 'CONDITION' && (
              <Form.Item label="Condition Rule" name="condition" rules={[{ required: true, message: 'Condition is required for CONDITION nodes' }]}>
                <Input.TextArea placeholder="e.g. amount > 1000" rows={3} />
              </Form.Item>
            )}
          </>
        )}

        {selectedEdge && (
          <>
            <Form.Item label="Label" name="label">
              <Input placeholder="Edge label (e.g. Approved, Rejected)" />
            </Form.Item>
            <Form.Item label="Condition Expression" name="condition">
              <Input placeholder="e.g. status == 'APPROVED'" />
            </Form.Item>
            <Form.Item label="Is Fallback Route?" name="isFallback" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        )}
      </Form>
    </div>
  );
};
