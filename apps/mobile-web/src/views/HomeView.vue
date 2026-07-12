<script setup lang="ts">
import { ref } from 'vue';

import { applyTheme, oppositeTheme, type ThemeMode } from '../theme';

const theme = ref<ThemeMode>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function toggleTheme(): void {
  theme.value = oppositeTheme(theme.value);
  applyTheme(theme.value);
  localStorage.setItem('siyu-theme', theme.value);
}
</script>

<template>
  <main class="home-shell">
    <header class="site-header">
      <RouterLink aria-label="返回 SIYU 首页" class="brand" to="/">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>
          <strong>SIYU</strong>
          <small>四时有余</small>
        </span>
      </RouterLink>

      <nav aria-label="主导航">
        <a href="#features">功能</a>
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">用户协议</RouterLink>
        <button class="theme-button" type="button" @click="toggleTheme">
          {{ theme === 'light' ? '夜间模式' : '日间模式' }}
        </button>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <p class="brand-line">SIYU · 简洁温暖的多人记账工具</p>
        <h1>一起认真生活，<br />也一起轻松记账。</h1>
        <p class="hero-description">
          SIYU 帮你记录日常收支、管理个人或共同账本，让每一笔花费都有迹可循，让每一个攒钱目标更接近实现。
        </p>

        <div class="hero-actions">
          <a class="qq-login" href="/api/v1/auth/qq/authorize">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M12 2.35c-3.66 0-6.35 2.96-6.35 6.98 0 .63.07 1.25.2 1.83-.72.92-1.18 2.07-1.18 3.1 0 1.26.68 2.08 1.7 2.08.36 0 .73-.1 1.08-.28.78 2.18 2.35 3.59 4.55 3.59s3.77-1.41 4.55-3.59c.35.18.72.28 1.08.28 1.02 0 1.7-.82 1.7-2.08 0-1.03-.46-2.18-1.18-3.1.13-.58.2-1.2.2-1.83 0-4.02-2.69-6.98-6.35-6.98Z"
              />
              <path
                class="qq-belly"
                d="M8.1 13.2c.65 1.77 1.95 2.85 3.9 2.85s3.25-1.08 3.9-2.85c-.92.62-2.25.98-3.9.98s-2.98-.36-3.9-.98Z"
              />
            </svg>
            QQ 一键登录
          </a>
          <RouterLink class="secondary-action" to="/login">使用邮箱登录</RouterLink>
        </div>

        <p class="consent">
          登录即表示你已阅读并同意
          <RouterLink to="/terms">《用户协议》</RouterLink>
          与
          <RouterLink to="/privacy">《隐私政策》</RouterLink>
        </p>

        <ul class="trust-list" aria-label="登录安全说明">
          <li>通过 QQ 官方授权登录</li>
          <li>不会获取或保存 QQ 密码</li>
          <li>仅用于识别账号与展示头像昵称</li>
        </ul>
      </div>

      <div class="product-preview" aria-label="SIYU 产品界面预览">
        <div class="preview-toolbar">
          <div>
            <strong>情侣账本</strong>
            <span>2026 年 7 月</span>
          </div>
          <span class="avatar-pair" aria-hidden="true">
            <i>D</i>
            <i>S</i>
          </span>
        </div>

        <section class="balance-panel">
          <p>本月结余</p>
          <strong>¥ 4,286.60</strong>
          <div>
            <span>收入 ¥ 9,680.00</span>
            <span>支出 ¥ 5,393.40</span>
          </div>
        </section>

        <div class="preview-grid">
          <section class="trend-panel">
            <div class="panel-title">
              <strong>近 7 日支出</strong>
              <span>¥ 1,256.80</span>
            </div>
            <div class="chart" aria-hidden="true">
              <i style="height: 36%"></i>
              <i style="height: 58%"></i>
              <i style="height: 44%"></i>
              <i style="height: 78%"></i>
              <i style="height: 52%"></i>
              <i style="height: 92%"></i>
              <i style="height: 66%"></i>
            </div>
          </section>

          <section class="goal-panel">
            <div class="panel-title">
              <strong>攒钱计划</strong>
              <span>68%</span>
            </div>
            <p>旅行基金</p>
            <div class="progress"><i></i></div>
            <small>¥ 6,800 / ¥ 10,000</small>
          </section>
        </div>

        <section class="recent-panel">
          <div class="panel-title">
            <strong>最近记录</strong>
            <span>查看全部</span>
          </div>
          <ul>
            <li>
              <span class="category-icon food" aria-hidden="true">餐</span>
              <span><strong>晚餐</strong><small>今天 19:36 · duanap</small></span>
              <b>- ¥ 86.00</b>
            </li>
            <li>
              <span class="category-icon commute" aria-hidden="true">行</span>
              <span><strong>通勤</strong><small>今天 08:22 · 共同账本</small></span>
              <b>- ¥ 12.60</b>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <section id="features" class="features">
      <div>
        <span class="feature-number">01</span>
        <h2>清晰记录每一笔</h2>
        <p>快速记录收入与支出，按日、周、月、年查看变化，日常账目一目了然。</p>
      </div>
      <div>
        <span class="feature-number">02</span>
        <h2>共同管理一本账</h2>
        <p>支持情侣、家庭或伙伴共同记账，成员之间记录同步，账本边界清晰。</p>
      </div>
      <div>
        <span class="feature-number">03</span>
        <h2>把目标变成进度</h2>
        <p>通过攒钱计划和统计分析看见变化，让每一次坚持都更有方向。</p>
      </div>
    </section>

    <footer>
      <div>
        <strong>SIYU</strong>
        <span>四时有余，认真记录生活。</span>
      </div>
      <nav aria-label="页脚导航">
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">用户协议</RouterLink>
        <RouterLink to="/login">登录</RouterLink>
      </nav>
      <p>© 2026 SIYU. 网站地址：siyu.duanap.cn</p>
    </footer>
  </main>
</template>

<style scoped>
.home-shell {
  min-height: 100dvh;
  overflow-x: clip;
  background:
    radial-gradient(circle at 84% 10%, rgb(91 124 250 / 14%), transparent 31rem),
    radial-gradient(circle at 8% 34%, rgb(255 160 122 / 10%), transparent 25rem),
    var(--siyu-page-bg);
  color: var(--siyu-text);
}

.site-header {
  position: relative;
  z-index: 2;
  display: flex;
  width: min(1180px, calc(100% - 40px));
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  margin: 0 auto;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--siyu-text);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 13px;
  background: var(--siyu-primary);
  box-shadow: 0 8px 20px rgb(91 124 250 / 25%);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
}

.brand > span:last-child {
  display: grid;
  gap: 1px;
}

.brand strong {
  font-size: 15px;
  letter-spacing: 0.16em;
}

.brand small {
  color: var(--siyu-text-secondary);
  font-size: 11px;
}

.site-header nav,
footer nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.site-header nav a,
.theme-button,
footer nav a {
  color: var(--siyu-text-secondary);
  font: inherit;
  font-size: 14px;
  text-decoration: none;
}

.site-header nav a:hover,
footer nav a:hover {
  color: var(--siyu-primary);
}

.theme-button {
  min-height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.hero {
  display: grid;
  width: min(1180px, calc(100% - 40px));
  grid-template-columns: minmax(0, 0.92fr) minmax(420px, 1.08fr);
  align-items: center;
  gap: clamp(48px, 7vw, 96px);
  min-height: 670px;
  margin: 0 auto;
  padding: 76px 0 90px;
}

.hero-copy {
  min-width: 0;
}

.brand-line {
  margin: 0 0 22px;
  color: var(--siyu-primary);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

h1 {
  max-width: 650px;
  margin: 0;
  font-size: clamp(44px, 5.5vw, 72px);
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.hero-description {
  max-width: 590px;
  margin: 26px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 17px;
  line-height: 1.9;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}

.qq-login,
.secondary-action {
  display: inline-flex;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 24px;
  border-radius: 14px;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.qq-login {
  background: #12b7f5;
  box-shadow: 0 12px 28px rgb(18 183 245 / 24%);
  color: #fff;
}

.qq-login svg {
  width: 23px;
  fill: currentColor;
}

.qq-login .qq-belly {
  fill: #12b7f5;
}

.secondary-action {
  border: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
  color: var(--siyu-text);
}

.qq-login:hover,
.secondary-action:hover {
  transform: translateY(-2px);
}

.consent {
  margin: 17px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.consent a {
  color: var(--siyu-primary);
  text-decoration: none;
}

.trust-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 18px;
  margin: 25px 0 0;
  padding: 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  list-style: none;
}

.trust-list li {
  position: relative;
  padding-left: 17px;
}

.trust-list li::before {
  position: absolute;
  top: 0.38em;
  left: 0;
  width: 8px;
  height: 8px;
  border: 2px solid var(--siyu-primary);
  border-radius: 50%;
  content: '';
}

.product-preview {
  position: relative;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--siyu-border);
  border-radius: 30px;
  background: color-mix(in srgb, var(--siyu-surface) 92%, transparent);
  box-shadow: 0 32px 90px rgb(28 42 72 / 14%);
  backdrop-filter: blur(18px);
}

.product-preview::before,
.product-preview::after {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  content: '';
  filter: blur(2px);
}

.product-preview::before {
  top: -42px;
  right: -34px;
  width: 120px;
  height: 120px;
  background: rgb(91 124 250 / 18%);
}

.product-preview::after {
  bottom: -38px;
  left: -36px;
  width: 92px;
  height: 92px;
  background: rgb(255 160 122 / 16%);
}

.preview-toolbar,
.panel-title,
.preview-toolbar > div,
.avatar-pair,
.recent-panel li {
  display: flex;
  align-items: center;
}

.preview-toolbar {
  justify-content: space-between;
  gap: 16px;
}

.preview-toolbar > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
}

.preview-toolbar strong {
  font-size: 18px;
}

.preview-toolbar span,
.panel-title span,
.goal-panel small {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}

.avatar-pair i {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 3px solid var(--siyu-surface);
  border-radius: 50%;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.avatar-pair i + i {
  margin-left: -9px;
  background: #ffe5dc;
  color: #d96c4d;
}

.balance-panel {
  margin-top: 22px;
  padding: 24px;
  border-radius: 22px;
  background: linear-gradient(135deg, #5b7cfa, #718df8 54%, #8e9ef1);
  box-shadow: 0 18px 32px rgb(91 124 250 / 22%);
  color: #fff;
}

.balance-panel p {
  margin: 0;
  font-size: 13px;
  opacity: 0.82;
}

.balance-panel > strong {
  display: block;
  margin-top: 7px;
  font-size: clamp(30px, 4vw, 42px);
  letter-spacing: -0.04em;
}

.balance-panel > div {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 20px;
  font-size: 12px;
  opacity: 0.9;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 14px;
  margin-top: 14px;
}

.trend-panel,
.goal-panel,
.recent-panel {
  border: 1px solid var(--siyu-border);
  border-radius: 19px;
  background: var(--siyu-surface);
}

.trend-panel,
.goal-panel {
  min-height: 158px;
  padding: 18px;
}

.panel-title {
  justify-content: space-between;
  gap: 14px;
}

.panel-title strong {
  font-size: 13px;
}

.chart {
  display: flex;
  height: 92px;
  align-items: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 8px;
  border-bottom: 1px dashed var(--siyu-border);
}

.chart i {
  flex: 1;
  min-width: 5px;
  border-radius: 7px 7px 2px 2px;
  background: linear-gradient(180deg, var(--siyu-primary), rgb(91 124 250 / 24%));
}

.goal-panel > p {
  margin: 23px 0 10px;
  font-size: 13px;
  font-weight: 700;
}

.progress {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-primary-soft);
}

.progress i {
  display: block;
  width: 68%;
  height: 100%;
  border-radius: inherit;
  background: var(--siyu-primary);
}

.goal-panel small {
  display: block;
  margin-top: 11px;
}

.recent-panel {
  margin-top: 14px;
  padding: 18px;
}

.recent-panel ul {
  display: grid;
  gap: 14px;
  margin: 17px 0 0;
  padding: 0;
  list-style: none;
}

.recent-panel li {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 12px;
}

.category-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

.food {
  background: #fff0e8;
  color: #d8754d;
}

.commute {
  background: #eaf0ff;
  color: #5573d8;
}

.recent-panel li > span:nth-child(2) {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.recent-panel li strong,
.recent-panel li b {
  font-size: 13px;
}

.recent-panel li small {
  overflow: hidden;
  color: var(--siyu-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-panel li b {
  font-weight: 700;
}

.features {
  display: grid;
  width: min(1180px, calc(100% - 40px));
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0 auto;
  padding: 80px 0 104px;
  border-top: 1px solid var(--siyu-border);
}

.features > div {
  padding: 0 clamp(20px, 4vw, 48px);
}

.features > div:first-child {
  padding-left: 0;
}

.features > div:last-child {
  padding-right: 0;
}

.features > div + div {
  border-left: 1px solid var(--siyu-border);
}

.feature-number {
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.features h2 {
  margin: 16px 0 11px;
  font-size: 22px;
}

.features p {
  margin: 0;
  color: var(--siyu-text-secondary);
  line-height: 1.8;
}

footer {
  display: grid;
  width: min(1180px, calc(100% - 40px));
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 18px 32px;
  margin: 0 auto;
  padding: 34px 0 38px;
  border-top: 1px solid var(--siyu-border);
}

footer > div {
  display: flex;
  align-items: baseline;
  gap: 13px;
}

footer > div strong {
  letter-spacing: 0.15em;
}

footer > div span,
footer p {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}

footer p {
  grid-column: 1 / -1;
  margin: 0;
}

a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .site-header {
    min-height: 70px;
  }

  .site-header nav a:not(:last-of-type) {
    display: none;
  }

  .hero {
    grid-template-columns: 1fr;
    gap: 58px;
    padding-top: 58px;
  }

  .hero-copy {
    text-align: center;
  }

  .hero-description {
    margin-right: auto;
    margin-left: auto;
  }

  .hero-actions,
  .trust-list {
    justify-content: center;
  }

  .product-preview {
    width: min(620px, 100%);
    margin: 0 auto;
  }

  .features {
    grid-template-columns: 1fr;
    gap: 34px;
  }

  .features > div {
    padding: 0;
  }

  .features > div + div {
    padding-top: 34px;
    border-top: 1px solid var(--siyu-border);
    border-left: 0;
  }
}

@media (max-width: 560px) {
  .site-header,
  .hero,
  .features,
  footer {
    width: min(100% - 28px, 1180px);
  }

  .site-header nav {
    gap: 14px;
  }

  .site-header nav a {
    display: none;
  }

  .brand small {
    display: none;
  }

  .hero {
    min-height: auto;
    padding: 48px 0 70px;
  }

  .brand-line {
    font-size: 12px;
  }

  h1 {
    font-size: clamp(39px, 12vw, 54px);
  }

  .hero-description {
    font-size: 15px;
    line-height: 1.8;
  }

  .hero-actions {
    display: grid;
  }

  .qq-login,
  .secondary-action {
    width: 100%;
  }

  .trust-list {
    display: grid;
    justify-content: start;
    width: fit-content;
    margin-right: auto;
    margin-left: auto;
    text-align: left;
  }

  .product-preview {
    padding: 16px;
    border-radius: 24px;
  }

  .balance-panel {
    padding: 20px;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .trend-panel,
  .goal-panel {
    min-height: 145px;
  }

  .features {
    padding: 62px 0 74px;
  }

  footer {
    grid-template-columns: 1fr;
  }

  footer nav {
    flex-wrap: wrap;
    gap: 12px 20px;
  }

  footer p {
    grid-column: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qq-login,
  .secondary-action {
    transition: none;
  }
}
</style>
