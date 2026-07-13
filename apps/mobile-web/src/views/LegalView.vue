<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isPrivacy = computed(() => route.name === 'privacy');
const title = computed(() => (isPrivacy.value ? '隐私政策' : '用户协议'));
</script>

<template>
  <main class="legal-shell">
    <header>
      <RouterLink class="brand" to="/">
        <span aria-hidden="true">S</span>
        <strong>SIYU · 四时有余</strong>
      </RouterLink>
      <RouterLink to="/">返回首页</RouterLink>
    </header>

    <article>
      <p class="updated">更新日期：2026 年 7 月 12 日</p>
      <h1>{{ title }}</h1>

      <template v-if="isPrivacy">
        <p>
          SIYU（四时有余）重视用户隐私。本政策说明我们在提供记账服务及 QQ
          登录服务时如何处理必要信息。
        </p>
        <h2>一、信息收集</h2>
        <p>
          当你使用 QQ 登录时，我们仅在获得授权后获取 QQ 平台提供的
          OpenID、昵称和头像，用于创建账号、识别登录身份及展示基础资料。SIYU
          不会获取、记录或保存你的 QQ 密码。
        </p>
        <p>
          当你使用记账功能时，系统会保存你主动提交的账本、收支记录、分类、备注及协作成员信息，以便向你提供相应服务。
        </p>
        <h2>二、信息使用</h2>
        <p>
          上述信息仅用于账号认证、数据同步、账本管理、服务安全和必要的故障排查，不用于未经授权的广告营销。
        </p>
        <h2>三、信息保护</h2>
        <p>
          我们采取访问控制、传输加密、会话保护等合理安全措施保护用户信息。除法律法规要求或获得用户明确授权外，不会向无关第三方出售或披露用户信息。
        </p>
        <h2>四、账号与数据</h2>
        <p>
          用户可通过站内提供的账号功能管理个人资料。后续正式版本将提供完整的数据导出、删除及账号注销能力。
        </p>
        <h2>五、联系我们</h2>
        <p>对本政策有疑问，可通过网站运营方邮箱 182827046@qq.com 联系。</p>
      </template>

      <template v-else>
        <p>欢迎使用 SIYU（四时有余）。使用本网站及相关服务，即表示你已阅读并同意本协议。</p>
        <h2>一、服务内容</h2>
        <p>SIYU 提供个人及多人账本、收支记录、统计分析、攒钱计划和账号登录等轻量记账服务。</p>
        <h2>二、账号使用</h2>
        <p>
          用户可以使用邮箱或 QQ
          授权登录。用户应妥善保管账号及登录状态，不得利用本服务从事违法活动、侵害他人权益或破坏系统安全。
        </p>
        <h2>三、用户数据</h2>
        <p>
          用户应确保自行录入内容合法、真实且不侵犯第三方权益。账本数据仅用于提供本服务，具体处理方式以《隐私政策》为准。
        </p>
        <h2>四、服务变更</h2>
        <p>
          本网站目前处于持续开发阶段，功能可能更新、调整或暂时中断。我们会尽力保障服务稳定和数据安全。
        </p>
        <h2>五、责任说明</h2>
        <p>SIYU 是日常记录工具，页面中的统计结果不构成财务、投资、税务或法律建议。</p>
        <h2>六、联系我们</h2>
        <p>对本协议有疑问，可通过网站运营方邮箱 182827046@qq.com 联系。</p>
      </template>

      <footer>
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">用户协议</RouterLink>
        <RouterLink to="/login">登录 SIYU</RouterLink>
      </footer>
    </article>
  </main>
</template>

<style scoped>
.legal-shell {
  min-height: 100dvh;
  padding: 0 20px 48px;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
header {
  display: flex;
  width: min(860px, 100%);
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 auto;
}
header a,
footer a {
  color: var(--siyu-primary);
  text-decoration: none;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--siyu-text);
}
.brand span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 11px;
  background: var(--siyu-primary);
  color: #fff;
  font-weight: 800;
}
article {
  width: min(760px, 100%);
  margin: 28px auto 0;
  padding: clamp(26px, 5vw, 52px);
  border: 1px solid var(--siyu-border);
  border-radius: 20px;
  background: var(--siyu-surface);
  box-shadow: 0 18px 48px rgb(30 50 90 / 8%);
}
.updated {
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
h1 {
  margin: 10px 0 30px;
  font-size: clamp(32px, 6vw, 46px);
}
h2 {
  margin: 30px 0 10px;
  font-size: 20px;
}
p {
  margin: 0 0 14px;
  color: var(--siyu-text-secondary);
  line-height: 1.9;
}
footer {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 38px;
  padding-top: 22px;
  border-top: 1px solid var(--siyu-border);
}
@media (max-width: 520px) {
  header {
    min-height: 64px;
  }
  .brand strong {
    font-size: 14px;
  }
  article {
    margin-top: 12px;
    border-radius: 16px;
  }
}
</style>
