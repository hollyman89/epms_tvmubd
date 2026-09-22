"use client";

import React from 'react';
import Link from 'next/link';
import { Card, Result, Button, Typography, Space } from 'antd';
import { ShoppingCartOutlined, ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export default function CreatePRPage() {
  return (
    <div style={{ padding: '32px 16px', maxWidth: 640, margin: '0 auto' }}>
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          textAlign: 'center',
        }}
      >
        <Result
          status="info"
          icon={<ShoppingCartOutlined style={{ color: '#2563eb', fontSize: 56 }} />}
          title={
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              Pembuatan Purchase Request Langsung Telah Ditutup
            </span>
          }
          subTitle={
            <div style={{ marginTop: 8 }}>
              <Paragraph style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>
                Seluruh pengadaan proyek dibuat melalui <strong>Paket Pengadaan</strong> (Procurement Package) yang diajukan oleh Project Manager dari item RAB yang telah disetujui.
              </Paragraph>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tim Procurement memproses paket yang berstatus <strong>SUBMITTED</strong> pada antrean pengadaan.
              </Text>
            </div>
          }
          extra={
            <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
              <Link href="/procurement">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  style={{
                    backgroundColor: '#1d4ed8',
                    borderRadius: 8,
                    fontWeight: 600,
                    padding: '0 24px',
                    height: 44,
                  }}
                >
                  Buka Antrean Pengadaan
                </Button>
              </Link>
            </Space>
          }
        />
      </Card>
    </div>
  );
}
