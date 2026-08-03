"use client";

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, Divider, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      const roleName = user.roles?.[0];
      switch (roleName) {
        case 'SUPER_ADMIN':
        case 'GENERAL_MANAGER':
          router.push('/');
          break;
        case 'PROJECT_MANAGER':
        case 'PMO':
          router.push('/project-delivery');
          break;
        case 'FINANCE':
          router.push('/inbox');
          break;
        case 'PROCUREMENT_STAFF':
        case 'MANAGER':
        case 'DIRECTOR':
          router.push('/procurement');
          break;
        case 'MARKETING':
          router.push('/sales');
          break;
        default:
          router.push('/');
      }
    }
  }, [isAuthenticated, user, router]);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/login', {
        email: values.email,
        password: values.password,
      });

      const payload = res.data.data || res.data;
      const token = payload.access_token || payload.accessToken;
      const loggedInUser = payload.user;
      const refreshToken = payload.refresh_token || payload.refreshToken;

      login(token, loggedInUser, refreshToken);
      message.success(`Selamat datang, ${loggedInUser.email}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message;
      const msg = Array.isArray(errorMsg)
        ? errorMsg[0]
        : errorMsg || 'Login gagal. Periksa email dan password Anda.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSSO = () => {
    message.info('Redirecting to Microsoft Azure AD Single Sign-On...');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#071836', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* SISI KIRI: BRANDING & HIGH-DETAIL BLUEPRINT SKYSCRAPER (55% Width) */}
      <div
        style={{
          flex: '1.25',
          backgroundColor: '#061633',
          backgroundImage: `radial-gradient(circle at 10% 10%, #0d2854 0%, #051329 90%)`,
          padding: '56px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hidden md:flex"
      >
        {/* BLUEPRINT GRID BACKGROUND */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />

        {/* HIGH-DETAIL BLUEPRINT SKYSCRAPER & CRANE GRAPHIC (SVG OVERLAY RIGHT SIDE) */}
        <svg
          style={{
            position: 'absolute',
            bottom: '-20px',
            right: '20px',
            width: '520px',
            height: '90%',
            opacity: 0.35,
            pointerEvents: 'none',
            zIndex: 2
          }}
          viewBox="0 0 600 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Skyscraper Blueprint Frame */}
          <rect x="220" y="140" width="280" height="660" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />
          <rect x="240" y="160" width="240" height="640" stroke="#0ea5e9" strokeWidth="1.5" />
          
          {/* Diagonal Structural Bracing */}
          <line x1="240" y1="160" x2="480" y2="300" stroke="#0284c7" strokeWidth="1" />
          <line x1="480" y1="160" x2="240" y2="300" stroke="#0284c7" strokeWidth="1" />
          <line x1="240" y1="300" x2="480" y2="440" stroke="#0284c7" strokeWidth="1" />
          <line x1="480" y1="300" x2="240" y2="440" stroke="#0284c7" strokeWidth="1" />
          <line x1="240" y1="440" x2="480" y2="580" stroke="#0284c7" strokeWidth="1" />
          <line x1="480" y1="440" x2="240" y2="580" stroke="#0284c7" strokeWidth="1" />
          <line x1="240" y1="580" x2="480" y2="720" stroke="#0284c7" strokeWidth="1" />
          <line x1="480" y1="580" x2="240" y2="720" stroke="#0284c7" strokeWidth="1" />

          {/* Window Columns */}
          <line x1="280" y1="160" x2="280" y2="800" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="320" y1="160" x2="320" y2="800" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="360" y1="160" x2="360" y2="800" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="400" y1="160" x2="400" y2="800" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="440" y1="160" x2="440" y2="800" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />

          {/* Floor Slab Rows */}
          {Array.from({ length: 25 }).map((_, i) => (
            <line key={i} x1="220" y1={180 + i * 24} x2="500" y2={180 + i * 24} stroke="#0ea5e9" strokeWidth="0.8" opacity="0.7" />
          ))}

          {/* Tower Crane Top Structure */}
          <path d="M 360 140 V 20 H 120 M 360 40 L 480 140 M 360 20 L 520 20 M 360 40 L 140 20" stroke="#f59e0b" strokeWidth="2.5" />
          <path d="M 200 20 V 120" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="200" cy="120" r="4" fill="#fbbf24" />

          {/* Perspective Ground Grid Projections */}
          <path d="M0 720 L600 780 M0 760 L600 800 M0 680 L600 750" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />
          <path d="M100 800 L300 650 M250 800 L450 650 M400 800 L600 650" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />
        </svg>

        {/* TOP LEFT: VECTOR GOLD 3D SKYSCRAPER LOGO */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Vector 3D Gold Tower Emblem */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="url(#gold_grad)" />
            <path d="M14 28V16L18 13V28H14Z" fill="#071938" />
            <path d="M19 28V10L24 7V28H19Z" fill="#071938" />
            <path d="M25 28V18L28 16V28H25Z" fill="#071938" opacity="0.8" />
            <defs>
              <linearGradient id="gold_grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fbbf24" />
                <stop offset="1" stopColor="#d97706" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div style={{ color: '#ffffff', fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px', lineHeight: 1.1 }}>
              UBD & TVM
            </div>
            <div style={{ color: '#94a3b8', fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', marginTop: '2px' }}>
              CONSTRUCTION GROUP
            </div>
          </div>
        </div>

        {/* MAIN HEADLINE & DESKRIPSI */}
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px', marginTop: 'auto', marginBottom: 'auto', paddingTop: '40px' }}>
          <h1 style={{ color: '#ffffff', fontSize: '60px', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-1.5px', margin: 0 }}>
            EPMS
          </h1>
          <div style={{ color: '#cbd5e1', fontSize: '22px', fontWeight: 500, marginTop: '8px', letterSpacing: '-0.2px' }}>
            Enterprise Project Management System
          </div>

          {/* BARIS AKSEN EMAS */}
          <div style={{ width: '48px', height: '4px', background: '#f59e0b', borderRadius: '2px', margin: '24px 0' }} />

          <p style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 400, lineHeight: 1.6, maxWidth: '440px', margin: 0 }}>
            Integrated Platform to Manage the Entire Project Lifecycle with Efficiency, Transparency and Control.
          </p>
        </div>

        {/* BOTTOM FOOTER BAR */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
          {/* Security Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SafetyCertificateOutlined style={{ color: '#38bdf8', fontSize: '22px' }} />
            <div>
              <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>Secure. Reliable. Scalable.</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>Enterprise Grade Security & Performance</div>
            </div>
          </div>

          {/* Copyright */}
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
            &copy; 2026 UBD & TVM Construction Group. All rights reserved.
          </div>

          {/* Version Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Version 1.0.0</span>
            <span style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#fbbf24',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px'
            }}>
              Enterprise Edition
            </span>
          </div>
        </div>
      </div>

      {/* SISI KANAN: FORM LOGIN CARD ("WELCOME BACK") */}
      <div
        style={{
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          backgroundColor: '#f8fafc',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '430px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12)',
            border: '1px solid #f1f5f9',
            padding: '44px 40px',
          }}
        >
          {/* Card Header: Welcome Back */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
              Welcome Back
            </h2>
            <div style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', fontWeight: 400 }}>
              Sign in to continue to EPMS
            </div>
          </div>

          {/* Form Login */}
          <Form
            name="login_form"
            layout="vertical"
            initialValues={{ remember: false }}
            onFinish={onFinish}
            size="large"
            requiredMark={false}
            style={{ width: '100%' }}
          >
            <Form.Item
              name="email"
              label={<span style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>Email or Username</span>}
              rules={[{ required: true, message: 'Masukkan email atau username Anda!' }]}
              style={{ marginBottom: '20px', width: '100%' }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8', marginRight: '6px' }} />}
                placeholder="Enter your email or username"
                style={{ width: '100%', borderRadius: '10px', height: '48px', borderColor: '#cbd5e1', fontSize: '14px' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>Password</span>}
              rules={[{ required: true, message: 'Masukkan password Anda!' }]}
              style={{ marginBottom: '16px', width: '100%' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: '6px' }} />}
                placeholder="Enter your password"
                style={{ width: '100%', borderRadius: '10px', height: '48px', borderColor: '#cbd5e1', fontSize: '14px' }}
              />
            </Form.Item>

            {/* Checkbox Remember Me (UNCHECKED BY DEFAULT) & Forgot Password */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', width: '100%' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>Remember me</Checkbox>
              </Form.Item>
              <a style={{ color: '#0284c7', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} href="#">
                Forgot Password?
              </a>
            </div>

            {/* Primary Sign In Button */}
            <Form.Item style={{ marginBottom: '20px', width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
                  borderColor: '#0284c7',
                  fontSize: '15px',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                }}
              >
                Sign In
              </Button>
            </Form.Item>

            {/* Divider Or Continue With */}
            <Divider style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 400, margin: '24px 0 20px', width: '100%', minWidth: '100%' }}>
              or continue with
            </Divider>

            {/* Microsoft SSO Button */}
            <Button
              block
              onClick={handleMicrosoftSSO}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '10px',
                borderColor: '#cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '24px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {/* Microsoft 4-Color Icon */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', width: '16px', height: '16px' }}>
                <div style={{ backgroundColor: '#f25022', borderRadius: '1px' }} />
                <div style={{ backgroundColor: '#7fba00', borderRadius: '1px' }} />
                <div style={{ backgroundColor: '#00a4ef', borderRadius: '1px' }} />
                <div style={{ backgroundColor: '#ffb900', borderRadius: '1px' }} />
              </div>
              Sign in with Microsoft
            </Button>

            {/* Need Help Footer Link */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Need help?{' '}
                <a style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }} href="#">
                  Contact System Administrator
                </a>
              </span>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
