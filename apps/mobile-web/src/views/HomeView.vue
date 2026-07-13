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
    <header>
      <RouterLink class="brand" to="/">
        <span aria-hidden="true">S</span>
        <strong>SIYU · 四时有余</strong>
      </RouterLink>
      <nav>
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">用户协议</RouterLink>
        <button type="button" @click="toggleTheme">
          {{ theme === 'light' ? '夜间模式' : '日间模式' }}
        </button>
      </nav>
    </header>

    <section class="hero">
      <div class="copy">
        <p class="eyebrow">轻量、清晰、适合共同使用的记账工具</p>
        <h1>四时有余</h1>
        <p class="subtitle">认真记录每一笔，也认真生活每一天。</p>
        <p class="description">
          支持个人账本、情侣账本、收支记录、统计分析和攒钱计划。网站目前处于功能建设阶段，QQ
          登录服务已开放申请与测试。
        </p>

        <a class="qq-login" href="/api/v1/auth/qq/authorize">
          <span aria-hidden="true">QQ</span>
          使用 QQ 登录
        </a>

        <p class="consent">
          登录即表示你已阅读并同意
          <RouterLink to="/terms">《用户协议》</RouterLink>
          和
          <RouterLink to="/privacy">《隐私政策》</RouterLink>
        </p>
      </div>

      <aside aria-label="网站服务说明">
        <div class="preview-title">
          <div>
            <small>SIYU</small>
            <strong>情侣账本</strong>
          </div>
          <span>共同记录</span>
        </div>
        <section class="balance">
          <small>本月结余</small>
          <strong>¥ 4,286.60</strong>
          <p>收入 ¥ 9,680.00 · 支出 ¥ 5,393.40</p>
        </section>
        <ul>
          <li><span>日常餐饮</span><strong>- ¥ 86.00</strong></li>
          <li><span>交通出行</span><strong>- ¥ 12.60</strong></li>
          <li><span>攒钱计划</span><strong>68%</strong></li>
        </ul>
      </aside>
    </section>

    <section class="audit-info">
      <div>
        <strong>QQ 官方授权</strong>
        <p>登录过程由 QQ 互联完成，本站不会获取或保存 QQ 密码。</p>
      </div>
      <div>
        <strong>基础资料使用</strong>
        <p>仅在授权后使用 OpenID、昵称和头像完成账号识别与资料展示。</p>
      </div>
      <div>
        <strong>公开合规页面</strong>
        <p>隐私政策与用户协议无需登录即可访问。</p>
      </div>
    </section>

    <footer>
      <span>© 2026 SIYU · 四时有余</span>
      <span>siyu.duanap.cn</span>
    </footer>
  </main>
</template>

<style scoped>
.home-shell {
  min-height: 100dvh;
  padding: 0 24px;
  overflow-x: clip;
  background:
    radial-gradient(circle at 82% 12%, rgb(91 124 250 / 16%), transparent 30rem),
    var(--siyu-page-bg);
  color: var(--siyu-text);
}
header,
.hero,
.audit-info,
footer {
  width: min(1120px, 100%);
  margin: 0 auto;
}
header {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--siyu-text);
  text-decoration: none;
}
.brand span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: #fff;
  font-weight: 800;
}
nav {
  display: flex;
  align-items: center;
  gap: 22px;
}
nav a,
nav button {
  border: 0;
  background: transparent;
  color: var(--siyu-text-secondary);
  font: inherit;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}
.hero {
  display: grid;
  min-height: 620px;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.78fr);
  align-items: center;
  gap: clamp(42px, 8vw, 96px);
  padding: 68px 0 82px;
}
.copy {
  max-width: 650px;
}
.eyebrow {
  margin: 0 0 20px;
  color: var(--siyu-primary);
  font-weight: 700;
}
h1 {
  margin: 0;
  font-size: clamp(54px, 8vw, 88px);
  line-height: 1;
  letter-spacing: -0.06em;
}
.subtitle {
  margin: 22px 0 0;
  font-size: clamp(21px, 3vw, 30px);
  font-weight: 700;
}
.description {
  max-width: 610px;
  margin: 20px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 16px;
  line-height: 1.9;
}
.qq-login {
  display: inline-flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  gap: 11px;
  margin-top: 32px;
  padding: 0 26px;
  border-radius: 14px;
  background: #12b7f5;
  box-shadow: 0 14px 32px rgb(18 183 245 / 26%);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
.qq-login span {
  font-size: 13px;
  font-weight: 900;
}
.consent {
  margin: 16px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.consent a {
  color: var(--siyu-primary);
  text-decoration: none;
}
aside {
  padding: 28px;
  border: 1px solid var(--siyu-border);
  border-radius: 24px;
  background: var(--siyu-surface);
  box-shadow: 0 28px 70px rgb(30 50 90 / 12%);
}
.preview-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.preview-title div {
  display: grid;
  gap: 5px;
}
.preview-title small,
.preview-title span,
.balance small,
.balance p {
  color: var(--siyu-text-secondary);
}
.preview-title span {
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 12px;
}
.balance {
  margin-top: 24px;
  padding: 24px;
  border-radius: 18px;
  background: var(--siyu-primary);
  color: #fff;
}
.balance small,
.balance p {
  color: rgb(255 255 255 / 78%);
}
.balance strong {
  display: block;
  margin-top: 8px;
  font-size: 34px;
}
.balance p {
  margin: 12px 0 0;
  font-size: 13px;
}
aside ul {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
aside li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 4px;
  border-bottom: 1px solid var(--siyu-border);
}
aside li:last-child {
  border-bottom: 0;
}
.audit-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  padding: 28px 0 72px;
}
.audit-info div {
  padding: 24px;
  border-top: 1px solid var(--siyu-border);
}
.audit-info p {
  margin: 9px 0 0;
  color: var(--siyu-text-secondary);
  line-height: 1.7;
}
footer {
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid var(--siyu-border);
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
@media (max-width: 780px) {
  header {
    align-items: flex-start;
    padding: 18px 0;
  }
  nav {
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 12px 16px;
  }
  .hero {
    min-height: auto;
    grid-template-columns: 1fr;
    padding: 58px 0;
  }
  .audit-info {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .home-shell {
    padding: 0 16px;
  }
  .brand strong {
    font-size: 14px;
  }
  header nav a:first-child,
  header nav a:nth-child(2) {
    display: none;
  }
  h1 {
    font-size: 58px;
  }
  aside {
    padding: 20px;
    border-radius: 18px;
  }
  footer {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
