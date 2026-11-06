'use client';

import React from 'react';
import styles from './EpmsWelcomeScreen.module.css';

export type EpmsWelcomeScreenMode = 'welcome' | 'initializing';

export interface EpmsWelcomeScreenProps {
  mode?: EpmsWelcomeScreenMode;
  statusText?: string;
}

export const EpmsWelcomeScreen: React.FC<EpmsWelcomeScreenProps> = ({
  mode = 'welcome',
  statusText = 'Menyiapkan workspace...',
}) => {
  const isInitializing = mode === 'initializing';

  return (
    <div
      className={styles.screenRoot}
      role="status"
      aria-live="polite"
      aria-label={isInitializing ? statusText : 'Memuat EPMS Enterprise Project Management System'}
      data-testid="epms-welcome-screen"
      data-mode={mode}
    >
      {/* Top-Left Curved Blue & Gold Wave Accents */}
      <svg
        className={styles.topWaveSvg}
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="epmsTopBlueFill" x1="0%" y1="0%" x2="85%" y2="85%">
            <stop offset="0%" stopColor="#093B84" stopOpacity="0.68" />
            <stop offset="55%" stopColor="#052354" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#02112B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="epmsTopDiagonalFill" x1="0%" y1="15%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#0D4DA6" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#052659" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#021026" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="epmsTopGoldCyanEdge" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
            <stop offset="28%" stopColor="#FBBF24" stopOpacity="0.92" />
            <stop offset="58%" stopColor="#F59E0B" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#0B4AA0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="epmsTopSubtleLine" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E6FD9" stopOpacity="0.35" />
            <stop offset="65%" stopColor="#0D4290" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#051B40" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Upper-left glowing royal blue wave body */}
        <path
          d="M 0,0 L 340,0 C 235,38 125,95 0,148 Z"
          fill="url(#epmsTopBlueFill)"
        />
        {/* Secondary sweeping translucent wave */}
        <path
          d="M 0,0 L 400,0 L 400,45 C 270,58 145,125 0,218 Z"
          fill="url(#epmsTopDiagonalFill)"
        />
        {/* Subtle lower diagonal contour line */}
        <path
          d="M 0,218 C 145,125 270,58 400,45"
          fill="none"
          stroke="url(#epmsTopSubtleLine)"
          strokeWidth="1.2"
        />
        {/* Bright gold & cyan rim highlight on upper-left wave */}
        <path
          d="M 0,148 C 95,118 195,52 330,0"
          fill="none"
          stroke="url(#epmsTopGoldCyanEdge)"
          strokeWidth="2"
        />
      </svg>

      {/* Center Brand & Status Lockup */}
      <div
        className={`${styles.contentContainer} ${
          isInitializing ? styles.contentInitializing : styles.contentWelcome
        }`}
      >
        {/* Geometric EPMS Emblem */}
        <div className={styles.emblemWrapper} data-testid="epms-welcome-emblem">
          <svg
            className={styles.emblemSvg}
            viewBox="64 36 384 352"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="welcomeTopRibbon" x1="12%" y1="8%" x2="92%" y2="88%">
                <stop offset="0%" stopColor="#22BEFF" />
                <stop offset="52%" stopColor="#12A0F8" />
                <stop offset="100%" stopColor="#087FEE" />
              </linearGradient>
              <linearGradient id="welcomeLeftFacet" x1="12%" y1="18%" x2="88%" y2="82%">
                <stop offset="0%" stopColor="#128EFA" />
                <stop offset="52%" stopColor="#0A66DC" />
                <stop offset="85%" stopColor="#063EA6" />
                <stop offset="100%" stopColor="#04246C" />
              </linearGradient>
              <linearGradient id="welcomeMidRibbon" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#04297E" />
                <stop offset="32%" stopColor="#084EC0" />
                <stop offset="72%" stopColor="#0E7DF2" />
                <stop offset="100%" stopColor="#17A6FC" />
              </linearGradient>
              <linearGradient id="welcomeBotRibbon" x1="95%" y1="15%" x2="5%" y2="90%">
                <stop offset="0%" stopColor="#1DB6FF" />
                <stop offset="36%" stopColor="#58AEF2" />
                <stop offset="68%" stopColor="#0E82F0" />
                <stop offset="88%" stopColor="#1596FA" />
                <stop offset="100%" stopColor="#0645AC" />
              </linearGradient>
              <linearGradient id="welcomeGold1" x1="20%" y1="8%" x2="80%" y2="95%">
                <stop offset="0%" stopColor="#FFE368" />
                <stop offset="52%" stopColor="#F7BA2A" />
                <stop offset="100%" stopColor="#DA8908" />
              </linearGradient>
              <linearGradient id="welcomeGold2" x1="20%" y1="5%" x2="80%" y2="95%">
                <stop offset="0%" stopColor="#FFE46B" />
                <stop offset="48%" stopColor="#F6B523" />
                <stop offset="100%" stopColor="#D27C05" />
              </linearGradient>
              <linearGradient id="welcomeGold3" x1="20%" y1="5%" x2="80%" y2="95%">
                <stop offset="0%" stopColor="#FFE670" />
                <stop offset="46%" stopColor="#F5B120" />
                <stop offset="100%" stopColor="#C66E04" />
              </linearGradient>
            </defs>

            {/* 1. Top-Left Blue Facet */}
            <path
              d="M 101 252 L 101 158 Q 101 148 110 143 L 181 102 L 244 138 L 101 252 Z"
              fill="url(#welcomeLeftFacet)"
            />
            {/* 2. Top-Right Cyan/Blue Ribbon */}
            <path
              d="M 181 102 L 248 63 Q 262 55 276 63 L 403 134 Q 414 141 403 149 L 344 185 Q 333 191 322 184 L 181 102 Z"
              fill="url(#welcomeTopRibbon)"
            />
            {/* 3. Middle Horizontal Blue Bar */}
            <path
              d="M 250 216 Q 250 209 258 209 L 403 209 Q 410 209 410 216 L 318 266 L 258 266 Q 250 266 250 258 Z"
              fill="url(#welcomeMidRibbon)"
            />
            {/* 4. Bottom-Right Diagonal Blue Ribbon */}
            <path
              d="M 406 210 Q 410 212 410 218 L 410 258 Q 410 266 402 271 L 243 362 Q 233 367 223 362 L 186 340 L 406 210 Z"
              fill="url(#welcomeBotRibbon)"
            />
            {/* 5. Gold Bar 1 (Leftmost) */}
            <path
              d="M 101 275 Q 101 271 105 268 L 132 246 Q 137 242 137 248 L 137 311 L 107 294 Q 101 290 101 283 Z"
              fill="url(#welcomeGold1)"
            />
            {/* 6. Gold Bar 2 (Middle) */}
            <path
              d="M 151 232 Q 151 228 155 225 L 182 203 Q 187 199 187 206 L 187 340 L 151 319 Z"
              fill="url(#welcomeGold2)"
            />
            {/* 7. Gold Bar 3 (Rightmost) */}
            <path
              d="M 201 192 Q 201 188 205 185 L 231 169 Q 237 166 237 173 L 237 310 L 201 331 Z"
              fill="url(#welcomeGold3)"
            />
          </svg>
        </div>

        {/* Bold White EPMS Wordmark */}
        <div className={styles.wordmarkWrapper} data-testid="epms-welcome-wordmark">
          <span className={styles.srOnlyTitle}>EPMS</span>
          <svg
            className={styles.wordmarkSvg}
            viewBox="108 376 298 74"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <g fill="#FFFFFF">
              {/* E */}
              <path d="M 111 388 Q 111 379 120 379 L 159 379 Q 163 379 163 383 L 163 390 Q 163 394 159 394 L 128 394 L 128 406 L 154 406 Q 158 406 158 410 L 158 416 Q 158 420 154 420 L 128 420 L 128 432 L 160 432 Q 164 432 164 436 L 164 443 Q 164 447 160 447 L 120 447 Q 111 447 111 438 Z" />
              {/* P */}
              <path d="M 176 384 Q 176 379 181 379 L 214 379 Q 229 379 236 386 Q 243 392 243 403 Q 243 414 236 420 Q 229 427 213 427 L 193 427 L 193 443 Q 193 447 189 447 L 181 447 Q 176 447 176 443 Z M 193 393 L 193 413 L 212 413 Q 219 413 222 410 Q 226 407 226 403 Q 226 399 222 396 Q 219 393 212 393 Z" />
              {/* M */}
              <path d="M 255 384 Q 255 379 260 379 L 270 379 Q 274 379 276 383 L 293 419 L 310 383 Q 312 379 316 379 L 326 379 Q 331 379 331 384 L 331 443 Q 331 447 327 447 L 319 447 Q 315 447 315 443 L 315 406 L 299 439 Q 297 444 293 444 Q 289 444 287 439 L 271 406 L 271 443 Q 271 447 267 447 L 259 447 Q 255 447 255 443 Z" />
              {/* S */}
              <path d="M 344 436 Q 344 432 348 432 L 376 432 Q 382 432 384 430 Q 386 428 386 425 Q 386 422 384 420 Q 382 419 374 418 L 361 417 Q 350 416 346 411 Q 342 406 342 398 Q 342 389 349 384 Q 355 379 369 379 L 393 379 Q 397 379 397 383 L 397 390 Q 397 394 393 394 L 368 394 Q 362 394 360 396 Q 358 397 358 400 Q 358 403 360 404 Q 362 405 370 406 L 383 407 Q 394 408 398 413 Q 403 418 403 427 Q 403 437 396 442 Q 389 447 375 447 L 348 447 Q 344 447 344 443 Z" />
            </g>
          </svg>
        </div>

        {/* ENTERPRISE PROJECT MANAGEMENT SYSTEM */}
        <div className={styles.subtitleBlock} data-testid="epms-welcome-subtitle">
          <span>ENTERPRISE PROJECT</span>
          <span>MANAGEMENT SYSTEM</span>
        </div>

        {/* Gold Accent Divider */}
        <div className={styles.goldDivider} aria-hidden="true" />

        {/* UBD & TVM Identity */}
        <div className={styles.identityText} data-testid="epms-welcome-identity">
          UBD &amp; TVM
        </div>

        {/* Workspace Initialization State (Right-hand reference phone) */}
        {isInitializing && (
          <div
            className={styles.initializingBlock}
            data-testid="epms-workspace-initializing-state"
          >
            <div
              className={styles.checkCircle}
              data-testid="epms-workspace-check-indicator"
              aria-hidden="true"
            >
              <svg
                className={styles.checkIconSvg}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 12.5L10 17L18.5 7.5"
                  stroke="#29B6FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              className={styles.initializingText}
              data-testid="epms-workspace-status-text"
            >
              {statusText}
            </div>
          </div>
        )}
      </div>

      {/* Minimal 3-Dot Loading Indicator (Welcome Screen mode) */}
      {!isInitializing && (
        <div
          className={styles.bottomDotsIndicator}
          data-testid="epms-welcome-loading-dots"
          aria-hidden="true"
        >
          <span className={`${styles.dot} ${styles.dotActive}`} />
          <span className={`${styles.dot} ${styles.dotSecondary}`} />
          <span className={`${styles.dot} ${styles.dotTertiary}`} />
        </div>
      )}

      {/* Bottom-Right Blue & Gold Curved Wave Accents */}
      <svg
        className={styles.bottomWaveSvg}
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="epmsBotUpperBlueWave" x1="20%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#03183A" stopOpacity="0" />
            <stop offset="55%" stopColor="#083A84" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#0E56BE" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="epmsBotGoldCrest" x1="35%" y1="80%" x2="100%" y2="25%">
            <stop offset="0%" stopColor="#92400E" stopOpacity="0" />
            <stop offset="35%" stopColor="#D97706" stopOpacity="0.65" />
            <stop offset="72%" stopColor="#FBBF24" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="epmsBotElectricBlueGlow" x1="0%" y1="100%" x2="100%" y2="20%">
            <stop offset="0%" stopColor="#032050" stopOpacity="0.1" />
            <stop offset="42%" stopColor="#0A58CA" stopOpacity="0.68" />
            <stop offset="72%" stopColor="#1DA1F2" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#063984" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="epmsBotCyanEdgeLine" x1="5%" y1="100%" x2="100%" y2="25%">
            <stop offset="0%" stopColor="#0B4AA0" stopOpacity="0" />
            <stop offset="38%" stopColor="#22B8FF" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#7DD3FC" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="epmsBotGoldEdgeLine" x1="35%" y1="80%" x2="100%" y2="25%">
            <stop offset="0%" stopColor="#B45309" stopOpacity="0" />
            <stop offset="45%" stopColor="#F59E0B" stopOpacity="0.85" />
            <stop offset="85%" stopColor="#FEF08A" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#FDE047" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Deep royal-blue rising upper wave on the right */}
        <path
          d="M 190,300 C 255,215 325,135 400,72 L 400,220 C 330,235 260,265 190,300 Z"
          fill="url(#epmsBotUpperBlueWave)"
        />

        {/* Warm Gold Wave Crest on lower-right */}
        <path
          d="M 175,248 C 248,195 328,154 400,152 L 400,212 C 325,198 250,218 175,248 Z"
          fill="url(#epmsBotGoldCrest)"
        />
        <path
          d="M 175,248 C 248,195 328,154 400,152"
          fill="none"
          stroke="url(#epmsBotGoldEdgeLine)"
          strokeWidth="2"
        />

        {/* Sweeping Electric-Blue Wave from bottom-left across to lower-right */}
        <path
          d="M 24,300 C 128,238 258,176 400,204 L 400,300 Z"
          fill="url(#epmsBotElectricBlueGlow)"
        />
        {/* Bright Cyan-Blue Glowing Rim Line */}
        <path
          d="M 24,300 C 128,238 258,176 400,204"
          fill="none"
          stroke="url(#epmsBotCyanEdgeLine)"
          strokeWidth="2.2"
        />
      </svg>
    </div>
  );
};

export default EpmsWelcomeScreen;

