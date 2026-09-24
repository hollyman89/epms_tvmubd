"use client";

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, Divider, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined, BarChartOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, user, isLoading } = useAuth();

  const getTargetRouteForUser = (userObj: any) => {
    const roles: string[] = userObj?.roles || [];
    if (roles.includes('SUPER_ADMIN') || roles.includes('DIRECTOR') || roles.includes('GENERAL_MANAGER')) {
      return '/';
    }
    if (roles.includes('PROJECT_MANAGER') || roles.includes('PMO') || roles.includes('HEAD_OF_OPERATIONS')) {
      return '/project-delivery';
    }
    if (roles.includes('PROCUREMENT') || roles.includes('PURCHASING') || roles.includes('MANAGER')) {
      return '/procurement';
    }
    if (roles.includes('FINANCE')) {
      return '/finance/invoices';
    }
    if (roles.includes('MARKETING')) {
      return '/sales';
    }
    if (roles.includes('LEGAL')) {
      return '/legal/review';
    }
    return '/';
  };

  // Redirect only if user arrived at /login while already authenticated (initial mount)
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace(getTargetRouteForUser(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <Spin size="large" tip="Memverifikasi sesi..." />
      </div>
    );
  }

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

      login(token, loggedInUser);
      message.success(`Selamat datang, ${loggedInUser.email}`);
      
      const targetRoute = getTargetRouteForUser(loggedInUser);
      router.push(targetRoute);
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
    <div className="epms-login-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .epms-login-container {
          display: flex;
          flex-direction: row;
          min-height: 100dvh;
          width: 100%;
          background-color: #f8fafc;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow-x: hidden;
        }
        .epms-login-left-panel {
          flex: 1;
          width: 50%;
          background-color: #0a2846;
          background-image: linear-gradient(165deg, #0f355b 0%, #0a2846 100%);
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }
        .epms-login-branding-header {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 22px;
          margin-bottom: 8px;
        }
        .epms-login-branding-divider {
          width: 1px;
          height: 32px;
          background: rgba(255, 255, 255, 0.15);
          flex-shrink: 0;
        }
        .epms-login-ubd-logo {
          height: 48px;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
          filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.35));
        }
        .epms-login-tvm-logo {
          height: 64px;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.08)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35));
        }
        .epms-login-hero-box {
          position: relative;
          z-index: 10;
          max-width: 460px;
          margin-top: auto;
          margin-bottom: auto;
          padding: 32px 0;
        }
        .epms-login-hero-title {
          font-size: 54px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -1.5px;
          line-height: 1.0;
          margin: 0;
        }
        .epms-login-hero-subtitle {
          font-size: 16px;
          font-weight: 500;
          color: #cbd5e1;
          margin-top: 12px;
          letter-spacing: -0.2px;
        }
        .epms-login-hero-desc {
          color: #8da4be;
          font-size: 14.5px;
          font-weight: 400;
          line-height: 1.65;
          max-width: 420px;
          margin: 20px 0 0 0;
        }
        .epms-login-bottom-section {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 24px;
        }
        .epms-login-trust-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          color: #8da4be;
          font-size: 12.5px;
          font-weight: 500;
        }
        .epms-login-trust-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #cbd5e1;
        }
        .epms-login-trust-dot {
          color: rgba(255, 255, 255, 0.2);
          font-size: 14px;
        }
        .epms-login-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #5a738e;
          font-size: 11.5px;
        }
        .epms-login-right-panel {
          flex: 1;
          width: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 36px;
          background-color: #f8fafc;
          box-sizing: border-box;
        }
        .epms-login-card {
          width: 100%;
          max-width: 460px;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.04), 0 20px 40px -10px rgba(15, 23, 42, 0.06);
          border: 1px solid #e2e8f0;
          padding: 44px 40px;
          box-sizing: border-box;
        }
        .epms-login-card-title {
          font-size: 26px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.4px;
        }
        .epms-login-card-header {
          margin-bottom: 28px;
        }
        .epms-login-divider {
          color: #94a3b8;
          font-size: 12.5px;
          font-weight: 400;
          margin: 20px 0 18px;
          width: 100%;
          min-width: 100%;
        }
        .epms-login-input {
          width: 100%;
          border-radius: 8px !important;
          height: 44px !important;
          border-color: #cbd5e1 !important;
          font-size: 14px !important;
          transition: all 0.2s ease-in-out !important;
        }
        .epms-login-input:hover {
          border-color: #94a3b8 !important;
        }
        .epms-login-input:focus,
        .epms-login-input-focused {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.12) !important;
        }
        .epms-login-primary-btn {
          width: 100%;
          height: 44px !important;
          border-radius: 8px !important;
          background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%) !important;
          border: 1px solid #0284c7 !important;
          font-size: 14.5px !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3) !important;
          transition: all 0.2s ease-in-out !important;
        }
        .epms-login-primary-btn:hover {
          background: linear-gradient(180deg, #0369a1 0%, #075985 100%) !important;
          border-color: #0369a1 !important;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4) !important;
        }
        .epms-login-primary-btn:active {
          transform: translateY(1px);
        }
        .epms-login-sso-btn {
          width: 100%;
          height: 44px !important;
          border-radius: 8px !important;
          border-color: #cbd5e1 !important;
          background-color: #ffffff !important;
          color: #334155 !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          margin-bottom: 20px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
          transition: all 0.2s ease-in-out !important;
        }
        .epms-login-sso-btn:hover {
          background-color: #f8fafc !important;
          border-color: #94a3b8 !important;
          color: #0f172a !important;
        }
        .epms-login-link {
          color: #0284c7;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .epms-login-link:hover {
          color: #0369a1;
          text-decoration: underline;
        }
        .epms-login-matrix-layer {
          position: absolute;
          top: 16%;
          right: 5%;
          width: 30%;
          height: 24%;
          pointer-events: none;
          z-index: 1;
          background-image: radial-gradient(circle, #38bdf8 1px, transparent 1px);
          background-size: 16px 16px;
          opacity: 0.03;
          -webkit-mask-image: radial-gradient(ellipse at 65% 55%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 75%);
          mask-image: radial-gradient(ellipse at 65% 55%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 75%);
        }
        .epms-login-fiber-layer {
          position: absolute;
          right: 4%;
          bottom: 18%;
          width: 65%;
          height: 48%;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        }
        .epms-login-fiber-svg {
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .epms-login-cityscape-layer {
          position: absolute;
          right: 2%;
          bottom: 16%;
          width: 70%;
          height: 54%;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.4) 6%, rgba(0, 0, 0, 1) 18%);
          mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.4) 6%, rgba(0, 0, 0, 1) 18%);
        }
        .epms-login-cityscape-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: right bottom;
          pointer-events: none;
        }

        @media (max-width: 900px) {
          .epms-login-container {
            flex-direction: column;
          }
          .epms-login-left-panel {
            flex: none;
            width: 100%;
            padding: 32px 24px;
          }
          .epms-login-matrix-layer,
          .epms-login-fiber-layer,
          .epms-login-cityscape-layer {
            display: none;
          }
          .epms-login-branding-header {
            gap: 16px;
            margin-bottom: 0;
          }
          .epms-login-branding-divider {
            height: 24px;
          }
          .epms-login-ubd-logo {
            height: 38px;
            width: auto;
          }
          .epms-login-tvm-logo {
            height: 48px;
            width: auto;
          }
          .epms-login-hero-box {
            margin-top: 20px;
            margin-bottom: 0;
            padding: 0;
          }
          .epms-login-hero-title {
            font-size: 38px;
          }
          .epms-login-hero-subtitle {
            font-size: 15px;
            margin-top: 6px;
          }
          .epms-login-hero-desc {
            font-size: 13.5px;
            margin-top: 12px;
          }
          .epms-login-bottom-section {
            display: none;
          }
          .epms-login-right-panel {
            flex: none;
            width: 100%;
            padding: 32px 20px 48px;
          }
          .epms-login-card {
            border-radius: 16px;
            padding: 28px 20px;
          }
          .epms-login-card-title {
            font-size: 22px;
          }
          .epms-login-card-header {
            margin-bottom: 20px;
          }
          .epms-login-divider {
            margin: 16px 0 14px;
          }
        }
      ` }} />

      {/* LEFT PANEL: BRANDING & PRODUCT IDENTITY (50% WIDTH) */}
      <div className="epms-login-left-panel">
        {/* SUBTLE DIGITAL MATRIX (AMBIENT BACKGROUND TEXTURE) */}
        <div className="epms-login-matrix-layer" aria-hidden="true" />

        {/* FIBER OPTIC NETWORK PATH (SECONDARY DECORATIVE INFRASTRUCTURE LAYER) */}
        <div className="epms-login-fiber-layer" aria-hidden="true">
          <svg
            className="epms-login-fiber-svg"
            viewBox="0 0 650 350"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 1. Fiber Optic Connection Paths (Visual weight ~30% relative to cityscape) */}
            <g stroke="#38bdf8" strokeWidth="1" opacity="0.30" fill="none">
              {/* Path 1: Transition trunk to mid-rise core */}
              <path d="M 50 240 Q 120 230 180 200 T 310 180" />
              {/* Path 2: Uplink branch to main tower node */}
              <path d="M 310 180 Q 370 140 430 110" />
              {/* Path 3: Mid-rise horizontal distribution link */}
              <path d="M 310 180 Q 340 230 380 240 L 520 240" strokeDasharray="6 3" />
              {/* Path 4: Right wing commercial interconnect */}
              <path d="M 520 240 Q 560 240 600 210" />
            </g>

            {/* 2. Fiber Network Splice / Connection Nodes (Subtle, ~55% opacity) */}
            <g fill="#38bdf8" opacity="0.55">
              <circle cx="50" cy="240" r="2.5" />
              <circle cx="180" cy="200" r="2.5" />
              <circle cx="310" cy="180" r="3" />
              <circle cx="430" cy="110" r="3" />
              <circle cx="380" cy="240" r="2.5" />
              <circle cx="520" cy="240" r="2.5" />
              <circle cx="600" cy="210" r="2.5" />
            </g>
          </svg>
        </div>

        {/* LARGE ARCHITECTURAL CITYSCAPE SKYLINE (DECORATIVE STATIC SVG) */}
        <div className="epms-login-cityscape-layer" aria-hidden="true">
          <img 
            src="/epms-cityscape.svg" 
            alt="" 
            className="epms-login-cityscape-img"
          />
        </div>

        {/* COMPANY LOGO HEADER: [ UBD LOGO ] | [ TVM LOGO ] */}
        <div className="epms-login-branding-header">
          <img 
            src="/logo-ubd-clean.png" 
            alt="UBD Logo" 
            className="epms-login-ubd-logo"
          />
          <div className="epms-login-branding-divider" />
          <img 
            src="/TVM.png" 
            alt="TVM Logo" 
            className="epms-login-tvm-logo"
          />
        </div>

        {/* MAIN PRODUCT IDENTITY & HERO CONTENT */}
        <div className="epms-login-hero-box">
          <h1 className="epms-login-hero-title">EPMS</h1>
          <div className="epms-login-hero-subtitle">
            Enterprise Project Management System
          </div>
          <p className="epms-login-hero-desc">
            Integrated platform to manage the entire project lifecycle with efficiency, transparency and control.
          </p>
        </div>

        {/* BOTTOM METADATA & TRUST STRIP */}
        <div className="epms-login-bottom-section">
          <div className="epms-login-trust-row">
            <span className="epms-login-trust-item">
              <SafetyCertificateOutlined style={{ color: '#38bdf8' }} /> Enterprise Grade Security
            </span>
            <span className="epms-login-trust-dot">·</span>
            <span className="epms-login-trust-item">
              <BarChartOutlined style={{ color: '#38bdf8' }} /> High Availability
            </span>
            <span className="epms-login-trust-dot">·</span>
            <span className="epms-login-trust-item">
              <TeamOutlined style={{ color: '#38bdf8' }} /> Built for Scale
            </span>
          </div>
          <div className="epms-login-footer-row">
            <span>&copy; 2026 UBD & TVM Construction Group. All rights reserved.</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN PANEL (50% WIDTH) */}
      <div className="epms-login-right-panel">
        <div className="epms-login-card">
          {/* Card Header: Welcome Back */}
          <div className="epms-login-card-header">
            <h2 className="epms-login-card-title">
              Welcome Back
            </h2>
            <div style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', fontWeight: 400 }}>
              Sign in to continue to EPMS
            </div>
          </div>

          {/* Form Login */}
          <Form
            form={form}
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
              style={{ marginBottom: '18px', width: '100%' }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8', marginRight: '8px' }} />}
                placeholder="Enter your email or username"
                className="epms-login-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>Password</span>}
              rules={[{ required: true, message: 'Masukkan password Anda!' }]}
              style={{ marginBottom: '16px', width: '100%' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: '8px' }} />}
                placeholder="Enter your password"
                className="epms-login-input"
              />
            </Form.Item>

            {/* Checkbox Remember Me & Forgot Password */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '22px', width: '100%' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>Remember me</Checkbox>
              </Form.Item>
              <a className="epms-login-link" href="#">
                Forgot Password?
              </a>
            </div>

            {/* Primary Sign In Button */}
            <Form.Item style={{ marginBottom: '18px', width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="epms-login-primary-btn"
              >
                Sign In
              </Button>
            </Form.Item>

            {/* Divider Or Continue With */}
            <Divider className="epms-login-divider">
              or continue with
            </Divider>

            {/* Microsoft SSO Button */}
            <Button
              block
              onClick={handleMicrosoftSSO}
              className="epms-login-sso-btn"
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
                <a className="epms-login-link" href="#">
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
